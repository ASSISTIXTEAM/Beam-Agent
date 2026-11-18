<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/rollout-gate.php';
require_once __DIR__ . '/lib/session.php';
require_once __DIR__ . '/lib/config.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/users.php';

// Same invite / beta gate as CHAT / SEARCH / A.DROP (Phase 1).
rollout_gate_enforce('chat');

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$html = file_get_contents(__DIR__ . '/index.html');
if ($html === false) {
    http_response_code(500);
    echo 'index missing';
    exit;
}

$bust = 'portfix' . gmdate('YmdHis');
$html = preg_replace('/(\?v=)[^"\'&\s]+/', '${1}' . $bust, $html) ?? $html;
$html = str_replace('__ACX_CACHE_BUST__', $bust, $html);

// Server-side preauth: if session (or RT cookie) is valid, first paint is the app — never the login gate.
$preauth = ['authenticated' => false, 'user' => null];
try {
    acx_session_start();
    if (empty($_SESSION['acx_user'])) {
        $rt = isset($_COOKIE['ASSISTIX_AGENT_RT']) ? trim((string) $_COOKIE['ASSISTIX_AGENT_RT']) : '';
        if ($rt !== '' && preg_match('/^[a-f0-9]{64}$/', $rt)) {
            $resolved = acx_refresh_token_resolve($rt);
            if ($resolved !== null) {
                $fresh = acx_refresh_user_session((int) $resolved['internal_id']);
                if (is_array($fresh)) {
                    $_SESSION['acx_user'] = [
                        'internal_id' => (int) $fresh['internal_id'],
                        'id_user_id' => (int) $fresh['id_user_id'],
                        'email' => (string) $fresh['email'],
                        'display_name' => (string) $fresh['display_name'],
                        'avatar_url' => (string) ($fresh['avatar_url'] ?? ''),
                        'subscription_tier' => (string) ($fresh['subscription_tier'] ?? 'free'),
                    ];
                    acx_session_persist_cookie();
                }
            }
        }
    }
    if (!empty($_SESSION['acx_user']['internal_id']) && !empty($_SESSION['acx_user']['id_user_id'])) {
        $preauth = [
            'authenticated' => true,
            'user' => [
                'email' => (string) ($_SESSION['acx_user']['email'] ?? ''),
                'display_name' => (string) ($_SESSION['acx_user']['display_name'] ?? ''),
            ],
        ];
        acx_session_persist_cookie();
    }
} catch (Throwable $e) {
    // keep preauth false
}

$preJson = json_encode($preauth, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($preJson === false) {
    $preJson = '{"authenticated":false}';
}
$inject = '<script>window.__ACX_PREAUTH__=' . $preJson . ';</script>';
$html = str_replace('</head>', $inject . "\n</head>", $html);

if (!empty($preauth['authenticated'])) {
    // First paint: app shell, not login gate (kills the infinite-loop flash).
    $html = str_replace('data-state="booting"', 'data-state="app"', $html);
    $html = preg_replace('/<section id="authGate" class="ba-gate"(?: hidden)?>/', '<section id="authGate" class="ba-gate" hidden>', $html, 1) ?? $html;
    $html = preg_replace('/<div id="shell" class="ba-shell"(?: hidden)?>/', '<div id="shell" class="ba-shell">', $html, 1) ?? $html;
}

echo $html;
