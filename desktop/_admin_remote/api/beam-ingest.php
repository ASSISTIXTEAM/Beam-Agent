<?php
/**
 * Beam Agent → ASSISTIX Admin ingest.
 * Accepts crashes, turn errors, feedback, ratings from desktop bridge / clients.
 * Shows up under Admin → Reports and Admin → System Logs.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Beam-Ingest-Key');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST only']);
    exit;
}

$EXPECTED = getenv('BEAM_INGEST_KEY') ?: 'beam-assistix-ingest-2026-teal';
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$keyHeader = $_SERVER['HTTP_X_BEAM_INGEST_KEY'] ?? '';
$token = '';
if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) $token = trim($m[1]);
elseif ($keyHeader !== '') $token = trim($keyHeader);
elseif (isset($_GET['key'])) $token = trim((string)$_GET['key']);

if (!hash_equals($EXPECTED, $token)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'unauthorized']);
    exit;
}

$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '[]', true);
if (!is_array($body)) $body = [];

// Allow batch: { events: [...] } or a single event object
$events = [];
if (isset($body['events']) && is_array($body['events'])) {
    $events = $body['events'];
} else {
    $events = [$body];
}

$dbCandidates = [
    __DIR__ . '/../../db.php',                 // assistix.org/admin/api
    __DIR__ . '/../db.php',                    // assistix.org/api
    '/var/www/u3354161/data/www/assistix.org/db.php',
];
$dbLoaded = false;
foreach ($dbCandidates as $dbPath) {
    if (is_file($dbPath)) {
        require_once $dbPath;
        $dbLoaded = true;
        break;
    }
}
if (!$dbLoaded || !isset($pdo)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'db unavailable']);
    exit;
}

// Ensure tables exist (same as admin UI pages) + Beam dialog moderation store
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            report_type VARCHAR(50),
            subject VARCHAR(255),
            message TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP NULL,
            resolved_by VARCHAR(255),
            INDEX idx_status (status)
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS system_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            level VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            context TEXT,
            ip_address VARCHAR(45),
            user_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_level (level),
            INDEX idx_created (created_at)
        )
    ");
    $pdo->exec("CREATE TABLE IF NOT EXISTS beam_dialog_sessions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        session_key VARCHAR(128) NOT NULL,
        id_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
        email VARCHAR(255) NOT NULL DEFAULT '',
        title VARCHAR(255) NOT NULL DEFAULT '',
        model VARCHAR(64) NOT NULL DEFAULT '',
        product VARCHAR(32) NOT NULL DEFAULT 'beam-agent',
        message_count INT UNSIGNED NOT NULL DEFAULT 0,
        last_message_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_beam_session (session_key),
        KEY idx_beam_user (id_user_id, updated_at),
        KEY idx_beam_email (email, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS beam_dialog_messages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        session_id BIGINT UNSIGNED NOT NULL,
        id_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
        email VARCHAR(255) NOT NULL DEFAULT '',
        role VARCHAR(16) NOT NULL,
        content MEDIUMTEXT NOT NULL,
        model VARCHAR(64) NOT NULL DEFAULT '',
        tokens_in INT UNSIGNED NOT NULL DEFAULT 0,
        tokens_out INT UNSIGNED NOT NULL DEFAULT 0,
        turn_id VARCHAR(64) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sess (session_id, id),
        KEY idx_user (id_user_id, created_at),
        KEY idx_email (email, created_at),
        KEY idx_turn (turn_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
} catch (Throwable $e) {
    // continue — tables may already exist with FKs
}

$ip = $_SERVER['REMOTE_ADDR'] ?? null;
$inserted = ['reports' => 0, 'logs' => 0, 'dialogs' => 0];
$errors = [];

function beam_plain_text($v): string {
    if (is_string($v)) return trim($v);
    if (!is_array($v)) return '';
    $parts = [];
    foreach ($v as $b) {
        if (is_string($b)) { $parts[] = $b; continue; }
        if (!is_array($b)) continue;
        $t = $b['type'] ?? '';
        if ($t === 'text' || isset($b['text'])) $parts[] = (string)($b['text'] ?? '');
        // skip image / file / tool binary payloads
    }
    return trim(implode("\n", $parts));
}

foreach ($events as $ev) {
    if (!is_array($ev)) continue;
    $kind = strtolower((string)($ev['kind'] ?? $ev['type'] ?? 'error'));
    $level = strtoupper((string)($ev['level'] ?? ''));
    $subject = trim((string)($ev['subject'] ?? $ev['title'] ?? ''));
    $message = trim((string)($ev['message'] ?? $ev['text'] ?? $ev['detail'] ?? ''));
    $email = trim((string)($ev['email'] ?? $ev['user_email'] ?? ''));
    $userId = isset($ev['user_id']) ? intval($ev['user_id']) : (isset($ev['id_user_id']) ? intval($ev['id_user_id']) : null);
    $meta = $ev['meta'] ?? $ev['context'] ?? null;
    if (is_array($meta) || is_object($meta)) {
        $meta = json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        $meta = $meta !== null ? (string)$meta : null;
    }

    $source = (string)($ev['source'] ?? 'beam-agent');
    $appVer = (string)($ev['app_version'] ?? $ev['version'] ?? '');
    $model = (string)($ev['model'] ?? '');
    $sessionId = (string)($ev['session_id'] ?? $ev['session_key'] ?? '');

    // Silent dialog persistence (text only — no files/media)
    if (in_array($kind, ['dialog_turn', 'chat_turn', 'beam_dialog'], true)) {
        $sessionKey = $sessionId !== '' ? $sessionId : ('anon_' . substr(hash('sha256', $email . '|' . ($userId ?? 0) . '|' . date('Y-m-d')), 0, 24));
        $userText = beam_plain_text($ev['user_text'] ?? $ev['user'] ?? $ev['prompt'] ?? '');
        $asstText = beam_plain_text($ev['assistant_text'] ?? $ev['assistant'] ?? $ev['response'] ?? '');
        if ($userText === '' && $asstText === '') {
            $errors[] = 'dialog: empty text';
            continue;
        }
        // Cap sizes — moderation text only
        if (mb_strlen($userText) > 100000) $userText = mb_substr($userText, 0, 100000) . '…';
        if (mb_strlen($asstText) > 200000) $asstText = mb_substr($asstText, 0, 200000) . '…';
        $tokensIn = max(0, (int)($ev['tokens_in'] ?? $ev['input_tokens'] ?? 0));
        $tokensOut = max(0, (int)($ev['tokens_out'] ?? $ev['output_tokens'] ?? 0));
        $turnId = substr(trim((string)($ev['turn_id'] ?? '')), 0, 64);
        $title = trim((string)($ev['title'] ?? ''));
        if ($title === '' && $userText !== '') $title = mb_substr(preg_replace('/\s+/', ' ', $userText), 0, 80);
        try {
            $st = $pdo->prepare('SELECT id FROM beam_dialog_sessions WHERE session_key=? LIMIT 1');
            $st->execute([$sessionKey]);
            $sid = (int)($st->fetchColumn() ?: 0);
            if ($sid <= 0) {
                $ins = $pdo->prepare(
                    'INSERT INTO beam_dialog_sessions (session_key, id_user_id, email, title, model, product, message_count, last_message_at)
                     VALUES (?,?,?,?,?,?,0,NOW())'
                );
                $ins->execute([$sessionKey, $userId ?: null, $email, $title, $model, 'beam-agent']);
                $sid = (int)$pdo->lastInsertId();
            } else {
                $pdo->prepare(
                    'UPDATE beam_dialog_sessions SET
                        id_user_id=COALESCE(?, id_user_id),
                        email=IF(email="", ?, email),
                        title=IF(title="", ?, title),
                        model=IF(?<>"", ?, model),
                        last_message_at=NOW()
                     WHERE id=?'
                )->execute([$userId ?: null, $email, $title, $model, $model, $sid]);
            }
            $msgIns = $pdo->prepare(
                'INSERT INTO beam_dialog_messages
                 (session_id, id_user_id, email, role, content, model, tokens_in, tokens_out, turn_id)
                 VALUES (?,?,?,?,?,?,?,?,?)'
            );
            $added = 0;
            if ($userText !== '') {
                $msgIns->execute([$sid, $userId ?: null, $email, 'user', $userText, $model, $tokensIn, 0, $turnId]);
                $added++;
            }
            if ($asstText !== '') {
                $msgIns->execute([$sid, $userId ?: null, $email, 'assistant', $asstText, $model, 0, $tokensOut, $turnId]);
                $added++;
            }
            if ($added > 0) {
                $pdo->prepare('UPDATE beam_dialog_sessions SET message_count = message_count + ?, last_message_at=NOW() WHERE id=?')
                    ->execute([$added, $sid]);
            }
            $inserted['dialogs'] += $added;
        } catch (Throwable $e) {
            $errors[] = 'dialog: ' . $e->getMessage();
        }
        continue; // do not also dump full dialog into reports
    }

    $contextBits = array_filter([
        $meta,
        $email !== '' ? ('email=' . $email) : null,
        $source !== '' ? ('source=' . $source) : null,
        $appVer !== '' ? ('version=' . $appVer) : null,
        $model !== '' ? ('model=' . $model) : null,
        $sessionId !== '' ? ('session=' . $sessionId) : null,
    ]);
    $context = implode(' | ', $contextBits);

    // Map Beam kinds → admin report_type / log level
    $reportTypes = [
        'feedback' => 'feature',
        'rating' => 'feature',
        'thumbs_up' => 'feature',
        'thumbs_down' => 'content',
        'bug' => 'bug',
        'crash' => 'bug',
        'error' => 'bug',
        'turn_failed' => 'bug',
        'complaint' => 'content',
        'report' => 'content',
    ];
    $asReport = in_array($kind, array_keys($reportTypes), true)
        || !empty($ev['as_report'])
        || in_array($kind, ['feedback', 'rating', 'crash', 'turn_failed', 'bug', 'complaint'], true);

    if ($asReport) {
        $rtype = $reportTypes[$kind] ?? 'bug';
        if ($subject === '') {
            $subject = match ($kind) {
                'feedback' => 'Beam feedback',
                'rating', 'thumbs_up', 'thumbs_down' => 'Beam rating',
                'crash' => 'Beam crash',
                'turn_failed' => 'Beam turn failed',
                default => 'Beam report: ' . $kind,
            };
        }
        if ($message === '') $message = $subject;
        $fullMsg = $message;
        if ($context !== '') $fullMsg .= "\n\n---\n" . $context;
        try {
            // user_id may violate FK if unknown — prefer NULL
            $uid = null;
            $stmt = $pdo->prepare(
                "INSERT INTO user_reports (user_id, report_type, subject, message, status) VALUES (?, ?, ?, ?, 'pending')"
            );
            $stmt->execute([$uid, $rtype, mb_substr($subject, 0, 255), $fullMsg]);
            $inserted['reports']++;
        } catch (Throwable $e) {
            $errors[] = 'report: ' . $e->getMessage();
        }
    }

    // Always also land in system_logs for monitoring
    if ($level === '') {
        $level = match ($kind) {
            'crash', 'error', 'turn_failed' => 'ERROR',
            'warning' => 'WARNING',
            'feedback', 'rating', 'thumbs_up', 'thumbs_down' => 'INFO',
            default => 'INFO',
        };
    }
    $logMsg = $subject !== '' ? ($subject . ($message !== '' && $message !== $subject ? (': ' . $message) : '')) : ($message !== '' ? $message : ('Beam event ' . $kind));
    try {
        $stmt = $pdo->prepare(
            "INSERT INTO system_logs (level, message, context, ip_address, user_id) VALUES (?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            mb_substr($level, 0, 20),
            $logMsg,
            $context !== '' ? $context : null,
            $ip,
            null,
        ]);
        $inserted['logs']++;
    } catch (Throwable $e) {
        $errors[] = 'log: ' . $e->getMessage();
    }
}

echo json_encode([
    'ok' => empty($errors),
    'inserted' => $inserted,
    'errors' => $errors,
]);
