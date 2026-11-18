<?php
declare(strict_types=1);

/**
 * Absolute persistence for agent.assistix.org (mobile-first).
 *
 * Layers:
 * 1) Host-only session cookie ASSISTIX_AGENT_SESS (90d) — set only on first-party 200 pages
 * 2) Host-only refresh cookie ASSISTIX_AGENT_RT (90d, HttpOnly) — rehydrates session via /auth/restore.php
 * 3) localStorage mirror of refresh token (client) — survives cookie ITP quirks
 * 4) Durable session files under storage/sessions (never shared /tmp GC)
 */

function acx_session_lifetime(): int
{
    return 86400 * 90;
}

function acx_session_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https')
        || (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_SSL']) === 'on')
        || (isset($_SERVER['HTTP_X_FORWARDED_HTTPS']) && $_SERVER['HTTP_X_FORWARDED_HTTPS'] === 'on')
        || (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443');
}

function acx_session_storage_dir(string $subdir): string
{
    $dir = dirname(__DIR__) . '/storage/' . $subdir;
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    return $dir;
}

function acx_session_save_path_dir(): string
{
    return acx_session_storage_dir('sessions');
}

function acx_session_cookie_options(?int $expires = null): array
{
    $lifetime = acx_session_lifetime();
    return [
        'lifetime' => $lifetime,
        'expires' => $expires ?? (time() + $lifetime),
        'path' => '/',
        'domain' => '',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

function acx_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $opts = acx_session_cookie_options();
    $savePath = acx_session_save_path_dir();
    if (is_dir($savePath) && is_writable($savePath)) {
        session_save_path($savePath);
    }

    @ini_set('session.gc_maxlifetime', (string) $opts['lifetime']);
    @ini_set('session.cookie_lifetime', (string) $opts['lifetime']);
    @ini_set('session.cookie_path', '/');
    @ini_set('session.cookie_secure', '1');
    @ini_set('session.cookie_httponly', '1');
    @ini_set('session.cookie_samesite', 'Lax');
    @ini_set('session.use_only_cookies', '1');
    @ini_set('session.use_strict_mode', '1');
    @ini_set('session.cookie_domain', '');
    @ini_set('session.gc_probability', '1');
    @ini_set('session.gc_divisor', '100');

    session_name('ASSISTIX_AGENT_SESS');
    session_set_cookie_params([
        'lifetime' => $opts['lifetime'],
        'path' => '/',
        'domain' => '',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start([
        'cookie_lifetime' => $opts['lifetime'],
        'cookie_path' => '/',
        'cookie_secure' => true,
        'cookie_httponly' => true,
        'cookie_samesite' => 'Lax',
        'use_strict_mode' => true,
        'use_only_cookies' => true,
        'gc_maxlifetime' => $opts['lifetime'],
    ]);
}

function acx_session_persist_cookie(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE || headers_sent()) {
        return;
    }
    $opts = acx_session_cookie_options();
    setcookie(session_name(), session_id(), [
        'expires' => $opts['expires'],
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function acx_clear_legacy_cookies(): void
{
    if (headers_sent()) {
        return;
    }
    $dead = [
        'ASSISTIX_CHAT_SESS',
        'ASSISTIX_AGENT_SESS_OLD',
        'PHPSESSID',
    ];
    foreach ($dead as $name) {
        setcookie($name, 'deleted', [
            'expires' => 1,
            'path' => '/',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}

/** @param array{internal_id:int,id_user_id:int,email:string,display_name:string,avatar_url?:string,subscription_tier?:string} $user */
function acx_session_login_user(array $user): string
{
    acx_session_start();
    unset($_SESSION['acx_guest']);
    if (function_exists('session_regenerate_id')) {
        session_regenerate_id(true);
    }
    $_SESSION['acx_user'] = [
        'internal_id' => (int) ($user['internal_id'] ?? 0),
        'id_user_id' => (int) ($user['id_user_id'] ?? 0),
        'email' => (string) ($user['email'] ?? ''),
        'display_name' => (string) ($user['display_name'] ?? ''),
        'avatar_url' => (string) ($user['avatar_url'] ?? ''),
        'subscription_tier' => (string) ($user['subscription_tier'] ?? 'free'),
    ];
    acx_session_persist_cookie();
    acx_clear_legacy_cookies();
    $rt = acx_refresh_token_issue((int) $_SESSION['acx_user']['internal_id']);
    acx_refresh_token_set_cookie($rt);
    return $rt;
}

/* ---------- Refresh tokens (durable opaque) ---------- */

function acx_refresh_token_dir(): string
{
    return acx_session_storage_dir('refresh_tokens');
}

function acx_refresh_token_issue(int $internalId): string
{
    if ($internalId <= 0) {
        throw new RuntimeException('refresh_no_user');
    }
    $token = bin2hex(random_bytes(32));
    $hash = hash('sha256', $token);
    $payload = json_encode([
        'internal_id' => $internalId,
        'exp' => time() + acx_session_lifetime(),
        'iat' => time(),
        'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 240),
    ], JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        throw new RuntimeException('refresh_encode');
    }
    $ok = @file_put_contents(acx_refresh_token_dir() . '/' . $hash . '.json', $payload, LOCK_EX);
    if ($ok === false) {
        throw new RuntimeException('refresh_write');
    }
    return $token;
}

function acx_refresh_token_set_cookie(string $token): void
{
    if (headers_sent()) {
        return;
    }
    $opts = acx_session_cookie_options();
    setcookie('ASSISTIX_AGENT_RT', $token, [
        'expires' => $opts['expires'],
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function acx_refresh_token_clear_cookie(): void
{
    if (headers_sent()) {
        return;
    }
    setcookie('ASSISTIX_AGENT_RT', 'deleted', [
        'expires' => 1,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function acx_refresh_token_revoke(string $token): void
{
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        return;
    }
    $path = acx_refresh_token_dir() . '/' . hash('sha256', $token) . '.json';
    if (is_file($path)) {
        @unlink($path);
    }
}

/** @return array{internal_id:int}|null */
function acx_refresh_token_resolve(string $token): ?array
{
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        return null;
    }
    $path = acx_refresh_token_dir() . '/' . hash('sha256', $token) . '.json';
    if (!is_file($path)) {
        return null;
    }
    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '') {
        return null;
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || empty($data['internal_id'])) {
        @unlink($path);
        return null;
    }
    if ((int) ($data['exp'] ?? 0) < time()) {
        @unlink($path);
        return null;
    }
    // Sliding expiry on use
    $data['exp'] = time() + acx_session_lifetime();
    $data['last'] = time();
    @file_put_contents($path, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
    return ['internal_id' => (int) $data['internal_id']];
}

function acx_refresh_token_from_request(): string
{
    $cookie = isset($_COOKIE['ASSISTIX_AGENT_RT']) ? trim((string) $_COOKIE['ASSISTIX_AGENT_RT']) : '';
    if ($cookie !== '') {
        return $cookie;
    }
    $hdr = isset($_SERVER['HTTP_X_ACX_REFRESH']) ? trim((string) $_SERVER['HTTP_X_ACX_REFRESH']) : '';
    if ($hdr !== '') {
        return $hdr;
    }
    $raw = file_get_contents('php://input');
    if (is_string($raw) && $raw !== '') {
        $j = json_decode($raw, true);
        if (is_array($j) && !empty($j['refresh_token'])) {
            return trim((string) $j['refresh_token']);
        }
    }
    if (isset($_POST['refresh_token'])) {
        return trim((string) $_POST['refresh_token']);
    }
    if (isset($_GET['rt'])) {
        return trim((string) $_GET['rt']);
    }
    return '';
}

/* ---------- Login tickets (OAuth handoff) ---------- */

function acx_login_ticket_create(array $user, string $next): string
{
    $id = bin2hex(random_bytes(32));
    $dir = acx_session_storage_dir('login_tickets');
    $payload = json_encode([
        'user' => $user,
        'next' => $next,
        'exp' => time() + 600,
        'ua' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 240),
    ], JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        throw new RuntimeException('ticket_encode_failed');
    }
    $ok = @file_put_contents($dir . '/' . $id . '.json', $payload, LOCK_EX);
    if ($ok === false) {
        throw new RuntimeException('ticket_write_failed');
    }
    return $id;
}

/** @return array{user:array,next:string}|null */
function acx_login_ticket_consume(string $id): ?array
{
    if (!preg_match('/^[a-f0-9]{64}$/', $id)) {
        return null;
    }
    $path = acx_session_storage_dir('login_tickets') . '/' . $id . '.json';
    if (!is_file($path)) {
        return null;
    }
    $raw = @file_get_contents($path);
    @unlink($path);
    if (!is_string($raw) || $raw === '') {
        return null;
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || empty($data['user']) || !is_array($data['user'])) {
        return null;
    }
    if ((int) ($data['exp'] ?? 0) < time()) {
        return null;
    }
    $next = (string) ($data['next'] ?? 'https://agent.assistix.org/');
    if (!preg_match('~^https://agent\.assistix\.org(/|\?|#|$)~i', $next)) {
        $next = 'https://agent.assistix.org/?auth=ok';
    }
    if (!str_contains($next, 'auth=ok')) {
        $next .= (str_contains($next, '?') ? '&' : '?') . 'auth=ok';
    }
    return ['user' => $data['user'], 'next' => $next];
}

/**
 * First-party 200 HTML handoff that:
 * - relies on Set-Cookie already sent in this response
 * - writes refresh token to localStorage
 * - unregisters service workers / clears Cache API
 * - then navigates with location.replace (never 302 for auth)
 */
function acx_html_finish_login(string $url, string $refreshToken, string $message = 'Готово…'): void
{
    if (!preg_match('~^https://agent\.assistix\.org(/|\?|#|$)~i', $url) && ($url === '' || $url[0] !== '/')) {
        $url = 'https://agent.assistix.org/';
    }
    if ($url !== '' && $url[0] === '/') {
        $url = 'https://agent.assistix.org' . $url;
    }
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    if (!headers_sent()) {
        http_response_code(200);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('Referrer-Policy: no-referrer');
    }
    $safe = htmlspecialchars($url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $msg = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $jsUrl = json_encode($url, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $jsRt = json_encode($refreshToken, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    echo '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
    echo '<meta http-equiv="Cache-Control" content="no-store">';
    echo '<meta name="theme-color" content="#041210"><title>Beam Agent</title></head>';
    echo '<body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#041210;color:#e8f7f5;font-family:system-ui,sans-serif">';
    echo '<p style="opacity:.85">' . $msg . '</p>';
    echo '<script>(function(){';
    echo 'var RT=' . $jsRt . ',URL=' . $jsUrl . ';';
    echo 'try{localStorage.setItem("acx_agent_rt_v1",RT);localStorage.setItem("acx_agent_rt_at",String(Date.now()));';
    echo 'sessionStorage.setItem("acx_auth_just","1");sessionStorage.removeItem("acx_boot_fail");}catch(e){}';
    echo 'try{if(navigator.serviceWorker){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister();});});}}catch(e){}';
    echo 'try{if(window.caches){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k);});});}}catch(e){}';
    echo 'if(URL.indexOf("auth=ok")<0){URL+=(URL.indexOf("?")>=0?"&":"?")+"auth=ok";}';
    echo 'location.replace(URL);';
    echo '})();</script>';
    echo '<noscript><a href="' . $safe . '" style="color:#2dd4bf">Продолжить</a></noscript>';
    echo '</body></html>';
    exit;
}

function acx_html_redirect(string $url, string $message = 'Входим…'): void
{
    if (!preg_match('~^https://agent\.assistix\.org(/|\?|#|$)~i', $url) && ($url === '' || $url[0] !== '/')) {
        $url = 'https://agent.assistix.org/';
    }
    if ($url !== '' && $url[0] === '/') {
        $url = 'https://agent.assistix.org' . $url;
    }
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
    if (!headers_sent()) {
        http_response_code(200);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Referrer-Policy: no-referrer');
    }
    $safe = htmlspecialchars($url, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $msg = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $js = json_encode($url, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    echo '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
    echo '<meta http-equiv="refresh" content="0;url=' . $safe . '">';
    echo '<meta name="theme-color" content="#041210"><title>Beam Agent</title></head>';
    echo '<body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#041210;color:#e8f7f5;font-family:system-ui,sans-serif">';
    echo '<p style="opacity:.85">' . $msg . '</p>';
    echo '<script>location.replace(' . $js . ');</script>';
    echo '<noscript><a href="' . $safe . '" style="color:#2dd4bf">Продолжить</a></noscript>';
    echo '</body></html>';
    exit;
}
