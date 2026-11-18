<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/config.php';
require_once dirname(__DIR__) . '/lib/oauth.php';

$next = trim((string) ($_GET['next'] ?? 'https://agent.assistix.org/'));
if (!preg_match('~^https://agent\.assistix\.org(/|\?|#|$)~i', $next)) {
    $next = 'https://agent.assistix.org/';
}

header('Cache-Control: no-store, no-cache, must-revalidate');
header('Location: ' . acx_oauth_login_url($next));
exit;
