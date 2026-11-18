<?php
/**
 * Deployed to chat.assistix.org/lib/moderation_gate.php
 * Enforces admin ban / force_logout against ASSISTIX_CHAT_SESS.
 */
declare(strict_types=1);

/**
 * @param array{internal_id:int,id_user_id:int,email:string,display_name:string,avatar_url:string,subscription_tier:string}|null $user
 * @return array{internal_id:int,id_user_id:int,email:string,display_name:string,avatar_url:string,subscription_tier:string}|null
 */
function acx_moderation_gate(?array $user): ?array
{
    if ($user === null) {
        return null;
    }
    try {
        if (!function_exists('acx_db')) {
            return $user;
        }
        $pdo = acx_db();
        $st = $pdo->prepare('SELECT is_banned, force_logout_at FROM users WHERE id = ? LIMIT 1');
        $st->execute([(int) $user['internal_id']]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return $user;
        }
        if (!empty($row['is_banned'])) {
            unset($_SESSION['acx_user']);
            return null;
        }
        $forced = $row['force_logout_at'] ?? null;
        if ($forced) {
            $authedAt = (int) ($_SESSION['acx_user']['authed_at'] ?? 0);
            $forcedTs = strtotime((string) $forced) ?: 0;
            if ($forcedTs > 0 && $authedAt < $forcedTs) {
                unset($_SESSION['acx_user']);
                return null;
            }
        }
    } catch (Throwable $e) {
        return $user;
    }
    return $user;
}
