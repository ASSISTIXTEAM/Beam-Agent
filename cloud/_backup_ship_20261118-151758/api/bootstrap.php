<?php
declare(strict_types=1);

/**
 * Beam Agent cloud bootstrap — ASSISTIX ID required (no guest/demo).
 */

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/usage.php';
require_once dirname(__DIR__) . '/lib/oauth.php';
require_once dirname(__DIR__) . '/lib/memory.php';
require_once dirname(__DIR__) . '/lib/subscriptions.php';
require_once dirname(__DIR__) . '/lib/canvas.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    acx_json_out(['error' => 'method_not_allowed'], 405);
}

$logged = acx_logged_user();
if ($logged !== null) {
    require_once dirname(__DIR__) . '/lib/users.php';
    $fresh = acx_refresh_user_session($logged['internal_id']);
    if ($fresh !== null) {
        $logged = $fresh;
    }
}

$loginUrl = acx_oauth_login_url('https://agent.assistix.org/');

if ($logged === null) {
    acx_json_out([
        'success' => true,
        'data' => [
            'authenticated' => false,
            'guest' => false,
            'auth_required' => true,
            'product' => 'beam-agent-cloud',
            'login_url' => $loginUrl,
            'id_profile_url' => 'https://id.assistix.org/profile/',
            'about_models_url' => 'https://assistix.org/about/',
            'desktop_download_url' => 'https://agent.assistix.org/download/',
            'capabilities' => [
                'cloud_sessions' => true,
                'cloud_workspace' => true,
                'projects' => true,
                'web_search' => true,
                'agent_tools' => true,
                'computer_use' => false,
                'computer_use_note' => 'Desktop Beam Agent only',
            ],
            'user' => null,
            'usage' => null,
            'models' => [],
        ],
    ]);
}

$limitsCfg = acx_limits_config_for_user((int) $logged['internal_id']);
$catalog = acx_model_catalog(false);
$modelsOut = [];
foreach ($catalog as $k => $row) {
    if ($k === 'FLAIR') {
        continue; // alias only
    }
    $modelsOut[] = [
        'key' => $k,
        'name' => $row['name'],
        'description' => $row['description'],
    ];
}

$tideCap = acx_limits_weekly_tokens($limitsCfg, 'tide');
$flairCap = acx_limits_weekly_tokens($limitsCfg, 'flair');
$pineCap = acx_limits_weekly_tokens($limitsCfg, 'pine');
$attachmentLimits = acx_attachment_limits_for_user((int) $logged['internal_id']);
$memoryLimits = acx_memory_limits_for_user((int) $logged['internal_id']);

$u = $logged;
$usage = acx_get_weekly_usage($u['internal_id']);
$memories = acx_memory_list($u['internal_id']);
$imgUsed = acx_canvas_daily_count(acx_canvas_subject_key((int) $u['internal_id']));
$imgCap = acx_canvas_daily_limit();

$out = [
    'authenticated' => true,
    'guest' => false,
    'auth_required' => false,
    'product' => 'beam-agent-cloud',
    'models' => $modelsOut,
    'about_models_url' => 'https://assistix.org/about/',
    'id_profile_url' => 'https://id.assistix.org/profile/',
    'login_url' => $loginUrl,
    'desktop_download_url' => 'https://agent.assistix.org/download/',
    'limits_config' => [
        'tide_weekly_tokens' => $tideCap,
        'flair_weekly_tokens' => $flairCap,
        'flare_weekly_tokens' => $flairCap,
        'pine_weekly_tokens' => $pineCap,
        'pine_weekly_requests' => $pineCap,
        'unlimited' => !empty($limitsCfg['unlimited']),
    ],
    'attachment_limits' => $attachmentLimits,
    'modes' => [
        ['key' => 'chat', 'label' => 'Chat'],
        ['key' => 'web', 'label' => 'Web'],
        ['key' => 'documents', 'label' => 'Documents'],
        ['key' => 'agent', 'label' => 'Agent'],
        ['key' => 'research', 'label' => 'Research'],
    ],
    'capabilities' => [
        'cloud_sessions' => true,
        'cloud_workspace' => true,
        'projects' => true,
        'web_search' => true,
        'agent_tools' => true,
        'computer_use' => false,
        'computer_use_note' => 'Computer use is available in desktop Beam Agent. Cloud sessions use durable ASSISTIX Environment workspaces instead.',
    ],
    'images_per_day' => $imgCap,
    'vision_model' => 'Sight',
    'promo_redeem_url' => '/api/promo.php',
    'provider' => 'kumo',
    'user' => [
        'display_name' => $u['display_name'] !== '' ? $u['display_name'] : (explode('@', $u['email'])[0] ?? 'User'),
        'email' => $u['email'],
        'avatar_url' => $u['avatar_url'],
    ],
    'memories' => $memories,
    'memory_limits' => $memoryLimits,
    'usage' => [
        'week_start_utc' => acx_week_start_utc(),
        'tide' => [
            'kind' => 'tokens',
            'tokens_used' => $usage['tide_tokens_used'] ?? 0,
            'tokens_cap' => $tideCap,
        ],
        'flare' => [
            'kind' => 'tokens',
            'tokens_used' => $usage['flair_tokens_used'] ?? 0,
            'tokens_cap' => $flairCap,
        ],
        'flair' => [
            'kind' => 'tokens',
            'tokens_used' => $usage['flair_tokens_used'] ?? 0,
            'tokens_cap' => $flairCap,
        ],
        'pine' => [
            'kind' => 'requests',
            'tokens_used' => $usage['pine_tokens_used'] ?? 0,
            'tokens_cap' => $pineCap,
            'requests_used' => $usage['pine_tokens_used'] ?? 0,
            'requests_cap' => $pineCap,
        ],
        'images' => [
            'kind' => 'daily',
            'used' => $imgUsed,
            'cap' => $imgCap,
            'remaining' => max(0, $imgCap - $imgUsed),
        ],
        'unlimited' => !empty($limitsCfg['unlimited']),
    ],
    'subscription' => acx_subscription_public_for_user((int) $u['internal_id']),
    'guest_usage' => null,
];

acx_json_out(['success' => true, 'data' => $out]);
