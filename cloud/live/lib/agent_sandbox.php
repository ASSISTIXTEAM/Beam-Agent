<?php
declare(strict_types=1);

/**
 * ASSISTIX Environment — per-job workspace (files + python + restricted shell).
 */

function acx_agent_storage_root(): string
{
    $root = acx_root() . '/storage/agent';
    if (!is_dir($root)) {
        @mkdir($root, 0755, true);
    }

    return $root;
}

function acx_agent_job_dir(int $userId, string $jobId): string
{
    $safeJob = preg_replace('/[^a-zA-Z0-9_-]/', '', $jobId) ?: 'job';
    $dir = acx_agent_storage_root() . '/' . max(0, $userId) . '/' . $safeJob;
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
        @mkdir($dir . '/workspace', 0755, true);
        @mkdir($dir . '/logs', 0755, true);
    }

    return $dir;
}

function acx_agent_workspace(int $userId, string $jobId): string
{
    return acx_agent_job_dir($userId, $jobId) . '/workspace';
}

/** Resolve path inside workspace; returns null if escape attempted. */
function acx_agent_safe_path(string $workspace, string $rel): ?string
{
    $rel = str_replace('\\', '/', $rel);
    $rel = ltrim($rel, '/');
    if ($rel === '' || str_contains($rel, '..')) {
        return null;
    }
    $full = $workspace . '/' . $rel;
    $realBase = realpath($workspace);
    if ($realBase === false) {
        return null;
    }
    $parent = dirname($full);
    if (!is_dir($parent)) {
        @mkdir($parent, 0755, true);
    }
    $real = realpath($parent);
    if ($real === false || !str_starts_with($real, $realBase)) {
        return null;
    }

    return $real . '/' . basename($full);
}

function acx_agent_python_bin(): string
{
    foreach (['/usr/bin/python3', '/usr/bin/python', 'python3', 'python'] as $bin) {
        if ($bin[0] === '/' && is_executable($bin)) {
            return $bin;
        }
    }

    return 'python3';
}

/**
 * @return array{ok:bool,stdout:string,stderr:string,code:int,timed_out?:bool}
 */
function acx_agent_run_process(array $cmd, string $cwd, int $timeoutSec = 20, ?string $stdin = null): array
{
    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];
    $proc = @proc_open($cmd, $descriptors, $pipes, $cwd, null);
    if (!is_resource($proc)) {
        return ['ok' => false, 'stdout' => '', 'stderr' => 'proc_open_failed', 'code' => -1];
    }
    if ($stdin !== null && $stdin !== '') {
        fwrite($pipes[0], $stdin);
    }
    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    $stdout = '';
    $stderr = '';
    $start = microtime(true);
    $timedOut = false;
    $exitCode = null;
    while (true) {
        $status = proc_get_status($proc);
        $stdout .= (string) stream_get_contents($pipes[1]);
        $stderr .= (string) stream_get_contents($pipes[2]);
        if (!$status['running']) {
            // exitcode is only reliable on the first status after exit
            if ($exitCode === null && array_key_exists('exitcode', $status) && (int) $status['exitcode'] !== -1) {
                $exitCode = (int) $status['exitcode'];
            }
            break;
        }
        if ((microtime(true) - $start) > $timeoutSec) {
            $timedOut = true;
            proc_terminate($proc, 9);
            break;
        }
        usleep(40000);
    }
    $stdout .= (string) stream_get_contents($pipes[1]);
    $stderr .= (string) stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $closed = proc_close($proc);
    if ($exitCode === null) {
        $exitCode = (int) $closed;
    }
    $stdout = mb_substr($stdout, 0, 24000);
    $stderr = mb_substr($stderr, 0, 8000);

    return [
        'ok' => !$timedOut && $exitCode === 0,
        'stdout' => $stdout,
        'stderr' => $stderr,
        'code' => (int) $exitCode,
        'timed_out' => $timedOut,
    ];
}

/**
 * @return array{ok:bool,stdout:string,stderr:string,code:int}
 */
function acx_agent_python_exec(int $userId, string $jobId, string $code, int $timeoutSec = 20): array
{
    $ws = acx_agent_workspace($userId, $jobId);
    $script = $ws . '/__ax_run.py';
    $header = "# -*- coding: utf-8 -*-\n"
        . "from __future__ import print_function\n"
        . "import os, sys\n"
        . "os.chdir(r'''" . str_replace("'", "\\'", $ws) . "''')\n"
        . "sys.path.insert(0, os.getcwd())\n";
    @file_put_contents($script, $header . "\n" . $code);
    $bin = acx_agent_python_bin();
    $res = acx_agent_run_process([$bin, '-u', $script], $ws, $timeoutSec);
    @unlink($script);

    return $res;
}

/**
 * Restricted shell in workspace. Whitelist only.
 *
 * @return array{ok:bool,stdout:string,stderr:string,code:int}
 */
function acx_agent_shell_exec(int $userId, string $jobId, string $command, int $timeoutSec = 15): array
{
    $ws = acx_agent_workspace($userId, $jobId);
    $command = trim($command);
    if ($command === '' || strlen($command) > 2000) {
        return ['ok' => false, 'stdout' => '', 'stderr' => 'bad_command', 'code' => -1];
    }
    // Block obvious escapes / dangerous tokens
    if (preg_match('/(?:^|[;&|`\$])\s*(?:rm\s+-rf\s+\/|sudo|chmod\s+777|mkfs|dd\s+if=|:\(\)|\/etc\/passwd|\/etc\/shadow)/i', $command)) {
        return ['ok' => false, 'stdout' => '', 'stderr' => 'blocked_command', 'code' => -1];
    }
    if (preg_match('/(?:\.\.\/|~\/|\/var\/|\/etc\/|\/home\/|\/root\/|C:\\\\)/i', $command)) {
        return ['ok' => false, 'stdout' => '', 'stderr' => 'path_escape_blocked', 'code' => -1];
    }

    // php нужен агенту, чтобы выполнять собственную инструкцию «проверь код через php -l».
    $allowed = '(?:python3?|php|node|ls|cat|head|tail|wc|pwd|mkdir|touch|cp|mv|echo|printf|curl|wget|pip3?|find|grep|sed|awk|sort|uniq|date|uname|whoami|file|stat|tar|unzip|zip|base64|sha256sum|md5sum|sleep|test|true|false|cd|export|env)';
    // Allow simple pipelines of whitelisted tools
    if (!preg_match('/^\s*(?:' . $allowed . ')(?:\s|<|>|$)/i', $command)
        && !preg_match('/^\s*(?:' . $allowed . ').*(?:\|\s*(?:' . $allowed . '))/i', $command)) {
        // Soft allow: still run inside workspace via bash -lc but prefix note
        // Prefer fail closed for unknown first token
        $first = preg_split('/\s+/', $command)[0] ?? '';
        if (!preg_match('/^' . $allowed . '$/i', $first)) {
            return ['ok' => false, 'stdout' => '', 'stderr' => 'command_not_in_whitelist: ' . $first, 'code' => -1];
        }
    }

    $bash = is_executable('/bin/bash') ? '/bin/bash' : 'bash';
    $wrapped = 'cd ' . escapeshellarg($ws) . ' && ' . $command;

    return acx_agent_run_process([$bash, '-lc', $wrapped], $ws, $timeoutSec);
}

/**
 * @return list<array{path:string,size:int,mtime:int}>
 */
function acx_agent_fs_list(int $userId, string $jobId, string $rel = '.', int $limit = 80): array
{
    $ws = acx_agent_workspace($userId, $jobId);
    $path = acx_agent_safe_path($ws, $rel === '.' ? '' : $rel);
    // list directory
    $dir = $rel === '.' || $rel === '' ? $ws : acx_agent_safe_path($ws, $rel);
    if ($dir === null) {
        $dir = $ws;
    }
    if (!is_dir($dir)) {
        $dir = is_file($dir) ? dirname($dir) : $ws;
    }
    $out = [];
    $it = @scandir($dir);
    if (!is_array($it)) {
        return [];
    }
    foreach ($it as $name) {
        if ($name === '.' || $name === '..' || str_starts_with($name, '__ax_')) {
            continue;
        }
        $full = $dir . '/' . $name;
        $relPath = ltrim(str_replace('\\', '/', substr($full, strlen($ws))), '/');
        $out[] = [
            'path' => $relPath,
            'size' => is_file($full) ? (int) filesize($full) : 0,
            'mtime' => (int) @filemtime($full),
            'dir' => is_dir($full),
        ];
        if (count($out) >= $limit) {
            break;
        }
    }

    return $out;
}

function acx_agent_fs_read(int $userId, string $jobId, string $rel, int $maxBytes = 12000): array
{
    $ws = acx_agent_workspace($userId, $jobId);
    $path = acx_agent_safe_path($ws, $rel);
    if ($path === null || !is_file($path)) {
        return ['ok' => false, 'error' => 'not_found'];
    }
    $raw = (string) @file_get_contents($path, false, null, 0, $maxBytes + 1);
    $truncated = strlen($raw) > $maxBytes;
    if ($truncated) {
        $raw = substr($raw, 0, $maxBytes);
    }

    return ['ok' => true, 'path' => $rel, 'content' => $raw, 'truncated' => $truncated];
}

function acx_agent_fs_write(int $userId, string $jobId, string $rel, string $content): array
{
    $ws = acx_agent_workspace($userId, $jobId);
    $path = acx_agent_safe_path($ws, $rel);
    if ($path === null) {
        return ['ok' => false, 'error' => 'bad_path'];
    }
    if (strlen($content) > 400000) {
        return ['ok' => false, 'error' => 'too_large'];
    }
    $ok = @file_put_contents($path, $content) !== false;

    return ['ok' => $ok, 'path' => $rel, 'bytes' => strlen($content)];
}
