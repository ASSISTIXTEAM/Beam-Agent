<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/session.php';

acx_session_start();

$rt = isset($_COOKIE['ASSISTIX_AGENT_RT']) ? trim((string) $_COOKIE['ASSISTIX_AGENT_RT']) : '';
if ($rt !== '') {
    acx_refresh_token_revoke($rt);
}

$_SESSION = [];
acx_refresh_token_clear_cookie();
acx_clear_legacy_cookies();

$clear = static function (string $name): void {
    setcookie($name, 'deleted', [
        'expires' => 1,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
};
$clear(session_name());
$clear('ASSISTIX_AGENT_SESS');
$clear('ASSISTIX_CHAT_SESS');

session_destroy();

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok' => true, 'logged_out' => true]);
exit;
