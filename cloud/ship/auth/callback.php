<?php
declare(strict_types=1);

/**
 * OAuth callback — mobile-safe.
 *
 * Do NOT set the session cookie here. iOS Safari / ITP often drops Set-Cookie on the
 * response that follows a cross-site redirect from id.assistix.org.
 * We mint a one-time ticket and bounce via 200 HTML to first-party auth/complete.php.
 */

require_once dirname(__DIR__) . '/lib/session.php';
require_once dirname(__DIR__) . '/lib/config.php';
require_once dirname(__DIR__) . '/lib/users.php';

header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('Referrer-Policy: no-referrer');

$code = isset($_GET['code']) ? trim((string) $_GET['code']) : '';
$stateRaw = isset($_GET['state']) ? (string) $_GET['state'] : '';
$next = 'https://agent.assistix.org/?auth=ok';

if ($stateRaw !== '') {
    $fixed = str_replace(' ', '+', $stateRaw);
    $stateBin = base64_decode($fixed, true);
    if ($stateBin === false) {
        $stateBin = base64_decode(strtr($fixed, '-_', '+/'), true);
    }
    if ($stateBin !== false) {
        $decodedState = json_decode((string) $stateBin, true);
        if (is_array($decodedState) && !empty($decodedState['next']) && is_string($decodedState['next'])) {
            $n = $decodedState['next'];
            if (preg_match('~^https://agent\.assistix\.org(/|\?|#|$)~i', $n)) {
                $next = $n;
            }
        }
    }
}

if ($next !== '' && preg_match('#^https?://[^/]*id\.assistix\.org#i', $next)) {
    $next = 'https://agent.assistix.org/?auth=ok';
}
if (!str_contains($next, 'auth=ok')) {
    $next .= (str_contains($next, '?') ? '&' : '?') . 'auth=ok';
}

function acx_oauth_fail(string $reason): void
{
    global $next;
    $target = ($next !== '' && preg_match('#^https://agent\.assistix\.org#i', $next)) ? $next : 'https://agent.assistix.org/';
    $sep = str_contains($target, '?') ? '&' : '?';
    acx_html_redirect($target . $sep . 'oauth_error=' . rawurlencode($reason), 'Ошибка входа…');
}

$oauthErr = isset($_GET['oauth_error']) ? trim((string) $_GET['oauth_error']) : '';
if ($oauthErr !== '' && $code === '') {
    acx_oauth_fail($oauthErr);
}

if ($code === '') {
    acx_oauth_fail('missing_code');
}

$cfg = acx_config();
$idBase = rtrim((string) ($cfg['id_base_url'] ?? 'https://id.assistix.org'), '/');
$clientId = (string) ($cfg['oauth']['client_id'] ?? 'assistix-agent');
$clientSecret = (string) ($cfg['oauth']['client_secret'] ?? '');
if ($clientSecret === '') {
    acx_oauth_fail('no_client_secret');
}

$redirectUri = 'https://agent.assistix.org/auth/callback.php';
$payload = json_encode([
    'code' => $code,
    'client_id' => $clientId,
    'client_secret' => $clientSecret,
    'redirect_uri' => $redirectUri,
], JSON_UNESCAPED_UNICODE);

$ch = curl_init($idBase . '/api/exchange.php');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 25,
]);
$resp = curl_exec($ch);
$http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($http !== 200 || !is_string($resp) || $resp === '') {
    $detail = $curlErr !== '' ? $curlErr : ('http_' . $http);
    if (is_string($resp) && $resp !== '') {
        $try = json_decode($resp, true);
        if (is_array($try) && !empty($try['error'])) {
            $detail = (string) $try['error'];
        }
    }
    error_log('[BEAM AGENT OAuth] exchange failed: ' . $detail . ' client=' . $clientId);
    acx_oauth_fail('exchange_' . $detail);
}

$data = json_decode($resp, true);
if (!is_array($data) || empty($data['user']) || !is_array($data['user'])) {
    acx_oauth_fail('no_user');
}

try {
    $sessionUser = acx_upsert_user_from_id($data['user']);
    $ticket = acx_login_ticket_create($sessionUser, $next);
} catch (Throwable $e) {
    error_log('[BEAM AGENT OAuth] ticket/user failed: ' . $e->getMessage());
    acx_oauth_fail('db_' . $e->getMessage());
}

$complete = 'https://agent.assistix.org/auth/complete.php?t=' . rawurlencode($ticket);
acx_html_redirect($complete, 'Входим в Beam Agent…');
