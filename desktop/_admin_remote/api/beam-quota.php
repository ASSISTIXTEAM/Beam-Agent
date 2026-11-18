<?php
/**
 * Central Beam Agent weekly quotas — server is source of truth (anti-cheat).
 * Keys: ASSISTIX ID user id and/or email. Week = Monday 00:00 UTC.
 * Actions: get | check | charge | set_limits (admin key same as ingest).
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Beam-Ingest-Key');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
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

$dbCandidates = [
    __DIR__ . '/../../db.php',
    __DIR__ . '/../db.php',
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

/** Default weekly token caps (Beam Agent desktop product). */
const BEAM_DEFAULT_LIMITS = [
    'tide' => 1000000,
    'flare' => 100000,
    'pine' => 10000,
];

function beam_week_start_utc(): string {
    $dt = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $dow = (int)$dt->format('N');
    return $dt->modify('-' . ($dow - 1) . ' days')->format('Y-m-d');
}

function beam_next_reset_iso(): string {
    $dt = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $dow = (int)$dt->format('N');
    $add = $dow === 1 ? 7 : (8 - $dow);
    return $dt->modify("+{$add} days")->setTime(0, 0, 0)->format(DateTimeInterface::ATOM);
}

function beam_ensure_quota_schema(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $pdo->exec("CREATE TABLE IF NOT EXISTS beam_weekly_usage (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
        email VARCHAR(255) NOT NULL DEFAULT '',
        week_start DATE NOT NULL,
        tide_used INT UNSIGNED NOT NULL DEFAULT 0,
        flare_used INT UNSIGNED NOT NULL DEFAULT 0,
        pine_used INT UNSIGNED NOT NULL DEFAULT 0,
        tide_limit INT UNSIGNED NOT NULL DEFAULT 1000000,
        flare_limit INT UNSIGNED NOT NULL DEFAULT 100000,
        pine_limit INT UNSIGNED NOT NULL DEFAULT 10000,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_beam_week_user (id_user_id, week_start),
        UNIQUE KEY uq_beam_week_email (email, week_start),
        KEY idx_email (email),
        KEY idx_week (week_start)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS beam_user_limits (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        id_user_id BIGINT UNSIGNED NULL DEFAULT NULL,
        email VARCHAR(255) NOT NULL DEFAULT '',
        tide_limit INT UNSIGNED NULL DEFAULT NULL,
        flare_limit INT UNSIGNED NULL DEFAULT NULL,
        pine_limit INT UNSIGNED NULL DEFAULT NULL,
        unlimited TINYINT(1) NOT NULL DEFAULT 0,
        note VARCHAR(255) NOT NULL DEFAULT '',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_beam_lim_user (id_user_id),
        UNIQUE KEY uq_beam_lim_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // One-shot: column defaults + migrate legacy product caps + clear inflated pine burns.
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS beam_quota_migrations (
            id VARCHAR(64) NOT NULL,
            applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        $migId = 'limits_v2_tide1m_flare100k_pine10k';
        $st = $pdo->prepare('SELECT id FROM beam_quota_migrations WHERE id=? LIMIT 1');
        $st->execute([$migId]);
        if (!$st->fetch(PDO::FETCH_ASSOC)) {
            try {
                $pdo->exec("ALTER TABLE beam_weekly_usage
                    MODIFY tide_limit INT UNSIGNED NOT NULL DEFAULT 1000000,
                    MODIFY flare_limit INT UNSIGNED NOT NULL DEFAULT 100000,
                    MODIFY pine_limit INT UNSIGNED NOT NULL DEFAULT 10000");
            } catch (Throwable $e) {}
            // Only rewrite limits that still match known legacy defaults (preserve custom admin overrides).
            $pdo->exec("UPDATE beam_weekly_usage SET tide_limit=1000000 WHERE tide_limit IN (500000)");
            $pdo->exec("UPDATE beam_weekly_usage SET flare_limit=100000 WHERE flare_limit IN (50000, 10000)");
            $pdo->exec("UPDATE beam_weekly_usage SET pine_limit=10000 WHERE pine_limit IN (50000, 1000)");
            $pdo->exec("UPDATE beam_user_limits SET tide_limit=1000000 WHERE tide_limit IN (500000)");
            $pdo->exec("UPDATE beam_user_limits SET flare_limit=100000 WHERE flare_limit IN (50000, 10000)");
            $pdo->exec("UPDATE beam_user_limits SET pine_limit=10000 WHERE pine_limit IN (50000, 1000)");
            // Undo inflated pine burns from tool-schema re-billing (often used==50000 old cap).
            $week = beam_week_start_utc();
            $pdo->prepare("UPDATE beam_weekly_usage SET pine_used=0
                WHERE week_start=? AND pine_used >= 5000")
                ->execute([$week]);
            $pdo->prepare('INSERT INTO beam_quota_migrations (id) VALUES (?)')->execute([$migId]);
        }
    } catch (Throwable $e) {}
}

function beam_norm_tier(string $tier): string {
    $t = strtolower(trim($tier));
    if ($t === 'flair') return 'flare';
    if (in_array($t, ['tide', 'flare', 'pine'], true)) return $t;
    return 'tide';
}

/** @return array{tide:int,flare:int,pine:int,unlimited:bool} */
function beam_resolve_limits(PDO $pdo, ?int $idUserId, string $email): array {
    $lim = BEAM_DEFAULT_LIMITS;
    $unlimited = false;
    try {
        if ($idUserId && $idUserId > 0) {
            $st = $pdo->prepare('SELECT * FROM beam_user_limits WHERE id_user_id=? LIMIT 1');
            $st->execute([$idUserId]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
            if (!$row && $email !== '') {
                $st = $pdo->prepare('SELECT * FROM beam_user_limits WHERE email=? LIMIT 1');
                $st->execute([$email]);
                $row = $st->fetch(PDO::FETCH_ASSOC);
            }
        } elseif ($email !== '') {
            $st = $pdo->prepare('SELECT * FROM beam_user_limits WHERE email=? LIMIT 1');
            $st->execute([$email]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
        } else {
            $row = false;
        }
        if (is_array($row)) {
            if (!empty($row['unlimited'])) $unlimited = true;
            foreach (['tide', 'flare', 'pine'] as $k) {
                $col = $k . '_limit';
                if (isset($row[$col]) && $row[$col] !== null && $row[$col] !== '') {
                    $lim[$k] = max(0, (int)$row[$col]);
                }
            }
        }
    } catch (Throwable $e) {}
    return [
        'tide' => $lim['tide'],
        'flare' => $lim['flare'],
        'pine' => $lim['pine'],
        'unlimited' => $unlimited,
    ];
}

/**
 * Load or create week row. Prefer id_user_id; fall back to email.
 * @return array<string,mixed>
 */
function beam_get_or_create_usage(PDO $pdo, ?int $idUserId, string $email): array {
    $week = beam_week_start_utc();
    $limits = beam_resolve_limits($pdo, $idUserId, $email);
    $row = null;

    if ($idUserId && $idUserId > 0) {
        $st = $pdo->prepare('SELECT * FROM beam_weekly_usage WHERE id_user_id=? AND week_start=? LIMIT 1');
        $st->execute([$idUserId, $week]);
        $row = $st->fetch(PDO::FETCH_ASSOC) ?: null;
    }
    if (!$row && $email !== '') {
        $st = $pdo->prepare('SELECT * FROM beam_weekly_usage WHERE email=? AND week_start=? LIMIT 1');
        $st->execute([$email, $week]);
        $row = $st->fetch(PDO::FETCH_ASSOC) ?: null;
        // Attach id_user_id if we now know it
        if ($row && $idUserId && $idUserId > 0 && empty($row['id_user_id'])) {
            try {
                $pdo->prepare('UPDATE beam_weekly_usage SET id_user_id=? WHERE id=?')->execute([$idUserId, $row['id']]);
                $row['id_user_id'] = $idUserId;
            } catch (Throwable $e) {}
        }
    }

    if (!$row) {
        $ins = $pdo->prepare(
            'INSERT INTO beam_weekly_usage
             (id_user_id, email, week_start, tide_used, flare_used, pine_used, tide_limit, flare_limit, pine_limit)
             VALUES (?,?,?,0,0,0,?,?,?)'
        );
        try {
            $ins->execute([
                ($idUserId && $idUserId > 0) ? $idUserId : null,
                $email,
                $week,
                $limits['tide'],
                $limits['flare'],
                $limits['pine'],
            ]);
        } catch (Throwable $e) {
            // race on unique — re-read
        }
        if ($idUserId && $idUserId > 0) {
            $st = $pdo->prepare('SELECT * FROM beam_weekly_usage WHERE id_user_id=? AND week_start=? LIMIT 1');
            $st->execute([$idUserId, $week]);
            $row = $st->fetch(PDO::FETCH_ASSOC) ?: null;
        }
        if (!$row && $email !== '') {
            $st = $pdo->prepare('SELECT * FROM beam_weekly_usage WHERE email=? AND week_start=? LIMIT 1');
            $st->execute([$email, $week]);
            $row = $st->fetch(PDO::FETCH_ASSOC) ?: null;
        }
        if (!$row) {
            $row = [
                'id' => 0,
                'id_user_id' => $idUserId,
                'email' => $email,
                'week_start' => $week,
                'tide_used' => 0,
                'flare_used' => 0,
                'pine_used' => 0,
                'tide_limit' => $limits['tide'],
                'flare_limit' => $limits['flare'],
                'pine_limit' => $limits['pine'],
            ];
        }
    }

    // Keep limits columns synced to override/defaults (used is never reset except new week)
    foreach (['tide', 'flare', 'pine'] as $k) {
        $want = (int)$limits[$k];
        if ((int)($row[$k . '_limit'] ?? 0) !== $want) {
            try {
                if (!empty($row['id'])) {
                    $pdo->prepare("UPDATE beam_weekly_usage SET {$k}_limit=? WHERE id=?")->execute([$want, $row['id']]);
                }
            } catch (Throwable $e) {}
            $row[$k . '_limit'] = $want;
        }
    }
    $row['_unlimited'] = $limits['unlimited'];
    return $row;
}

function beam_usage_payload(array $row): array {
    $unlimited = !empty($row['_unlimited']);
    $out = [
        'week_start' => $row['week_start'] ?? beam_week_start_utc(),
        'reset_at' => beam_next_reset_iso(),
        'unlimited' => $unlimited,
        'quotas' => [],
    ];
    foreach (['tide', 'flare', 'pine'] as $k) {
        $limit = $unlimited ? 2147483647 : (int)($row[$k . '_limit'] ?? BEAM_DEFAULT_LIMITS[$k]);
        $used = (int)($row[$k . '_used'] ?? 0);
        $out['quotas'][$k] = [
            'used' => $used,
            'limit' => $limit,
            'remaining' => max(0, $limit - $used),
        ];
    }
    return $out;
}

beam_ensure_quota_schema($pdo);

$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '[]', true);
if (!is_array($body)) $body = [];
$action = strtolower((string)($_GET['action'] ?? $body['action'] ?? 'get'));

$idUserId = isset($body['id_user_id']) ? (int)$body['id_user_id'] : (isset($_GET['id_user_id']) ? (int)$_GET['id_user_id'] : 0);
if ($idUserId <= 0 && isset($body['user_id'])) $idUserId = (int)$body['user_id'];
$email = strtolower(trim((string)($body['email'] ?? $_GET['email'] ?? '')));

if ($idUserId <= 0 && $email === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'id_user_id or email required']);
    exit;
}
// Avoid empty-email unique collisions when only id_user_id is known
if ($email === '' && $idUserId > 0) {
    $email = 'id:' . $idUserId;
}

try {
    if ($action === 'get' || $action === 'check') {
        $row = beam_get_or_create_usage($pdo, $idUserId > 0 ? $idUserId : null, $email);
        $payload = beam_usage_payload($row);
        $tier = beam_norm_tier((string)($body['tier'] ?? $_GET['tier'] ?? ''));
        $ok = true;
        $exhausted = null;
        if ($action === 'check' && $tier !== '' && empty($payload['unlimited'])) {
            $q = $payload['quotas'][$tier];
            if ($q['used'] >= $q['limit']) {
                $ok = false;
                $exhausted = $tier;
            }
        }
        echo json_encode([
            'ok' => $ok,
            'exhausted' => $exhausted,
            'id_user_id' => $idUserId ?: ($row['id_user_id'] ?? null),
            'email' => $email ?: ($row['email'] ?? ''),
            'server' => true,
            'source_of_truth' => true,
        ] + $payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    if ($action === 'charge') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'POST only']);
            exit;
        }
        $tier = beam_norm_tier((string)($body['tier'] ?? 'tide'));
        // Cap single charge so a buggy client cannot wipe a weekly bucket in one call.
        $tokens = max(1, min(250000, (int)($body['tokens'] ?? $body['total_tokens'] ?? 1)));
        $colUsed = $tier . '_used';
        $colLimit = $tier . '_limit';

        $pdo->beginTransaction();
        $row = beam_get_or_create_usage($pdo, $idUserId > 0 ? $idUserId : null, $email);
        if (!empty($row['_unlimited'])) {
            $pdo->commit();
            echo json_encode(['ok' => true, 'charged' => 0, 'unlimited' => true] + beam_usage_payload($row), JSON_UNESCAPED_UNICODE);
            exit;
        }
        $used = (int)($row[$colUsed] ?? 0);
        $limit = (int)($row[$colLimit] ?? BEAM_DEFAULT_LIMITS[$tier]);
        if ($used >= $limit) {
            $pdo->commit();
            http_response_code(402);
            echo json_encode([
                'ok' => false,
                'error' => 'insufficient_quota',
                'exhausted' => $tier,
            ] + beam_usage_payload($row), JSON_UNESCAPED_UNICODE);
            exit;
        }
        $add = min($tokens, max(0, $limit - $used));
        if (!empty($row['id'])) {
            // Atomic: only increment if still under limit
            $sql = "UPDATE beam_weekly_usage SET {$colUsed} = {$colUsed} + ?
                    WHERE id=? AND {$colUsed} < {$colLimit}";
            $st = $pdo->prepare($sql);
            $st->execute([$add, $row['id']]);
            if ($st->rowCount() < 1) {
                // re-read — may have raced to exhaust
                $st2 = $pdo->prepare('SELECT * FROM beam_weekly_usage WHERE id=?');
                $st2->execute([$row['id']]);
                $row = $st2->fetch(PDO::FETCH_ASSOC) ?: $row;
                $row['_unlimited'] = false;
                $pdo->commit();
                if ((int)($row[$colUsed] ?? 0) >= (int)($row[$colLimit] ?? 0)) {
                    http_response_code(402);
                    echo json_encode([
                        'ok' => false,
                        'error' => 'insufficient_quota',
                        'exhausted' => $tier,
                    ] + beam_usage_payload($row), JSON_UNESCAPED_UNICODE);
                    exit;
                }
            } else {
                $st2 = $pdo->prepare('SELECT * FROM beam_weekly_usage WHERE id=?');
                $st2->execute([$row['id']]);
                $row = $st2->fetch(PDO::FETCH_ASSOC) ?: $row;
                $row['_unlimited'] = false;
            }
        }
        $pdo->commit();
        echo json_encode([
            'ok' => true,
            'charged' => $add,
            'tier' => $tier,
        ] + beam_usage_payload($row), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    if ($action === 'set_limits') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'POST only']);
            exit;
        }
        $tide = isset($body['tide_limit']) ? max(0, (int)$body['tide_limit']) : null;
        $flare = isset($body['flare_limit']) ? max(0, (int)$body['flare_limit']) : null;
        $pine = isset($body['pine_limit']) ? max(0, (int)$body['pine_limit']) : null;
        $unlimited = !empty($body['unlimited']) ? 1 : 0;
        $note = mb_substr(trim((string)($body['note'] ?? '')), 0, 255);

        $pdo->prepare(
            'INSERT INTO beam_user_limits (id_user_id, email, tide_limit, flare_limit, pine_limit, unlimited, note)
             VALUES (?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               email=VALUES(email),
               tide_limit=COALESCE(VALUES(tide_limit), tide_limit),
               flare_limit=COALESCE(VALUES(flare_limit), flare_limit),
               pine_limit=COALESCE(VALUES(pine_limit), pine_limit),
               unlimited=VALUES(unlimited),
               note=VALUES(note)'
        )->execute([
            $idUserId > 0 ? $idUserId : null,
            $email,
            $tide,
            $flare,
            $pine,
            $unlimited,
            $note,
        ]);

        // Also patch current week row limits
        $row = beam_get_or_create_usage($pdo, $idUserId > 0 ? $idUserId : null, $email);
        echo json_encode(['ok' => true, 'saved' => true] + beam_usage_payload($row), JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'reset_used') {
        // Admin-only wipe of current week used counters (does not change limits)
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['ok' => false, 'error' => 'POST only']);
            exit;
        }
        $row = beam_get_or_create_usage($pdo, $idUserId > 0 ? $idUserId : null, $email);
        if (!empty($row['id'])) {
            $pdo->prepare('UPDATE beam_weekly_usage SET tide_used=0, flare_used=0, pine_used=0 WHERE id=?')
                ->execute([$row['id']]);
        }
        $row = beam_get_or_create_usage($pdo, $idUserId > 0 ? $idUserId : null, $email);
        echo json_encode(['ok' => true, 'reset' => true] + beam_usage_payload($row), JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'unknown action']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        try { $pdo->rollBack(); } catch (Throwable $e2) {}
    }
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
