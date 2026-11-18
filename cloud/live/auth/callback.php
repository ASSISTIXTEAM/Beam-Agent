<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/lib/session.php';
require_once dirname(__DIR__) . '/lib/config.php';
require_once dirname(__DIR__) . '/lib/users.php';

acx_session_start();
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

$code = isset($_GET['code']) ? trim((string) $_GET['code']) : '';
$stateRaw = isset($_GET['state']) ? (string) $_GET['state'] : '';
$next = 'https://agent.assistix.org/';

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
    $next = 'https://agent.assistix.org/';
}

function acx_oauth_fail(string $reason): void
{
    global $next;
    $target = ($next !== '' && preg_match('#^https://agent\.assistix\.org#i', $next)) ? $next : 'https://agent.assistix.org/';
    $sep = str_contains($target, '?') ? '&' : '?';
    header('Location: ' . $target . $sep . 'oauth_error=' . rawurlencode($reason));
    exit;
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
} catch (Throwable $e) {
    acx_oauth_fail('db_' . $e->getMessage());
}

unset($_SESSION['acx_guest']);
if (function_exists('session_regenerate_id')) {
    session_regenerate_id(true);
}
$_SESSION['acx_user'] = $sessionUser;
acx_session_persist_cookie();

header('Location: ' . $next);
exit;
