<?php
declare(strict_types=1);

/**
 * Lightweight auth status for mobile boot. No rollout gate.
 * GET → {authenticated, login_url, has_refresh_cookie}
 */

require_once dirname(__DIR__) . '/lib/session.php';
require_once dirname(__DIR__) . '/lib/config.php';
require_once dirname(__DIR__) . '/lib/oauth.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

acx_session_start();
if (!empty($_SESSION['acx_user'])) {
    acx_session_persist_cookie();
}

$u = null;
if (!empty($_SESSION['acx_user']) && is_array($_SESSION['acx_user'])
    && !empty($_SESSION['acx_user']['internal_id']) && !empty($_SESSION['acx_user']['id_user_id'])) {
    $u = [
        'internal_id' => (int) $_SESSION['acx_user']['internal_id'],
        'email' => (string) ($_SESSION['acx_user']['email'] ?? ''),
        'display_name' => (string) ($_SESSION['acx_user']['display_name'] ?? ''),
    ];
}

$rtCookie = isset($_COOKIE['ASSISTIX_AGENT_RT']) && preg_match('/^[a-f0-9]{64}$/', (string) $_COOKIE['ASSISTIX_AGENT_RT']);

echo json_encode([
    'ok' => true,
    'authenticated' => $u !== null,
    'user' => $u,
    'has_refresh_cookie' => (bool) $rtCookie,
    'login_url' => acx_oauth_login_url('https://agent.assistix.org/'),
    'v' => '20261118g',
], JSON_UNESCAPED_UNICODE);
exit;
