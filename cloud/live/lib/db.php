<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

function acx_db(): PDO
{
    static $pdo;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $c = acx_config()['db'] ?? [];
    $host = (string) ($c['host'] ?? '127.0.0.1');
    $port = (int) ($c['port'] ?? 3306);
    $name = (string) ($c['name'] ?? '');
    $user = (string) ($c['user'] ?? '');
    $pass = (string) ($c['pass'] ?? '');
    $charset = (string) ($c['charset'] ?? 'utf8mb4');
    if ($name === '' || $user === '') {
        throw new RuntimeException('Database is not configured');
    }
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $name, $charset);
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    acx_migrate_schema($pdo);
    return $pdo;
}

function acx_migrate_schema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $cols = [];
    foreach ($pdo->query('SHOW COLUMNS FROM users') as $c) {
        $cols[(string) $c['Field']] = true;
    }
    if (!isset($cols['email_verified'])) {
        $pdo->exec('ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER avatar_url');
    }
    if (!isset($cols['last_login_at'])) {
        $pdo->exec('ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL DEFAULT NULL AFTER email_verified');
    }
    if (!isset($cols['subscription_tier'])) {
        $pdo->exec("ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(16) NOT NULL DEFAULT 'free' AFTER last_login_at");
        $pdo->exec('ALTER TABLE users ADD KEY idx_subscription_tier (subscription_tier)');
    }

    $msgCols = [];
    foreach ($pdo->query('SHOW COLUMNS FROM messages') as $c) {
        $msgCols[(string) $c['Field']] = true;
    }
    if (!isset($msgCols['attachments_json'])) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN attachments_json JSON NULL AFTER content');
    }
    if (!isset($msgCols['meta_json'])) {
        $pdo->exec('ALTER TABLE messages ADD COLUMN meta_json JSON NULL AFTER attachments_json');
    }

    $pdo->exec('CREATE TABLE IF NOT EXISTS attachments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        conversation_id BIGINT UNSIGNED NULL DEFAULT NULL,
        message_id BIGINT UNSIGNED NULL DEFAULT NULL,
        original_name VARCHAR(255) NOT NULL DEFAULT \'\',
        mime_type VARCHAR(128) NOT NULL DEFAULT \'\',
        storage_path VARCHAR(512) NOT NULL DEFAULT \'\',
        extracted_text MEDIUMTEXT NULL,
        meta_json JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user_created (user_id, created_at DESC),
        KEY idx_conv (conversation_id),
        CONSTRAINT fk_att_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $pdo->exec('CREATE TABLE IF NOT EXISTS user_memories (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        content VARCHAR(400) NOT NULL,
        source ENUM(\'user\',\'assistant\') NOT NULL DEFAULT \'user\',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user_mem (user_id, updated_at DESC),
        CONSTRAINT fk_mem_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $convCols = [];
    foreach ($pdo->query('SHOW COLUMNS FROM conversations') as $c) {
        $convCols[(string) $c['Field']] = true;
    }
    if (!isset($convCols['title_auto'])) {
        $pdo->exec('ALTER TABLE conversations ADD COLUMN title_auto TINYINT(1) NOT NULL DEFAULT 0 AFTER title');
    }
    if (!isset($convCols['share_token'])) {
        $pdo->exec('ALTER TABLE conversations ADD COLUMN share_token VARCHAR(24) NULL DEFAULT NULL AFTER title_auto');
        $pdo->exec('ALTER TABLE conversations ADD UNIQUE KEY uq_share_token (share_token)');
    }
    if (!isset($convCols['is_ephemeral'])) {
        $pdo->exec('ALTER TABLE conversations ADD COLUMN is_ephemeral TINYINT(1) NOT NULL DEFAULT 0 AFTER pinned_at');
        $pdo->exec('ALTER TABLE conversations ADD KEY idx_user_ephemeral (user_id, is_ephemeral, updated_at DESC)');
    }

    $pdo->exec('CREATE TABLE IF NOT EXISTS weekly_usage (
        user_id BIGINT UNSIGNED NOT NULL,
        week_start DATE NOT NULL,
        flair_tokens_used INT UNSIGNED NOT NULL DEFAULT 0,
        pine_tokens_used INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, week_start),
        CONSTRAINT fk_wu_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    $wuCols = [];
    try {
        foreach ($pdo->query('SHOW COLUMNS FROM weekly_usage') as $c) {
            $wuCols[(string) $c['Field']] = true;
        }
    } catch (Throwable) {
        $wuCols = [];
    }
    if ($wuCols !== []) {
        if (isset($wuCols['pine_requests_used']) && !isset($wuCols['pine_tokens_used'])) {
            $pdo->exec(
                'ALTER TABLE weekly_usage CHANGE COLUMN pine_requests_used pine_tokens_used INT UNSIGNED NOT NULL DEFAULT 0'
            );
            unset($wuCols['pine_requests_used']);
            $wuCols['pine_tokens_used'] = true;
        }
        if (isset($wuCols['flair_requests_used']) && !isset($wuCols['flair_tokens_used'])) {
            $pdo->exec(
                'ALTER TABLE weekly_usage CHANGE COLUMN flair_requests_used flair_tokens_used INT UNSIGNED NOT NULL DEFAULT 0'
            );
            unset($wuCols['flair_requests_used']);
            $wuCols['flair_tokens_used'] = true;
        }
        if (!isset($wuCols['flair_tokens_used'])) {
            $pdo->exec('ALTER TABLE weekly_usage ADD COLUMN flair_tokens_used INT UNSIGNED NOT NULL DEFAULT 0');
        }
        if (!isset($wuCols['pine_tokens_used'])) {
            $pdo->exec('ALTER TABLE weekly_usage ADD COLUMN pine_tokens_used INT UNSIGNED NOT NULL DEFAULT 0');
        }
    }

    $done = true;
}
