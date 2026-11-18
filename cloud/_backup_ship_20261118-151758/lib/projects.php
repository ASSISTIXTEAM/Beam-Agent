<?php
declare(strict_types=1);

/**
 * Cloud projects for Beam Agent — per-account, server-side JSON store.
 */

function acx_projects_root(): string
{
    $base = dirname(__DIR__) . '/storage/projects';
    if (!is_dir($base)) {
        @mkdir($base, 0755, true);
    }

    return $base;
}

function acx_projects_path(int $userId): string
{
    return acx_projects_root() . '/u' . $userId . '.json';
}

/** @return array{projects: list<array<string,mixed>>, version:int} */
function acx_projects_load(int $userId): array
{
    $path = acx_projects_path($userId);
    if (!is_file($path)) {
        return ['version' => 1, 'projects' => []];
    }
    $j = json_decode((string) @file_get_contents($path), true);
    if (!is_array($j)) {
        return ['version' => 1, 'projects' => []];
    }
    $projects = [];
    foreach (($j['projects'] ?? []) as $p) {
        if (!is_array($p) || empty($p['id'])) {
            continue;
        }
        $pid = (string) $p['id'];
        $projects[] = [
            'id' => $pid,
            'name' => (string) ($p['name'] ?? 'Project'),
            'created_at' => (int) ($p['created_at'] ?? time()),
            'updated_at' => (int) ($p['updated_at'] ?? time()),
            'session_ids' => array_values(array_map('intval', $p['session_ids'] ?? [])),
            'workspace_key' => function_exists('acx_cloud_ws_key')
                ? acx_cloud_ws_key($pid)
                : ('p_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $pid)),
        ];
    }

    return ['version' => 1, 'projects' => $projects];
}

/** @param array{projects: list<array<string,mixed>>, version?:int} $data */
function acx_projects_save(int $userId, array $data): void
{
    $path = acx_projects_path($userId);
    $payload = [
        'version' => 1,
        'projects' => array_values($data['projects'] ?? []),
        'updated_at' => time(),
    ];
    @file_put_contents($path, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function acx_project_new_id(): string
{
    try {
        return 'p_' . bin2hex(random_bytes(8));
    } catch (Throwable $e) {
        return 'p_' . substr(md5(uniqid('', true)), 0, 16);
    }
}
