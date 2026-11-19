<?php
session_start();
require __DIR__ . '/auth_check.php';
require __DIR__ . '/../db.php';       // $pdo — assistix.org main DB (reports / logs / Beam)
require __DIR__ . '/chat_db.php';    // chat_pdo() + id_pdo() — live chat + ID accounts

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? ($_POST['action'] ?? '');
$input = [];
if ($method === 'POST' || $method === 'PUT' || $method === 'DELETE') {
    $raw = file_get_contents('php://input');
    $json = json_decode($raw ?: '[]', true);
    if (is_array($json)) $input = $json;
    $input = array_merge($_POST, $input);
    if (!$action && isset($input['action'])) $action = $input['action'];
}

function ok($data = [], $extra = []) {
    echo json_encode(array_merge(['ok' => true, 'data' => $data], $extra), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
function qcount(PDO $db, string $sql): int {
    try { return (int)$db->query($sql)->fetchColumn(); } catch (Throwable $e) { return 0; }
}

try {
    $chat = chat_pdo();
    $id = id_pdo();

    switch ($action) {

    case 'me':
        ok([
            'username' => $_SESSION['admin_username'] ?? '',
            'display' => $_SESSION['admin_display'] ?? 'Admin',
            'login_at' => $_SESSION['admin_login_at'] ?? null,
            'sources' => [
                'chat_db' => $chat->query('SELECT DATABASE()')->fetchColumn(),
                'main_db' => $pdo->query('SELECT DATABASE()')->fetchColumn(),
                'id_db' => $id ? $id->query('SELECT DATABASE()')->fetchColumn() : null,
            ],
        ]);

    case 'overview':
        $users = qcount($chat, 'SELECT COUNT(*) FROM users');
        $chats = qcount($chat, 'SELECT COUNT(*) FROM conversations');
        $msgs = qcount($chat, 'SELECT COUNT(*) FROM messages');
        $attachments = qcount($chat, 'SELECT COUNT(*) FROM attachments');
        $apiRequests = qcount($chat, 'SELECT COUNT(*) FROM api_request_logs');
        $idAccounts = $id ? qcount($id, 'SELECT COUNT(*) FROM users') : 0;
        $banned = qcount($chat, 'SELECT COUNT(*) FROM users WHERE is_banned=1');

        $reportsPending = qcount($pdo, "SELECT COUNT(*) FROM user_reports WHERE status='pending'");
        $reportsAll = qcount($pdo, 'SELECT COUNT(*) FROM user_reports');
        $logsErr = qcount($pdo, "SELECT COUNT(*) FROM system_logs WHERE level IN ('ERROR','CRITICAL','error','critical')");
        $logsAll = qcount($pdo, 'SELECT COUNT(*) FROM system_logs');
        $beamReports = qcount($pdo, "SELECT COUNT(*) FROM user_reports WHERE subject LIKE 'Beam%' OR message LIKE '%source=beam%' OR message LIKE '%Beam%'");

        $usersToday = qcount($chat, 'SELECT COUNT(*) FROM users WHERE created_at >= CURDATE()');
        $msgsToday = qcount($chat, 'SELECT COUNT(*) FROM messages WHERE created_at >= CURDATE()');
        $chatsToday = qcount($chat, 'SELECT COUNT(*) FROM conversations WHERE created_at >= CURDATE()');

        $recentUsers = $chat->query('SELECT id, email, display_name, subscription_tier, last_login_at, created_at, is_banned FROM users ORDER BY id DESC LIMIT 8')->fetchAll();
        $recentReports = $pdo->query('SELECT id, report_type, subject, status, created_at FROM user_reports ORDER BY id DESC LIMIT 8')->fetchAll();
        $recentLogs = $pdo->query('SELECT id, level, message, created_at FROM system_logs ORDER BY id DESC LIMIT 10')->fetchAll();
        $recentChats = $chat->query('SELECT c.id, c.title, c.model, c.updated_at, u.email FROM conversations c LEFT JOIN users u ON u.id=c.user_id ORDER BY c.updated_at DESC LIMIT 8')->fetchAll();

        $spark = [];
        try {
            $rows = $chat->query("SELECT DATE(created_at) d, COUNT(*) c FROM messages WHERE created_at >= CURDATE() - INTERVAL 13 DAY GROUP BY DATE(created_at) ORDER BY d")->fetchAll();
            $map = [];
            foreach ($rows as $r) $map[$r['d']] = (int)$r['c'];
            for ($i = 13; $i >= 0; $i--) {
                $d = date('Y-m-d', strtotime("-{$i} day"));
                $spark[] = ['day' => $d, 'count' => $map[$d] ?? 0];
            }
        } catch (Throwable $e) {}

        ok([
            'stats' => [
                'users' => $users,
                'chats' => $chats,
                'msgs' => $msgs,
                'attachments' => $attachments,
                'apiRequests' => $apiRequests,
                'idAccounts' => $idAccounts,
                'banned' => $banned,
                'reportsPending' => $reportsPending,
                'reportsAll' => $reportsAll,
                'logsErr' => $logsErr,
                'logsAll' => $logsAll,
                'beamReports' => $beamReports,
                'usersToday' => $usersToday,
                'msgsToday' => $msgsToday,
                'chatsToday' => $chatsToday,
                'sessions' => 0,
                'failedLogins' => 0,
                'source' => 'chat.assistix.org',
            ],
            'recentUsers' => $recentUsers,
            'recentReports' => $recentReports,
            'recentLogs' => $recentLogs,
            'recentChats' => $recentChats,
            'spark' => $spark,
        ]);

    case 'users':
        $q = trim((string)($_GET['q'] ?? ''));
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(100, max(10, (int)($_GET['limit'] ?? 30)));
        $offset = ($page - 1) * $limit;
        $where = '1=1';
        $params = [];
        if ($q !== '') {
            $where .= ' AND (u.email LIKE ? OR CAST(u.id AS CHAR)=? OR CAST(u.id_user_id AS CHAR)=? OR u.display_name LIKE ?)';
            $like = '%' . $q . '%';
            $params = [$like, $q, $q, $like];
        }
        $sql = "SELECT u.id, u.id_user_id, u.email, u.display_name, u.avatar_url, u.subscription_tier,
                       u.email_verified, u.last_login_at, u.created_at, u.is_banned, u.ban_reason,
                       (SELECT COUNT(*) FROM conversations c WHERE c.user_id=u.id) AS chats,
                       (SELECT COUNT(*) FROM messages m INNER JOIN conversations c2 ON c2.id=m.conversation_id WHERE c2.user_id=u.id) AS messages
                FROM users u
                WHERE $where
                ORDER BY u.id DESC
                LIMIT $limit OFFSET $offset";
        $stmt = $chat->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['oauth_provider'] = 'assistix-id';
            $row['username'] = $row['display_name'];
            $row['active_sessions'] = 0;
        }
        unset($row);
        $cstmt = $chat->prepare("SELECT COUNT(*) FROM users u WHERE $where");
        $cstmt->execute($params);
        ok(['items' => $rows, 'total' => (int)$cstmt->fetchColumn(), 'page' => $page, 'limit' => $limit, 'source' => 'chat']);

    case 'user.get':
        $idUser = (int)($_GET['id'] ?? 0);
        if ($idUser <= 0) fail('id required');
        $u = $chat->prepare('SELECT * FROM users WHERE id=?');
        $u->execute([$idUser]);
        $user = $u->fetch();
        if (!$user) fail('not found', 404);
        $user['oauth_provider'] = 'assistix-id';
        $chats = $chat->prepare('SELECT id, title, model, created_at, updated_at, is_pinned, is_ephemeral FROM conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 50');
        $chats->execute([$idUser]);
        $mem = $chat->prepare('SELECT id, content, source, created_at, updated_at FROM user_memories WHERE user_id=? ORDER BY updated_at DESC LIMIT 40');
        $mem->execute([$idUser]);
        $usage = $chat->prepare('SELECT * FROM weekly_usage WHERE user_id=? ORDER BY week_start DESC LIMIT 12');
        $usage->execute([$idUser]);
        $reqs = $chat->prepare('SELECT id, role, model, provider, content_preview, created_at FROM api_request_logs WHERE user_id=? ORDER BY id DESC LIMIT 40');
        $reqs->execute([$idUser]);

        $idProfile = null;
        if ($id && !empty($user['id_user_id'])) {
            try {
                $st = $id->prepare('SELECT id, email, display_name, avatar_url, email_verified, created_at FROM users WHERE id=?');
                $st->execute([(int)$user['id_user_id']]);
                $idProfile = $st->fetch() ?: null;
                if ($idProfile) {
                    $oi = $id->prepare('SELECT provider, provider_sub, created_at FROM oauth_identities WHERE user_id=?');
                    $oi->execute([(int)$user['id_user_id']]);
                    $idProfile['oauth'] = $oi->fetchAll();
                }
            } catch (Throwable $e) {}
        }
        // Beam Agent dialogs + central quotas (main assistix.org DB)
        $beamSessions = [];
        $beamUsage = null;
        $beamLimits = null;
        $beamWeek = null;
        $idUid = (int)($user['id_user_id'] ?? 0);
        $email = strtolower(trim((string)($user['email'] ?? '')));
        try {
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
            $where = [];
            $params = [];
            if ($idUid > 0) { $where[] = 'id_user_id=?'; $params[] = $idUid; }
            if ($email !== '') { $where[] = 'email=?'; $params[] = $email; }
            if ($where) {
                $sql = 'SELECT id, session_key, title, model, product, message_count, last_message_at, created_at, updated_at
                        FROM beam_dialog_sessions WHERE ' . implode(' OR ', $where) . ' ORDER BY updated_at DESC LIMIT 80';
                $bst = $pdo->prepare($sql);
                $bst->execute($params);
                $beamSessions = $bst->fetchAll();
            }
        } catch (Throwable $e) {}
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS beam_weekly_usage (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                id_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
                email VARCHAR(255) NOT NULL DEFAULT '',
                week_start DATE NOT NULL,
                tide_used INT UNSIGNED NOT NULL DEFAULT 0,
                flare_used INT UNSIGNED NOT NULL DEFAULT 0,
                pine_used INT UNSIGNED NOT NULL DEFAULT 0,
                tide_limit INT UNSIGNED NOT NULL DEFAULT 500000,
                flare_limit INT UNSIGNED NOT NULL DEFAULT 100000,
                pine_limit INT UNSIGNED NOT NULL DEFAULT 10000,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_beam_week_user (id_user_id, week_start),
                UNIQUE KEY uq_beam_week_email (email, week_start)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            $pdo->exec("CREATE TABLE IF NOT EXISTS beam_user_limits (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                id_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
                email VARCHAR(255) NOT NULL DEFAULT '',
                tide_limit INT UNSIGNED NULL DEFAULT NULL,
                flare_limit INT UNSIGNED NULL DEFAULT NULL,
                pine_limit INT UNSIGNED NULL DEFAULT NULL,
                unlimited TINYINT(1) NOT NULL DEFAULT 0,
                tide_unlimited TINYINT(1) NOT NULL DEFAULT 0,
                flare_unlimited TINYINT(1) NOT NULL DEFAULT 0,
                pine_unlimited TINYINT(1) NOT NULL DEFAULT 0,
                note VARCHAR(255) NOT NULL DEFAULT '',
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_beam_lim_user (id_user_id),
                UNIQUE KEY uq_beam_lim_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            try {
                $chk = $pdo->query("SHOW COLUMNS FROM beam_user_limits LIKE 'tide_unlimited'");
                if (!$chk->fetch()) {
                    $pdo->exec("ALTER TABLE beam_user_limits
                        ADD COLUMN tide_unlimited TINYINT(1) NOT NULL DEFAULT 0 AFTER unlimited,
                        ADD COLUMN flare_unlimited TINYINT(1) NOT NULL DEFAULT 0 AFTER tide_unlimited,
                        ADD COLUMN pine_unlimited TINYINT(1) NOT NULL DEFAULT 0 AFTER flare_unlimited");
                }
            } catch (Throwable $e) {}
            $week = (new DateTimeImmutable('now', new DateTimeZone('UTC')));
            $dow = (int)$week->format('N');
            $weekStart = $week->modify('-' . ($dow - 1) . ' days')->format('Y-m-d');
            $add = $dow === 1 ? 7 : (8 - $dow);
            $resetAt = $week->modify("+{$add} days")->setTime(0, 0, 0)->format(DateTimeInterface::ATOM);
            $beamWeek = [
                'week_start' => $weekStart,
                'reset_at' => $resetAt,
                'week_boundary' => 'monday_00_00_utc',
                'defaults' => ['tide' => 500000, 'flare' => 100000, 'pine' => 10000],
            ];
            $urow = null;
            if ($idUid > 0) {
                $st = $pdo->prepare('SELECT * FROM beam_weekly_usage WHERE id_user_id=? AND week_start=? LIMIT 1');
                $st->execute([$idUid, $weekStart]);
                $urow = $st->fetch() ?: null;
            }
            if (!$urow && $email !== '') {
                $st = $pdo->prepare('SELECT * FROM beam_weekly_usage WHERE email=? AND week_start=? LIMIT 1');
                $st->execute([$email, $weekStart]);
                $urow = $st->fetch() ?: null;
            }
            $beamUsage = $urow;
            if ($idUid > 0) {
                $st = $pdo->prepare('SELECT * FROM beam_user_limits WHERE id_user_id=? LIMIT 1');
                $st->execute([$idUid]);
                $beamLimits = $st->fetch() ?: null;
            }
            if (!$beamLimits && $email !== '') {
                $st = $pdo->prepare('SELECT * FROM beam_user_limits WHERE email=? LIMIT 1');
                $st->execute([$email]);
                $beamLimits = $st->fetch() ?: null;
            }
        } catch (Throwable $e) {}

        ok([
            'user' => $user,
            'chats' => $chats->fetchAll(),
            'memories' => $mem->fetchAll(),
            'usage' => $usage->fetchAll(),
            'requests' => $reqs->fetchAll(),
            'id_profile' => $idProfile,
            'beam_sessions' => $beamSessions,
            'beam_usage' => $beamUsage,
            'beam_limits' => $beamLimits,
            'beam_week' => $beamWeek ?? [
                'week_start' => null,
                'reset_at' => null,
                'week_boundary' => 'monday_00_00_utc',
                'defaults' => ['tide' => 500000, 'flare' => 100000, 'pine' => 10000],
            ],
            'security' => [],
            'sessions' => [],
        ]);

    case 'beam.session.get':
        $sid = (int)($_GET['id'] ?? 0);
        if ($sid <= 0) fail('id required');
        try {
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
                KEY idx_sess (session_id, id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        } catch (Throwable $e) {}
        $s = $pdo->prepare('SELECT * FROM beam_dialog_sessions WHERE id=?');
        $s->execute([$sid]);
        $sess = $s->fetch();
        if (!$sess) fail('not found', 404);
        $m = $pdo->prepare('SELECT id, role, content, model, tokens_in, tokens_out, turn_id, created_at FROM beam_dialog_messages WHERE session_id=? ORDER BY id ASC LIMIT 1000');
        $m->execute([$sid]);
        ok(['session' => $sess, 'messages' => $m->fetchAll(), 'product' => 'beam-agent']);

    case 'beam.limits.set':
        if ($method !== 'POST') fail('POST only');
        $idUid = (int)($input['id_user_id'] ?? 0);
        $email = strtolower(trim((string)($input['email'] ?? '')));
        if ($idUid <= 0 && $email === '') fail('id_user_id or email required');
        $tide = array_key_exists('tide_limit', $input) ? max(0, (int)$input['tide_limit']) : null;
        $flare = array_key_exists('flare_limit', $input) ? max(0, (int)$input['flare_limit']) : null;
        $pine = array_key_exists('pine_limit', $input) ? max(0, (int)$input['pine_limit']) : null;
        $unlimited = !empty($input['unlimited']) ? 1 : 0;
        $tideU = !empty($input['tide_unlimited']) ? 1 : 0;
        $flareU = !empty($input['flare_unlimited']) ? 1 : 0;
        $pineU = !empty($input['pine_unlimited']) ? 1 : 0;
        if ($unlimited) { $tideU = 1; $flareU = 1; $pineU = 1; }
        if ($tideU && $flareU && $pineU) $unlimited = 1;
        $note = mb_substr(trim((string)($input['note'] ?? '')), 0, 255);
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS beam_user_limits (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                id_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
                email VARCHAR(255) NOT NULL DEFAULT '',
                tide_limit INT UNSIGNED NULL DEFAULT NULL,
                flare_limit INT UNSIGNED NULL DEFAULT NULL,
                pine_limit INT UNSIGNED NULL DEFAULT NULL,
                unlimited TINYINT(1) NOT NULL DEFAULT 0,
                tide_unlimited TINYINT(1) NOT NULL DEFAULT 0,
                flare_unlimited TINYINT(1) NOT NULL DEFAULT 0,
                pine_unlimited TINYINT(1) NOT NULL DEFAULT 0,
                note VARCHAR(255) NOT NULL DEFAULT '',
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_beam_lim_user (id_user_id),
                UNIQUE KEY uq_beam_lim_email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            try {
                $chk = $pdo->query("SHOW COLUMNS FROM beam_user_limits LIKE 'tide_unlimited'");
                if (!$chk->fetch()) {
                    $pdo->exec("ALTER TABLE beam_user_limits
                        ADD COLUMN tide_unlimited TINYINT(1) NOT NULL DEFAULT 0 AFTER unlimited,
                        ADD COLUMN flare_unlimited TINYINT(1) NOT NULL DEFAULT 0 AFTER tide_unlimited,
                        ADD COLUMN pine_unlimited TINYINT(1) NOT NULL DEFAULT 0 AFTER flare_unlimited");
                }
            } catch (Throwable $e) {}
            $pdo->prepare(
                'INSERT INTO beam_user_limits
                 (id_user_id, email, tide_limit, flare_limit, pine_limit, unlimited, tide_unlimited, flare_unlimited, pine_unlimited, note)
                 VALUES (?,?,?,?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE
                   email=VALUES(email),
                   tide_limit=COALESCE(VALUES(tide_limit), tide_limit),
                   flare_limit=COALESCE(VALUES(flare_limit), flare_limit),
                   pine_limit=COALESCE(VALUES(pine_limit), pine_limit),
                   unlimited=VALUES(unlimited),
                   tide_unlimited=VALUES(tide_unlimited),
                   flare_unlimited=VALUES(flare_unlimited),
                   pine_unlimited=VALUES(pine_unlimited),
                   note=VALUES(note)'
            )->execute([
                $idUid > 0 ? $idUid : null,
                $email !== '' ? $email : ('id:' . $idUid),
                $tide, $flare, $pine,
                $unlimited, $tideU, $flareU, $pineU,
                $note,
            ]);
            // Patch current week limits too
            $week = (new DateTimeImmutable('now', new DateTimeZone('UTC')));
            $dow = (int)$week->format('N');
            $weekStart = $week->modify('-' . ($dow - 1) . ' days')->format('Y-m-d');
            if ($idUid > 0) {
                $pdo->prepare('UPDATE beam_weekly_usage SET tide_limit=COALESCE(?,tide_limit), flare_limit=COALESCE(?,flare_limit), pine_limit=COALESCE(?,pine_limit) WHERE id_user_id=? AND week_start=?')
                    ->execute([$tide, $flare, $pine, $idUid, $weekStart]);
            }
            if ($email !== '') {
                $pdo->prepare('UPDATE beam_weekly_usage SET tide_limit=COALESCE(?,tide_limit), flare_limit=COALESCE(?,flare_limit), pine_limit=COALESCE(?,pine_limit) WHERE email=? AND week_start=?')
                    ->execute([$tide, $flare, $pine, $email, $weekStart]);
            }
        } catch (Throwable $e) {
            fail('limits save failed: ' . $e->getMessage(), 500);
        }
        admin_audit($chat, 'beam.limits.set', 'beam_user', $idUid ?: $email, [
            'tide' => $tide, 'flare' => $flare, 'pine' => $pine,
            'unlimited' => $unlimited,
            'tide_unlimited' => $tideU, 'flare_unlimited' => $flareU, 'pine_unlimited' => $pineU,
        ]);
        ok(['saved' => true]);

    case 'beam.usage.reset':
        if ($method !== 'POST') fail('POST only');
        $idUid = (int)($input['id_user_id'] ?? 0);
        $email = strtolower(trim((string)($input['email'] ?? '')));
        $week = (new DateTimeImmutable('now', new DateTimeZone('UTC')));
        $dow = (int)$week->format('N');
        $weekStart = $week->modify('-' . ($dow - 1) . ' days')->format('Y-m-d');
        if ($idUid > 0) {
            $pdo->prepare('UPDATE beam_weekly_usage SET tide_used=0, flare_used=0, pine_used=0 WHERE id_user_id=? AND week_start=?')
                ->execute([$idUid, $weekStart]);
        }
        if ($email !== '') {
            $pdo->prepare('UPDATE beam_weekly_usage SET tide_used=0, flare_used=0, pine_used=0 WHERE email=? AND week_start=?')
                ->execute([$email, $weekStart]);
        }
        admin_audit($chat, 'beam.usage.reset', 'beam_user', $idUid ?: $email);
        ok(['reset' => true]);

    case 'user.delete':
        if ($method !== 'POST') fail('POST only');
        $uid = (int)($input['id'] ?? 0);
        if ($uid <= 0) fail('id required');
        $chat->prepare('DELETE FROM users WHERE id=?')->execute([$uid]);
        admin_audit($chat, 'user.delete', 'user', $uid);
        ok(['deleted' => $uid]);

    case 'user.ban':
        if ($method !== 'POST') fail('POST only');
        $uid = (int)($input['id'] ?? 0);
        $reason = trim((string)($input['reason'] ?? 'banned by admin'));
        if ($uid <= 0) fail('id required');
        $chat->prepare('UPDATE users SET is_banned=1, ban_reason=?, force_logout_at=NOW() WHERE id=?')->execute([$reason, $uid]);
        admin_audit($chat, 'user.ban', 'user', $uid, ['reason' => $reason]);
        ok(['banned' => $uid]);

    case 'user.unban':
        if ($method !== 'POST') fail('POST only');
        $uid = (int)($input['id'] ?? 0);
        if ($uid <= 0) fail('id required');
        $chat->prepare("UPDATE users SET is_banned=0, ban_reason='' WHERE id=?")->execute([$uid]);
        admin_audit($chat, 'user.unban', 'user', $uid);
        ok(['unbanned' => $uid]);

    case 'user.terminate_sessions':
        if ($method !== 'POST') fail('POST only');
        $uid = (int)($input['id'] ?? 0);
        if ($uid <= 0) fail('id required');
        $chat->prepare('UPDATE users SET force_logout_at=NOW() WHERE id=?')->execute([$uid]);
        // Clear ID oauth handoffs if linked
        try {
            $st = $chat->prepare('SELECT id_user_id FROM users WHERE id=?');
            $st->execute([$uid]);
            $idUid = (int)$st->fetchColumn();
            if ($id && $idUid > 0) {
                $id->prepare('DELETE FROM oauth_handoffs WHERE user_id=?')->execute([$idUid]);
            }
        } catch (Throwable $e) {}
        admin_audit($chat, 'user.terminate_sessions', 'user', $uid);
        ok(['terminated' => true, 'note' => 'force_logout_at set — chat session invalidated on next API call']);

    case 'chats':
        $q = trim((string)($_GET['q'] ?? ''));
        $page = max(1, (int)($_GET['page'] ?? 1));
        $limit = min(100, max(10, (int)($_GET['limit'] ?? 30)));
        $offset = ($page - 1) * $limit;
        $where = '1=1';
        $params = [];
        if ($q !== '') {
            $where .= ' AND (c.title LIKE ? OR u.email LIKE ? OR CAST(c.id AS CHAR)=? OR c.model LIKE ?)';
            $like = '%' . $q . '%';
            $params = [$like, $like, $q, $like];
        }
        $sql = "SELECT c.id, c.user_id, c.title, c.model, c.created_at, c.updated_at, c.is_pinned, c.is_ephemeral, u.email, u.display_name,
                       (SELECT COUNT(*) FROM messages m WHERE m.conversation_id=c.id) AS message_count
                FROM conversations c
                LEFT JOIN users u ON u.id=c.user_id
                WHERE $where
                ORDER BY c.updated_at DESC
                LIMIT $limit OFFSET $offset";
        $stmt = $chat->prepare($sql);
        $stmt->execute($params);
        $cstmt = $chat->prepare("SELECT COUNT(*) FROM conversations c LEFT JOIN users u ON u.id=c.user_id WHERE $where");
        $cstmt->execute($params);
        ok(['items' => $stmt->fetchAll(), 'total' => (int)$cstmt->fetchColumn(), 'page' => $page, 'source' => 'chat']);

    case 'chat.get':
        $cid = (int)($_GET['id'] ?? 0);
        if ($cid <= 0) fail('id required');
        $c = $chat->prepare('SELECT c.*, u.email, u.display_name FROM conversations c LEFT JOIN users u ON u.id=c.user_id WHERE c.id=?');
        $c->execute([$cid]);
        $chatRow = $c->fetch();
        if (!$chatRow) fail('not found', 404);
        $m = $chat->prepare('SELECT id, role, content, model, meta_json, attachments_json, created_at FROM messages WHERE conversation_id=? ORDER BY id ASC LIMIT 800');
        $m->execute([$cid]);
        ok(['chat' => $chatRow, 'messages' => $m->fetchAll()]);

    case 'chat.delete':
        if ($method !== 'POST') fail('POST only');
        $cid = (int)($input['id'] ?? 0);
        if ($cid <= 0) fail('id required');
        $chat->prepare('DELETE FROM api_request_logs WHERE conversation_id=?')->execute([$cid]);
        $chat->prepare('DELETE FROM messages WHERE conversation_id=?')->execute([$cid]);
        $chat->prepare('DELETE FROM conversations WHERE id=?')->execute([$cid]);
        admin_audit($chat, 'chat.delete', 'chat', $cid);
        ok(['deleted' => $cid]);

    case 'requests':
        $q = trim((string)($_GET['q'] ?? ''));
        $where = '1=1';
        $params = [];
        if ($q !== '') {
            $where .= ' AND (content_preview LIKE ? OR model LIKE ? OR provider LIKE ? OR CAST(user_id AS CHAR)=?)';
            $like = '%' . $q . '%';
            $params = [$like, $like, $like, $q];
        }
        $stmt = $chat->prepare("SELECT r.*, u.email FROM api_request_logs r LEFT JOIN users u ON u.id=r.user_id WHERE $where ORDER BY r.id DESC LIMIT 200");
        $stmt->execute($params);
        ok(['items' => $stmt->fetchAll(), 'source' => 'chat']);

    case 'reports':
        $status = $_GET['status'] ?? 'all';
        $q = trim((string)($_GET['q'] ?? ''));
        $where = '1=1';
        $params = [];
        if ($status !== 'all') { $where .= ' AND r.status=?'; $params[] = $status; }
        if ($q !== '') {
            $where .= ' AND (r.subject LIKE ? OR r.message LIKE ? OR u.email LIKE ?)';
            $like = '%' . $q . '%';
            array_push($params, $like, $like, $like);
        }
        $sql = "SELECT r.*, u.email FROM user_reports r LEFT JOIN users u ON u.id=r.user_id WHERE $where ORDER BY r.id DESC LIMIT 200";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        ok(['items' => $stmt->fetchAll()]);

    case 'report.resolve':
        if ($method !== 'POST') fail('POST only');
        $rid = (int)($input['id'] ?? 0);
        $pdo->prepare("UPDATE user_reports SET status='resolved', resolved_at=NOW(), resolved_by=? WHERE id=?")
            ->execute([$_SESSION['admin_username'] ?? 'admin', $rid]);
        admin_audit($chat, 'report.resolve', 'report', $rid);
        ok(['resolved' => $rid]);

    case 'report.delete':
        if ($method !== 'POST') fail('POST only');
        $rid = (int)($input['id'] ?? 0);
        $pdo->prepare('DELETE FROM user_reports WHERE id=?')->execute([$rid]);
        admin_audit($chat, 'report.delete', 'report', $rid);
        ok(['deleted' => $rid]);

    case 'logs':
        $level = $_GET['level'] ?? 'all';
        $q = trim((string)($_GET['q'] ?? ''));
        $where = '1=1';
        $params = [];
        if ($level !== 'all') { $where .= ' AND level=?'; $params[] = $level; }
        if ($q !== '') { $where .= ' AND (message LIKE ? OR context LIKE ?)'; $like='%'.$q.'%'; array_push($params,$like,$like); }
        $stmt = $pdo->prepare("SELECT * FROM system_logs WHERE $where ORDER BY id DESC LIMIT 250");
        $stmt->execute($params);
        ok(['items' => $stmt->fetchAll()]);

    case 'logs.clear':
        if ($method !== 'POST') fail('POST only');
        $pdo->exec('DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL 30 DAY');
        admin_audit($chat, 'logs.clear', 'system_logs', 'old30d');
        ok(['cleared_old' => true]);

    case 'security':
        $failed = [];
        $events = [];
        try { $failed = $pdo->query('SELECT * FROM login_history WHERE success=0 ORDER BY id DESC LIMIT 80')->fetchAll(); } catch (Throwable $e) {}
        try { $events = $pdo->query('SELECT * FROM security_log ORDER BY id DESC LIMIT 80')->fetchAll(); } catch (Throwable $e) {}
        $actions = $chat->query('SELECT * FROM admin_actions ORDER BY id DESC LIMIT 80')->fetchAll();
        $banned = $chat->query('SELECT id, email, display_name, ban_reason, force_logout_at, updated_at FROM users WHERE is_banned=1 OR force_logout_at IS NOT NULL ORDER BY updated_at DESC LIMIT 80')->fetchAll();
        $idUsers = [];
        if ($id) {
            try {
                $idUsers = $id->query('SELECT id, email, display_name, email_verified, created_at FROM users ORDER BY id DESC LIMIT 40')->fetchAll();
            } catch (Throwable $e) {}
        }
        ok([
            'failed_logins' => $failed,
            'events' => $events,
            'active_sessions' => [],
            'admin_actions' => $actions,
            'forced_logouts' => $banned,
            'id_accounts' => $idUsers,
        ]);

    case 'session.kill':
        if ($method !== 'POST') fail('POST only');
        // Prefer chat user id via force_logout
        $sid = (string)($input['id'] ?? '');
        if ($sid === '') fail('id required');
        if (ctype_digit($sid)) {
            $chat->prepare('UPDATE users SET force_logout_at=NOW() WHERE id=?')->execute([(int)$sid]);
            admin_audit($chat, 'session.kill', 'user', $sid);
            ok(['killed' => $sid]);
        }
        fail('unknown session id');

    case 'db.tables':
        $tables = [];
        foreach ($chat->query('SHOW TABLES') as $r) {
            $name = array_values($r)[0];
            $cnt = qcount($chat, 'SELECT COUNT(*) FROM `' . str_replace('`','',$name) . '`');
            $tables[] = ['name' => $name, 'rows' => $cnt, 'db' => 'chat'];
        }
        foreach ($pdo->query('SHOW TABLES') as $r) {
            $name = array_values($r)[0];
            // Only surface moderation-relevant main tables to avoid noise
            if (!preg_match('/^(user_reports|system_logs|admin_settings|login_history|security_log|sessions|beam_)/', $name)) continue;
            $cnt = qcount($pdo, 'SELECT COUNT(*) FROM `' . str_replace('`','',$name) . '`');
            $tables[] = ['name' => $name, 'rows' => $cnt, 'db' => 'main'];
        }
        if ($id) {
            foreach ($id->query('SHOW TABLES') as $r) {
                $name = array_values($r)[0];
                $cnt = qcount($id, 'SELECT COUNT(*) FROM `' . str_replace('`','',$name) . '`');
                $tables[] = ['name' => 'id:' . $name, 'rows' => $cnt, 'db' => 'id'];
            }
        }
        ok(['tables' => $tables]);

    case 'db.describe':
        $t = (string)($_GET['table'] ?? '');
        $dbName = 'chat';
        $target = $chat;
        if (str_starts_with($t, 'id:')) {
            $dbName = 'id';
            $t = substr($t, 3);
            $target = $id;
            if (!$target) fail('id db unavailable', 500);
        } elseif (preg_match('/^(user_reports|system_logs|admin_settings|login_history|security_log|sessions|beam_)/', $t)) {
            $dbName = 'main';
            $target = $pdo;
        }
        $t = preg_replace('/[^a-zA-Z0-9_]/', '', $t);
        if ($t === '') fail('table required');
        $cols = $target->query("DESCRIBE `$t`")->fetchAll();
        $sample = $target->query("SELECT * FROM `$t` ORDER BY 1 DESC LIMIT 25")->fetchAll();
        ok(['table' => $t, 'db' => $dbName, 'columns' => $cols, 'sample' => $sample]);

    case 'search':
        $q = trim((string)($_GET['q'] ?? ''));
        if (mb_strlen($q) < 2) fail('query too short');
        $like = '%' . $q . '%';
        $users = $chat->prepare('SELECT id, email, display_name, created_at FROM users WHERE email LIKE ? OR display_name LIKE ? ORDER BY id DESC LIMIT 20');
        $users->execute([$like, $like]);
        $msgs = $chat->prepare('SELECT m.id, m.role, m.content, m.created_at, m.conversation_id, m.model FROM messages m WHERE m.content LIKE ? ORDER BY m.id DESC LIMIT 30');
        $msgs->execute([$like]);
        $reports = $pdo->prepare('SELECT id, subject, status, created_at FROM user_reports WHERE subject LIKE ? OR message LIKE ? ORDER BY id DESC LIMIT 20');
        $reports->execute([$like, $like]);
        ok(['users' => $users->fetchAll(), 'messages' => $msgs->fetchAll(), 'reports' => $reports->fetchAll()]);

    case 'settings.get':
        $pdo->exec("CREATE TABLE IF NOT EXISTS admin_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");
        $rows = $pdo->query('SELECT setting_key, setting_value, updated_at FROM admin_settings')->fetchAll();
        $map = [];
        foreach ($rows as $r) $map[$r['setting_key']] = $r['setting_value'];
        ok(['settings' => $map, 'defaults' => [
            'maintenance' => '0',
            'beam_ingest_enabled' => '1',
            'notes' => '',
            'live_source' => 'chat.assistix.org / u3354161_assistix_chat',
        ]]);

    case 'settings.set':
        if ($method !== 'POST') fail('POST only');
        $pdo->exec("CREATE TABLE IF NOT EXISTS admin_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");
        $key = preg_replace('/[^a-zA-Z0-9_\-.]/', '', (string)($input['key'] ?? ''));
        $val = (string)($input['value'] ?? '');
        if ($key === '') fail('key required');
        $stmt = $pdo->prepare('INSERT INTO admin_settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)');
        $stmt->execute([$key, $val]);
        ok(['saved' => $key]);

    default:
        fail('unknown action', 404);
    }
} catch (Throwable $e) {
    fail($e->getMessage(), 500);
}
