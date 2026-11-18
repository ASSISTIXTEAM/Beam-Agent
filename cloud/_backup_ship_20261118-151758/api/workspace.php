<?php
declare(strict_types=1);

/**
 * Beam Agent — workspace / Process panel state.
 * GET ?conversation_id=N&project_id=… → runs, steps, durable cloud files
 */

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/agent.php';
require_once dirname(__DIR__) . '/lib/agent_sandbox.php';
require_once dirname(__DIR__) . '/lib/cloud_workspace.php';
require_once dirname(__DIR__) . '/lib/projects.php';

$logged = acx_logged_user();
if ($logged === null) {
    acx_json_out(['success' => false, 'error' => 'auth_required'], 401);
}

$uid = (int) $logged['internal_id'];
$convId = isset($_GET['conversation_id']) ? (int) $_GET['conversation_id'] : 0;
$projectId = trim((string) ($_GET['project_id'] ?? ''));
$pdo = acx_db();

// Resolve project from conversation attachment if not provided.
if ($projectId === '' && $convId > 0) {
    $pdata = acx_projects_load($uid);
    foreach ($pdata['projects'] as $p) {
        if (in_array($convId, $p['session_ids'] ?? [], true)) {
            $projectId = (string) $p['id'];
            break;
        }
    }
}

$wsKey = acx_cloud_ws_key($projectId !== '' ? $projectId : null);
$cloud = acx_cloud_workspace_bind($uid, $projectId !== '' ? $projectId : null, $convId);

$conv = null;
if ($convId > 0) {
    $st = $pdo->prepare('SELECT id, title, model, updated_at FROM conversations WHERE id = ? AND user_id = ?');
    $st->execute([$convId, $uid]);
    $conv = $st->fetch() ?: null;
}

if ($conv) {
    $st = $pdo->prepare(
        'SELECT id, job_id, model, status, task, tokens_in, tokens_out, started_at, finished_at, created_at
           FROM agent_runs WHERE user_id = ? AND conversation_id = ? ORDER BY id DESC LIMIT 20'
    );
    $st->execute([$uid, (int) $conv['id']]);
} else {
    $st = $pdo->prepare(
        'SELECT id, job_id, model, status, task, tokens_in, tokens_out, started_at, finished_at, created_at
           FROM agent_runs WHERE user_id = ? ORDER BY id DESC LIMIT 20'
    );
    $st->execute([$uid]);
}
$runs = $st->fetchAll() ?: [];

$steps = [];
$latest = $runs[0] ?? null;
if ($latest) {
    $st = $pdo->prepare(
        'SELECT seq, kind, tool, payload, duration_ms, created_at
           FROM agent_run_steps WHERE run_id = ? ORDER BY seq ASC LIMIT 400'
    );
    $st->execute([(int) $latest['id']]);
    foreach ($st->fetchAll() ?: [] as $row) {
        $p = (string) ($row['payload'] ?? '');
        $decoded = json_decode($p, true);
        $row['payload'] = is_array($decoded) ? $decoded : $p;
        $steps[] = $row;
    }
}

// Prefer durable cloud workspace files; fall back to last job dir.
$files = acx_cloud_workspace_list($uid, $wsKey, 200);
if ($files === [] && $latest) {
    $jobId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $latest['job_id']);
    if ($jobId !== '' && function_exists('acx_agent_fs_list')) {
        $legacy = acx_agent_fs_list($uid, $jobId, '.', 200);
        foreach ($legacy as $f) {
            $files[] = [
                'path' => (string) ($f['path'] ?? ''),
                'name' => basename((string) ($f['path'] ?? 'file')),
                'size' => (int) ($f['size'] ?? 0),
                'mtime' => (int) ($f['mtime'] ?? 0),
                'dir' => !empty($f['dir']),
            ];
        }
    }
}

// Attach download URLs for non-dir files.
foreach ($files as &$f) {
    if (empty($f['dir']) && !empty($f['path'])) {
        $f['url'] = '/api/cloud_file.php?ws=' . rawurlencode($wsKey)
            . '&path=' . rawurlencode((string) $f['path']);
    }
}
unset($f);

acx_json_out([
    'success' => true,
    'conversation' => $conv,
    'runs' => $runs,
    'steps' => $steps,
    'files' => $files,
    'cloud_session' => [
        'ws_key' => $wsKey,
        'project_id' => $projectId !== '' ? $projectId : null,
        'path_label' => 'cloud/' . $uid . '/' . $wsKey . '/workspace',
        'durable' => true,
    ],
    'environment' => 'ASSISTIX Environment',
]);
