<?php
declare(strict_types=1);

function acx_oauth_redirect_uri(): string
{
    return 'https://agent.assistix.org/auth/callback.php';
}

function acx_oauth_client_id(): string
{
    $cfg = acx_config();

    return (string) ($cfg['oauth']['client_id'] ?? 'assistix-agent');
}

/**
 * @return string base64 state with return URL for callback.php
 */
function acx_oauth_state(string $next): string
{
    if (!preg_match('~^https://agent\.assistix\.org(/|\?|#|$)~i', $next)) {
        $next = 'https://agent.assistix.org/';
    }

    return base64_encode(json_encode(['next' => $next, 'app' => 'beam-agent'], JSON_UNESCAPED_UNICODE));
}

function acx_oauth_login_url(string $next = 'https://agent.assistix.org/'): string
{
    $cfg = acx_config();
    $idBase = rtrim((string) ($cfg['id_base_url'] ?? 'https://id.assistix.org'), '/');

    return $idBase . '/auth/?' . http_build_query([
        'redirect_uri' => acx_oauth_redirect_uri(),
        'client_id' => acx_oauth_client_id(),
        'state' => acx_oauth_state($next),
    ]);
}
