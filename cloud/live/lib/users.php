<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/usage.php';
require_once __DIR__ . '/subscriptions.php';

/**
 * Синхронизация профиля из ASSISTIX ID в локальную БД CHAT (пользователь, лимиты недели).
 *
 * @param array{id:int,email?:string,display_name?:string,avatar_url?:string,email_verified?:bool|int} $idUser
 * @return array{internal_id:int,id_user_id:int,email:string,display_name:string,avatar_url:string}
 */
function acx_upsert_user_from_id(array $idUser): array
{
    $idUserId = (int) ($idUser['id'] ?? 0);
    if ($idUserId <= 0) {
        throw new InvalidArgumentException('invalid_id_user');
    }

    $email = strtolower(trim((string) ($idUser['email'] ?? '')));
    $displayName = trim((string) ($idUser['display_name'] ?? ''));
    $avatarUrl = trim((string) ($idUser['avatar_url'] ?? ''));
    $emailVerified = !empty($idUser['email_verified']) ? 1 : 0;

    if ($displayName === '' && $email !== '') {
        $displayName = (string) (explode('@', $email)[0] ?? 'Пользователь');
    }
    if ($displayName === '') {
        $displayName = 'Пользователь';
    }

    $pdo = acx_db();
    $pdo->prepare(
        'INSERT INTO users (id_user_id, email, display_name, avatar_url, email_verified, last_login_at)
         VALUES (?,?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE
           email = VALUES(email),
           display_name = VALUES(display_name),
           avatar_url = VALUES(avatar_url),
           email_verified = VALUES(email_verified),
           last_login_at = NOW(),
           updated_at = CURRENT_TIMESTAMP'
    )->execute([$idUserId, $email, $displayName, $avatarUrl, $emailVerified]);

    $st = $pdo->prepare(
        'SELECT id, id_user_id, email, display_name, avatar_url, subscription_tier FROM users WHERE id_user_id = ? LIMIT 1'
    );
    try {
        $st->execute([$idUserId]);
        $row = $st->fetch();
    } catch (Throwable) {
        $st = $pdo->prepare(
            'SELECT id, id_user_id, email, display_name, avatar_url FROM users WHERE id_user_id = ? LIMIT 1'
        );
        $st->execute([$idUserId]);
        $row = $st->fetch();
        if ($row) {
            $row['subscription_tier'] = ACX_TIER_FREE;
        }
    }
    if (!$row) {
        throw new RuntimeException('user_upsert_failed');
    }

    $internalId = (int) $row['id'];
    acx_ensure_weekly_usage_row($internalId);

    return [
        'internal_id' => $internalId,
        'id_user_id' => (int) $row['id_user_id'],
        'email' => (string) $row['email'],
        'display_name' => (string) $row['display_name'],
        'avatar_url' => (string) $row['avatar_url'],
        'subscription_tier' => acx_normalize_subscription_tier_from_row($row),
    ];
}

function acx_normalize_subscription_tier_from_row(array $row): string
{
    return acx_normalize_subscription_tier((string) ($row['subscription_tier'] ?? ACX_TIER_FREE));
}

/**
 * Создаёт строку учёта лимитов на текущую неделю, если её ещё нет.
 */
function acx_ensure_weekly_usage_row(int $internalUserId): void
{
    if ($internalUserId <= 0) {
        return;
    }
    $week = acx_week_start_utc();
    $pdo = acx_db();
    try {
        $pdo->prepare(
            'INSERT IGNORE INTO weekly_usage (user_id, week_start, flair_tokens_used, pine_tokens_used)
             VALUES (?,?,0,0)'
        )->execute([$internalUserId, $week]);
    } catch (Throwable) {
        // Schema lag: auto-migrate on next request; login must not fail hard.
    }
}

/**
 * @return array{internal_id:int,id_user_id:int,email:string,display_name:string,avatar_url:string}|null
 */
function acx_user_row_by_internal_id(int $internalId): ?array
{
    if ($internalId <= 0) {
        return null;
    }
    $pdo = acx_db();
    try {
        $st = $pdo->prepare(
            'SELECT id, id_user_id, email, display_name, avatar_url, subscription_tier FROM users WHERE id = ? LIMIT 1'
        );
        $st->execute([$internalId]);
        $row = $st->fetch();
    } catch (Throwable) {
        $st = $pdo->prepare(
            'SELECT id, id_user_id, email, display_name, avatar_url FROM users WHERE id = ? LIMIT 1'
        );
        $st->execute([$internalId]);
        $row = $st->fetch();
        if ($row) {
            $row['subscription_tier'] = ACX_TIER_FREE;
        }
    }
    if (!$row) {
        return null;
    }

    return [
        'internal_id' => (int) $row['id'],
        'id_user_id' => (int) $row['id_user_id'],
        'email' => (string) $row['email'],
        'display_name' => (string) $row['display_name'],
        'avatar_url' => (string) $row['avatar_url'],
        'subscription_tier' => acx_normalize_subscription_tier_from_row($row),
    ];
}

function acx_session_set_user(array $user): void
{
    $_SESSION['acx_user'] = [
        'internal_id' => (int) ($user['internal_id'] ?? 0),
        'id_user_id' => (int) ($user['id_user_id'] ?? 0),
        'email' => (string) ($user['email'] ?? ''),
        'display_name' => (string) ($user['display_name'] ?? ''),
        'avatar_url' => (string) ($user['avatar_url'] ?? ''),
        'subscription_tier' => (string) ($user['subscription_tier'] ?? ACX_TIER_FREE),
    ];
}

/**
 * @return array{internal_id:int,id_user_id:int,email:string,display_name:string,avatar_url:string}|null
 */
function acx_refresh_user_session(int $internalId): ?array
{
    $row = acx_user_row_by_internal_id($internalId);
    if ($row === null) {
        return null;
    }
    acx_session_set_user($row);

    return $row;
}

/**
 * @return array{internal_id:int,id_user_id:int,email:string,display_name:string,avatar_url:string}|null
 */
function acx_update_user_profile(int $internalId, string $displayName, ?string $avatarUrl = null): ?array
{
    $displayName = trim($displayName);
    if ($internalId <= 0 || $displayName === '') {
        return null;
    }
    if (mb_strlen($displayName) > 120) {
        $displayName = mb_substr($displayName, 0, 120);
    }

    $pdo = acx_db();
    if ($avatarUrl !== null) {
        $avatarUrl = trim($avatarUrl);
        if (mb_strlen($avatarUrl) > 768) {
            $avatarUrl = mb_substr($avatarUrl, 0, 768);
        }
        $pdo->prepare('UPDATE users SET display_name = ?, avatar_url = ?, updated_at = NOW() WHERE id = ?')
            ->execute([$displayName, $avatarUrl, $internalId]);
    } else {
        $pdo->prepare('UPDATE users SET display_name = ?, updated_at = NOW() WHERE id = ?')
            ->execute([$displayName, $internalId]);
    }

    return acx_refresh_user_session($internalId);
}
