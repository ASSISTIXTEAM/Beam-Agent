<?php
declare(strict_types=1);

/**
 * Beam Agent — persistence for agent runs (agent_runs / agent_run_steps).
 * Additive only: never touches conversations/messages.
 */

function acx_agent_run_begin(int $userId, string $jobId, string $modelKey, string $task, int $convId = 0): int
{
    if ($userId <= 0 || $jobId === '') {
        return 0;
    }
    try {
        $pdo = acx_db();
        $pdo->prepare(
            'INSERT INTO agent_runs (user_id, conversation_id, job_id, model, status, task, started_at)
             VALUES (?,?,?,?,?,?,NOW())
             ON DUPLICATE KEY UPDATE status = "running", started_at = NOW()'
        )->execute([
            $userId,
            $convId > 0 ? $convId : null,
            mb_substr($jobId, 0, 40),
            mb_substr($modelKey, 0, 32),
            'running',
            mb_substr($task, 0, 4000),
        ]);
        $id = (int) $pdo->lastInsertId();
        if ($id > 0) {
            return $id;
        }
        $st = $pdo->prepare('SELECT id FROM agent_runs WHERE job_id = ? LIMIT 1');
        $st->execute([mb_substr($jobId, 0, 40)]);

        return (int) ($st->fetchColumn() ?: 0);
    } catch (Throwable $e) {
        return 0;
    }
}

/** @param list<array<string,mixed>> $steps */
function acx_agent_run_finish(int $runId, string $status, array $steps, string $error = ''): void
{
    if ($runId <= 0) {
        return;
    }
    try {
        $pdo = acx_db();
        if ($steps !== []) {
            $pdo->prepare('DELETE FROM agent_run_steps WHERE run_id = ?')->execute([$runId]);
            $ins = $pdo->prepare(
                'INSERT INTO agent_run_steps (run_id, seq, kind, tool, payload, duration_ms) VALUES (?,?,?,?,?,?)'
            );
            $seq = 0;
            foreach ($steps as $st) {
                $tool = (string) ($st['tool'] ?? '');
                $thought = trim((string) ($st['thought'] ?? ''));
                if ($thought !== '') {
                    $ins->execute([$runId, ++$seq, 'think', null,
                        json_encode(['text' => mb_substr($thought, 0, 4000)], JSON_UNESCAPED_UNICODE), null]);
                }
                if ($tool !== '') {
                    $ins->execute([$runId, ++$seq, 'tool_call', mb_substr($tool, 0, 64),
                        json_encode($st['args'] ?? [], JSON_UNESCAPED_UNICODE), null]);
                    $ins->execute([$runId, ++$seq, 'tool_result', mb_substr($tool, 0, 64),
                        json_encode($st['result'] ?? [], JSON_UNESCAPED_UNICODE), null]);
                }
            }
        }
        $pdo->prepare(
            'UPDATE agent_runs SET status = ?, finished_at = NOW(), error = ? WHERE id = ?'
        )->execute([
            in_array($status, ['done', 'failed', 'cancelled', 'running'], true) ? $status : 'done',
            $error !== '' ? mb_substr($error, 0, 2000) : null,
            $runId,
        ]);
    } catch (Throwable $e) {
        // logging must never break the stream
    }
}
