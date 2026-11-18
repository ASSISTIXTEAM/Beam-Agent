<?php
declare(strict_types=1);

/**
 * Long-lived ASSISTIX session (matches id.assistix.org: 60 days).
 * Hosting default gc_maxlifetime=1440 was GC-wiping logins within ~24 minutes.
 */
function acx_session_lifetime(): int
{
    return 86400 * 60;
}

function acx_session_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https')
        || (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on')
        || (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443');
}

function acx_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $lifetime = acx_session_lifetime();
    $secure = acx_session_is_https();
    $path = '/';

    @ini_set('session.gc_maxlifetime', (string) $lifetime);
    @ini_set('session.cookie_lifetime', (string) $lifetime);
    @ini_set('session.cookie_path', $path);
    @ini_set('session.cookie_httponly', '1');
    @ini_set('session.cookie_secure', $secure ? '1' : '0');
    @ini_set('session.cookie_samesite', 'Lax');
    @ini_set('session.use_strict_mode', '1');

    session_name('ASSISTIX_CHAT_SESS');
    session_start([
        'cookie_lifetime' => $lifetime,
        'cookie_path' => $path,
        'cookie_httponly' => true,
        'cookie_secure' => $secure,
        'cookie_samesite' => 'Lax',
        'use_strict_mode' => true,
        'gc_maxlifetime' => $lifetime,
    ]);
}

/** Persist / slide the session cookie Max-Age after login or on demand. */
function acx_session_persist_cookie(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE || headers_sent()) {
        return;
    }
    $lifetime = acx_session_lifetime();
    $p = session_get_cookie_params();
    $opts = [
        'expires' => time() + $lifetime,
        'path' => ($p['path'] ?? '') !== '' ? $p['path'] : '/',
        'secure' => !empty($p['secure']),
        'httponly' => !empty($p['httponly']),
        'samesite' => ($p['samesite'] ?? '') !== '' ? $p['samesite'] : 'Lax',
    ];
    if (!empty($p['domain'])) {
        $opts['domain'] = $p['domain'];
    }
    setcookie(session_name(), session_id(), $opts);
}
