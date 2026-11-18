<?php
declare(strict_types=1);

/**
 * Rehydrate PHP session from refresh token (cookie, header, or JSON body).
 * First-party only. Returns JSON. Used when session cookie was dropped by ITP/Safari.
 */

require_once dirname(__DIR__) . '/lib/session.php';
require_once dirname(__DIR__) . '/lib/config.php';
require_once dirname(__DIR__) . '/lib/users.php';
require_once dirname(__DIR__) . '/lib/oauth.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$token = acx_refresh_token_from_request();
if ($token === '') {
    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'authenticated' => false,
        'error' => 'no_refresh_token',
        'login_url' => acx_oauth_login_url('https://agent.assistix.org/'),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$resolved = acx_refresh_token_resolve($token);
if ($resolved === null) {
    acx_refresh_token_clear_cookie();
    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'authenticated' => false,
        'error' => 'refresh_invalid',
        'login_url' => acx_oauth_login_url('https://agent.assistix.org/'),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$user = acx_refresh_user_session((int) $resolved['internal_id']);
if ($user === null) {
    acx_refresh_token_revoke($token);
    acx_refresh_token_clear_cookie();
    http_response_code(401);
    echo json_encode(['ok' => false, 'authenticated' => false, 'error' => 'user_missing'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Rotate refresh token for safety
acx_refresh_token_revoke($token);
$rt = acx_session_login_user($user);
session_write_close();

echo json_encode([
    'ok' => true,
    'authenticated' => true,
    'restored' => true,
    'refresh_token' => $rt, // client may refresh localStorage
    'user' => [
        'email' => (string) ($user['email'] ?? ''),
        'display_name' => (string) ($user['display_name'] ?? ''),
    ],
], JSON_UNESCAPED_UNICODE);
exit;
