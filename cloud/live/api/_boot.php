<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/session.php';
require_once dirname(__DIR__) . '/lib/config.php';

$script = basename($_SERVER['SCRIPT_FILENAME'] ?? '');
if ($script !== 'beta-verify.php') {
    // Beam Agent ships as its own product: no Phase-1 rollout gate.
    require_once dirname(__DIR__) . '/lib/rollout-gate.php';
}

require_once dirname(__DIR__) . '/lib/db.php';
require_once dirname(__DIR__) . '/lib/models.php';
require_once dirname(__DIR__) . '/lib/usage.php';

acx_session_start();

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
    return acx_logged_user() === null;
}
