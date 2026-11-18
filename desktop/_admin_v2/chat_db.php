<?php
/**
 * Live ASSISTIX Chat + ID DB connectors for Admin Control.
 * Chat: u3354161_assistix_chat (users / conversations / messages)
 * ID:   u3354161_assistix_id   (canonical auth accounts)
 * Main: assistix.org/db.php     (reports / system_logs / Beam ingest) — loaded separately
 */
declare(strict_types=1);

function admin_chat_config(): array
{
    static $cfg;
    if (is_array($cfg)) {
        return $cfg;
    }
    $local = '/var/www/u3354161/data/www/chat.assistix.org/config.local.php';
    if (!is_readable($local)) {
        throw new RuntimeException('chat config.local.php missing');
    }
    $raw = require $local;
    $cfg = is_array($raw) ? $raw : [];
    return $cfg;
}

function admin_id_config(): array
{
    static $cfg;
    if (is_array($cfg)) {
        return $cfg;
    }
    $local = '/var/www/u3354161/data/www/id.assistix.org/config.local.php';
    if (!is_readable($local)) {
        return [];
    }
    $raw = require $local;
    $cfg = is_array($raw) ? $raw : [];
    return $cfg;
}

function admin_pdo_from_db_block(array $c): PDO
{
    $host = (string) ($c['host'] ?? '127.0.0.1');
    $port = (int) ($c['port'] ?? 3306);
    $name = (string) ($c['name'] ?? '');
    $user = (string) ($c['user'] ?? '');
    $pass = (string) ($c['pass'] ?? '');
    $charset = (string) ($c['charset'] ?? 'utf8mb4');
    if ($name === '' || $user === '') {
        throw new RuntimeException('incomplete db config');
    }
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset);
    return new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
}

function chat_pdo(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $pdo = admin_pdo_from_db_block(admin_chat_config()['db'] ?? []);
    admin_ensure_chat_moderation_schema($pdo);
    return $pdo;
}

function id_pdo(): ?PDO
{
    static $pdo;
    static $tried = false;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if ($tried) {
        return null;
    }
    $tried = true;
    try {
        $cfg = admin_id_config();
        if (empty($cfg['db']) || !is_array($cfg['db'])) {
            return null;
        }
        $pdo = admin_pdo_from_db_block($cfg['db']);
        return $pdo;
    } catch (Throwable $e) {
        $pdo = null;
        return null;
    }
}

function admin_ensure_chat_moderation_schema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    // Force-logout support for chat PHP sessions
    $cols = [];
    try {
        foreach ($pdo->query('SHOW COLUMNS FROM users') as $c) {
            $cols[(string) $c['Field']] = true;
        }
    } catch (Throwable $e) {
        return;
    }
    if (!isset($cols['force_logout_at'])) {
        $pdo->exec('ALTER TABLE users ADD COLUMN force_logout_at DATETIME NULL DEFAULT NULL AFTER updated_at');
    }
    if (!isset($cols['is_banned'])) {
        $pdo->exec('ALTER TABLE users ADD COLUMN is_banned TINYINT(1) NOT NULL DEFAULT 0 AFTER force_logout_at');
    }
    if (!isset($cols['ban_reason'])) {
        $pdo->exec('ALTER TABLE users ADD COLUMN ban_reason VARCHAR(255) NOT NULL DEFAULT \'\' AFTER is_banned');
    }

    $pdo->exec("CREATE TABLE IF NOT EXISTS api_request_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NULL DEFAULT NULL,
        conversation_id BIGINT UNSIGNED NULL DEFAULT NULL,
        message_id BIGINT UNSIGNED NULL DEFAULT NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'user',
        model VARCHAR(64) NOT NULL DEFAULT '',
        provider VARCHAR(64) NOT NULL DEFAULT '',
        content_preview VARCHAR(500) NOT NULL DEFAULT '',
        meta_json JSON NULL,
        source VARCHAR(32) NOT NULL DEFAULT 'chat',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_created (created_at DESC),
        KEY idx_user (user_id, created_at DESC),
        KEY idx_conv (conversation_id),
        KEY idx_message (message_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_actions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        admin_username VARCHAR(100) NOT NULL DEFAULT '',
        action VARCHAR(64) NOT NULL,
        target_type VARCHAR(32) NOT NULL DEFAULT '',
        target_id VARCHAR(64) NOT NULL DEFAULT '',
        detail_json JSON NULL,
        ip_address VARCHAR(64) NOT NULL DEFAULT '',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_created (created_at DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Trigger: persist every new message as a moderation request/response log
    try {
        $exists = $pdo->query("SELECT COUNT(*) FROM information_schema.TRIGGERS
            WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'trg_messages_api_request_log'")->fetchColumn();
        if ((int) $exists === 0) {
            $pdo->exec("CREATE TRIGGER trg_messages_api_request_log
                AFTER INSERT ON messages
                FOR EACH ROW
                INSERT INTO api_request_logs (user_id, conversation_id, message_id, role, model, provider, content_preview, meta_json, source, created_at)
                SELECT c.user_id, NEW.conversation_id, NEW.id, NEW.role, IFNULL(NEW.model,''),
                       IFNULL(JSON_UNQUOTE(JSON_EXTRACT(NEW.meta_json, '$.provider')), ''),
                       LEFT(NEW.content, 500), NEW.meta_json, 'chat', NEW.created_at
                FROM conversations c WHERE c.id = NEW.conversation_id");
        }
    } catch (Throwable $e) {
        // Trigger may fail on shared hosting privileges — non-fatal; backfill still works
    }

    // One-time / incremental backfill from messages not yet logged
    try {
        $pdo->exec("INSERT INTO api_request_logs (user_id, conversation_id, message_id, role, model, provider, content_preview, meta_json, source, created_at)
            SELECT c.user_id, m.conversation_id, m.id, m.role, IFNULL(m.model,''),
                   IFNULL(JSON_UNQUOTE(JSON_EXTRACT(m.meta_json, '$.provider')), ''),
                   LEFT(m.content, 500), m.meta_json, 'backfill', m.created_at
            FROM messages m
            INNER JOIN conversations c ON c.id = m.conversation_id
            LEFT JOIN api_request_logs l ON l.message_id = m.id
            WHERE l.id IS NULL
            ORDER BY m.id ASC
            LIMIT 2000");
    } catch (Throwable $e) {
        // ignore
    }
}

function admin_audit(PDO $chat, string $action, string $targetType = '', $targetId = '', $detail = null): void
{
    try {
        $chat->prepare('INSERT INTO admin_actions (admin_username, action, target_type, target_id, detail_json, ip_address)
            VALUES (?,?,?,?,?,?)')->execute([
            (string) ($_SESSION['admin_username'] ?? 'admin'),
            $action,
            $targetType,
            (string) $targetId,
            $detail === null ? null : json_encode($detail, JSON_UNESCAPED_UNICODE),
            (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
        ]);
    } catch (Throwable $e) {
        // never break moderation API on audit failure
    }
}
