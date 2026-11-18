<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/session.php';
require_once dirname(__DIR__) . '/lib/config.php';

$script = basename($_SERVER['SCRIPT_FILENAME'] ?? '');
if ($script !== 'beta-verify.php') {
    // Same invite gate as other Phase-1 Assistix products (chat key → agent.assistix.org).
    require_once dirname(__DIR__) . '/lib/rollout-gate.php';
    rollout_gate_api_deny('chat');
}

require_once dirname(__DIR__) . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/models.php';
require_once dirname(__DIR__) . '/lib/usage.php';
require_once dirname(__DIR__) . '/lib/users.php';

acx_session_start();

// Belt: if session cookie was dropped (ITP/Safari) but refresh cookie remains, rehydrate.
if (empty($_SESSION['acx_user'])) {
    $rt = isset($_COOKIE['ASSISTIX_AGENT_RT']) ? trim((string) $_COOKIE['ASSISTIX_AGENT_RT']) : '';
    if ($rt !== '' && preg_match('/^[a-f0-9]{64}$/', $rt)) {
        $resolved = acx_refresh_token_resolve($rt);
        if ($resolved !== null) {
            $fresh = acx_refresh_user_session((int) $resolved['internal_id']);
            if (is_array($fresh)) {
                $_SESSION['acx_user'] = [
                    'internal_id' => (int) $fresh['internal_id'],
                    'id_user_id' => (int) $fresh['id_user_id'],
                    'email' => (string) $fresh['email'],
                    'display_name' => (string) $fresh['display_name'],
                    'avatar_url' => (string) ($fresh['avatar_url'] ?? ''),
                    'subscription_tier' => (string) ($fresh['subscription_tier'] ?? 'free'),
                ];
                acx_session_persist_cookie();
            }
        }
    }
} elseif (!empty($_SESSION['acx_user'])) {
    acx_session_persist_cookie();
}

if (!headers_sent()) {
    ini_set('display_errors', '0');
}

function acx_json_out(array $data, int $code = 200): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate');
    }
    $flags = JSON_UNESCAPED_UNICODE;
    if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) {
        $flags |= JSON_INVALID_UTF8_SUBSTITUTE;
    }
    $json = json_encode($data, $flags);
    if ($json === false) {
        $json = '{"success":false,"error":"json_encode_failed"}';
    }
    echo $json;
    exit;
}

/** @return array{internal_id:int, id_user_id:int, email:string, display_name:string, avatar_url:string, subscription_tier:string}|null */
function acx_logged_user(): ?array
{
    if (empty($_SESSION['acx_user']) || !is_array($_SESSION['acx_user'])) {
        return null;
    }
    $u = $_SESSION['acx_user'];
    if (empty($u['internal_id']) || empty($u['id_user_id'])) {
        return null;
    }
    return [
        'internal_id' => (int) $u['internal_id'],
        'id_user_id' => (int) $u['id_user_id'],
        'email' => (string) ($u['email'] ?? ''),
        'display_name' => (string) ($u['display_name'] ?? ''),
        'avatar_url' => (string) ($u['avatar_url'] ?? ''),
        'subscription_tier' => (string) ($u['subscription_tier'] ?? 'free'),
    ];
}

function acx_is_guest_mode(): bool
{
    // Beam Agent cloud is auth-only — unsigned users must hit acx_require_auth().
    return acx_logged_user() === null;
}

/** @return array{internal_id:int, id_user_id:int, email:string, display_name:string, avatar_url:string, subscription_tier:string} */
function acx_require_auth(): array
{
    $u = acx_logged_user();
    if ($u === null) {
        acx_json_out(['success' => false, 'error' => 'auth_required', 'login_url' => '/auth/login.php'], 401);
    }
    return $u;
}
