<?php
declare(strict_types=1);

/**
 * Beam Agent — workspace state for the UI panel.
 * GET ?conversation_id=N  → runs, last run steps, files tree
 */

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/agent.php';
require_once dirname(__DIR__) . '/lib/agent_sandbox.php';

$logged = acx_logged_user();
if ($logged === null) {
    acx_json_out(['success' => false, 'error' => 'auth_required'], 401);
}

$uid = (int) $logged['internal_id'];
$convId = isset($_GET['conversation_id']) ? (int) $_GET['conversation_id'] : 0;
$pdo = acx_db();

$conv = null;
if ($convId > 0) {
    $st = $pdo->prepare('SELECT id, title, model, updated_at FROM conversations WHERE id = ? AND user_id = ?');
    $st->execute([$convId, $uid]);
    $conv = $st->fetch() ?: null;
}

// Runs for this conversation (or the user's latest runs when no conversation is given)
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
$files = [];
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

    $jobId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $latest['job_id']);
    if ($jobId !== '') {
        $files = acx_agent_fs_list($uid, $jobId, '.', 200);
    }
}

acx_json_out([
    'success' => true,
    'conversation' => $conv,
    'runs' => $runs,
    'steps' => $steps,
    'files' => $files,
    'environment' => 'ASSISTIX Environment',
]);
