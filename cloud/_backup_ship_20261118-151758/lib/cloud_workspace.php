<?php
declare(strict_types=1);

/**
 * Durable per-account / per-project cloud agent workspace.
 *
 * Unlike ephemeral agent job dirs (storage/agent/{uid}/{jobId}/workspace),
 * cloud sessions persist files across agent runs — like desktop project folders.
 */

function acx_cloud_storage_root(): string
{
    $root = dirname(__DIR__) . '/storage/cloud';
    if (!is_dir($root)) {
        @mkdir($root, 0755, true);
    }

    return $root;
}

function acx_cloud_ws_sanitize(string $key): string
{
    $key = preg_replace('/[^a-zA-Z0-9_-]/', '', $key) ?: 'default';

    return substr($key, 0, 64);
}

/** Resolve durable workspace key for a user (+ optional project id). */
function acx_cloud_ws_key(?string $projectId = null): string
{
    $projectId = trim((string) $projectId);
    if ($projectId !== '') {
        return acx_cloud_ws_sanitize('p_' . $projectId);
    }

    return 'default';
}

function acx_cloud_workspace_dir(int $userId, string $wsKey): string
{
    $safe = acx_cloud_ws_sanitize($wsKey);
    $dir = acx_cloud_storage_root() . '/' . max(0, $userId) . '/' . $safe;
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
        @mkdir($dir . '/workspace', 0755, true);
        @mkdir($dir . '/logs', 0755, true);
    } elseif (!is_dir($dir . '/workspace')) {
        @mkdir($dir . '/workspace', 0755, true);
    }

    return $dir;
}

function acx_cloud_workspace_path(int $userId, string $wsKey): string
{
    return acx_cloud_workspace_dir($userId, $wsKey) . '/workspace';
}

/**
 * Bind the active request to a durable cloud workspace.
 * Agent sandbox tools will write here instead of ephemeral job dirs.
 */
function acx_cloud_workspace_bind(int $userId, ?string $projectId = null, int $conversationId = 0): array
{
    $wsKey = acx_cloud_ws_key($projectId);
    $path = acx_cloud_workspace_path($userId, $wsKey);
    $metaPath = acx_cloud_workspace_dir($userId, $wsKey) . '/session.json';
    $meta = [
        'ws_key' => $wsKey,
        'user_id' => $userId,
        'project_id' => $projectId ? (string) $projectId : null,
        'conversation_id' => $conversationId > 0 ? $conversationId : null,
        'path' => $path,
        'environment' => 'ASSISTIX Environment',
        'updated_at' => time(),
    ];
    if (is_file($metaPath)) {
        $prev = json_decode((string) @file_get_contents($metaPath), true);
        if (is_array($prev)) {
            $meta['created_at'] = (int) ($prev['created_at'] ?? time());
            if (empty($meta['conversation_id']) && !empty($prev['conversation_id'])) {
                $meta['conversation_id'] = (int) $prev['conversation_id'];
            }
        }
    } else {
        $meta['created_at'] = time();
    }
    @file_put_contents($metaPath, json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

    $GLOBALS['acx_cloud_ws'] = [
        'user_id' => $userId,
        'ws_key' => $wsKey,
        'path' => $path,
        'project_id' => $meta['project_id'],
        'conversation_id' => $meta['conversation_id'],
    ];

    return $GLOBALS['acx_cloud_ws'];
}

/** @return array{user_id:int,ws_key:string,path:string,project_id:?string,conversation_id:?int}|null */
function acx_cloud_workspace_active(): ?array
{
    $g = $GLOBALS['acx_cloud_ws'] ?? null;

    return is_array($g) && !empty($g['path']) ? $g : null;
}

function acx_cloud_workspace_active_path(int $userId): ?string
{
    $active = acx_cloud_workspace_active();
    if ($active === null) {
        return null;
    }
    if ((int) ($active['user_id'] ?? 0) !== $userId) {
        return null;
    }
    $path = (string) ($active['path'] ?? '');
    if ($path === '' || !is_dir($path)) {
        @mkdir($path, 0755, true);
    }

    return $path !== '' ? $path : null;
}

function acx_cloud_workspace_unbind(): void
{
    unset($GLOBALS['acx_cloud_ws']);
}

/**
 * List files in a durable cloud workspace (recursive-ish, flat).
 *
 * @return list<array{path:string,name:string,size:int,mtime:int,dir:bool}>
 */
function acx_cloud_workspace_list(int $userId, string $wsKey, int $limit = 200): array
{
    $ws = acx_cloud_workspace_path($userId, $wsKey);
    if (!is_dir($ws)) {
        return [];
    }
    $out = [];
    try {
        $iter = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($ws, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($iter as $fileInfo) {
            /** @var SplFileInfo $fileInfo */
            $full = $fileInfo->getPathname();
            $name = $fileInfo->getFilename();
            if (str_starts_with($name, '__ax_') || str_starts_with($name, '.')) {
                continue;
            }
            $rel = ltrim(str_replace('\\', '/', substr($full, strlen($ws))), '/');
            if ($rel === '') {
                continue;
            }
            $out[] = [
                'path' => $rel,
                'name' => $name,
                'size' => $fileInfo->isFile() ? (int) $fileInfo->getSize() : 0,
                'mtime' => (int) $fileInfo->getMTime(),
                'dir' => $fileInfo->isDir(),
            ];
            if (count($out) >= $limit) {
                break;
            }
        }
    } catch (Throwable $e) {
        return [];
    }
    usort($out, static function ($a, $b) {
        if ($a['dir'] !== $b['dir']) {
            return $a['dir'] ? -1 : 1;
        }

        return strcmp($a['path'], $b['path']);
    });

    return $out;
}

function acx_cloud_workspace_safe_file(int $userId, string $wsKey, string $rel): ?string
{
    $ws = acx_cloud_workspace_path($userId, $wsKey);
    $rel = str_replace('\\', '/', $rel);
    $rel = ltrim($rel, '/');
    if ($rel === '' || str_contains($rel, '..')) {
        return null;
    }
    $full = $ws . '/' . $rel;
    $realBase = realpath($ws);
    if ($realBase === false) {
        return null;
    }
    if (!is_file($full)) {
        return null;
    }
    $real = realpath($full);
    if ($real === false || !str_starts_with($real, $realBase)) {
        return null;
    }

    return $real;
}
