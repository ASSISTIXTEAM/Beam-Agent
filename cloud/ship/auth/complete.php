<?php
declare(strict_types=1);

/**
 * First-party login completion — ONLY place that establishes cookies after OAuth.
 * Never 302. Always 200 HTML + localStorage RT write + location.replace.
 */

require_once dirname(__DIR__) . '/lib/session.php';
require_once dirname(__DIR__) . '/lib/config.php';
require_once dirname(__DIR__) . '/lib/users.php';

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
header('Referrer-Policy: no-referrer');

$ticket = isset($_GET['t']) ? trim((string) $_GET['t']) : '';
$consumed = $ticket !== '' ? acx_login_ticket_consume($ticket) : null;

if ($consumed === null) {
    acx_html_redirect('https://agent.assistix.org/?oauth_error=ticket_invalid', 'Сессия входа истекла…');
}

$user = $consumed['user'];
$next = $consumed['next'];

if (!empty($user['internal_id']) && function_exists('acx_refresh_user_session')) {
    $fresh = acx_refresh_user_session((int) $user['internal_id']);
    if (is_array($fresh)) {
        $user = $fresh;
    }
}

$rt = acx_session_login_user($user);
session_write_close();

acx_html_finish_login($next, $rt, 'Готово. Открываем Beam Agent…');
