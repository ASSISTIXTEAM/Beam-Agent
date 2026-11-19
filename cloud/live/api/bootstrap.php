<?php
declare(strict_types=1);

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/guest.php';
require_once dirname(__DIR__) . '/lib/usage.php';
require_once dirname(__DIR__) . '/lib/ratelimit.php';
require_once dirname(__DIR__) . '/lib/oauth.php';
require_once dirname(__DIR__) . '/lib/memory.php';
require_once dirname(__DIR__) . '/lib/subscriptions.php';
require_once dirname(__DIR__) . '/lib/canvas.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    acx_json_out(['error' => 'method_not_allowed'], 405);
}

$cfg = acx_config();
$guestCfg = acx_guest_config();

$logged = acx_logged_user();
if ($logged !== null) {
    require_once dirname(__DIR__) . '/lib/users.php';
    $fresh = acx_refresh_user_session($logged['internal_id']);
    if ($fresh !== null) {
        $logged = $fresh;
    }
}
$guestMode = $logged === null;
$limitsCfg = $guestMode ? acx_limits_config() : acx_limits_config_for_user((int) $logged['internal_id']);
$catalog = acx_model_catalog($guestMode);
$modelsOut = [];
foreach ($catalog as $k => $row) {
    $modelsOut[] = [
        'key' => $k,
        'name' => $row['name'],
        'description' => $row['description'],
    ];
}

$tideCap = acx_limits_weekly_tokens($limitsCfg, 'tide');
$flairCap = acx_limits_weekly_tokens($limitsCfg, 'flair');
$pineCap = acx_limits_weekly_tokens($limitsCfg, 'pine');
$attachmentLimits = $guestMode
    ? ['max_per_conversation' => 10, 'max_total_bytes' => 20 * 1024 * 1024]
    : acx_attachment_limits_for_user((int) $logged['internal_id']);
$memoryLimits = $guestMode
    ? ['max_items' => ACX_MEMORY_MAX_ITEMS, 'max_item_chars' => ACX_MEMORY_ITEM_MAX]
    : acx_memory_limits_for_user((int) $logged['internal_id']);

$out = [
    'authenticated' => !$guestMode,
    'guest' => $guestMode,
    'models' => $modelsOut,
    'about_models_url' => 'https://assistix.org/about/',
    'id_profile_url' => 'https://id.assistix.org/profile/',
    'login_url' => acx_oauth_login_url('https://agent.assistix.org/'),
    'limits_config' => [
        'tide_weekly_tokens' => $tideCap,
        'flair_weekly_tokens' => $flairCap,
        'pine_weekly_tokens' => $pineCap,
        'pine_weekly_requests' => $pineCap,
        'unlimited' => !empty($limitsCfg['unlimited']),
    ],
    'guest_limits' => [
        'max_conversations' => (int) $guestCfg['max_conversations'],
        'max_user_messages_per_day' => (int) $guestCfg['max_user_messages_per_day'],
        'max_messages_per_minute' => (int) $guestCfg['max_messages_per_minute'],
        'max_attachments_guest' => 1,
    ],
    'attachment_limits' => $attachmentLimits,
    'modes' => [
        ['key' => 'chat', 'label' => 'Чат'],
        ['key' => 'web', 'label' => 'Веб'],
        ['key' => 'documents', 'label' => 'Документы'],
        ['key' => 'canvas', 'label' => 'Холст'],
        ['key' => 'image', 'label' => 'Изображение'],
        ['key' => 'research', 'label' => 'Исследование'],
        ['key' => 'agent', 'label' => 'Агент'],
    ],
    'images_per_day' => acx_canvas_daily_limit(),
    'vision_model' => 'Sight',
    'promo_redeem_url' => '/api/promo.php',
    'provider' => 'kumo',
];

if ($guestMode) {
    $g = acx_guest_state();
    $out['user'] = null;
    $out['usage'] = null;
    $out['guest_usage'] = [
        'daily_user_messages' => (int) ($g['daily_user_msgs'] ?? 0),
        'max_daily_user_messages' => (int) $guestCfg['max_user_messages_per_day'],
        'conversation_count' => count($g['conversations'] ?? []),
        'max_conversations' => (int) $guestCfg['max_conversations'],
    ];
} else {
    $u = $logged;
    $usage = acx_get_weekly_usage($u['internal_id']);
    $memories = acx_memory_list($u['internal_id']);
    $out['user'] = [
        'display_name' => $u['display_name'] !== '' ? $u['display_name'] : (explode('@', $u['email'])[0] ?? 'Пользователь'),
        'email' => $u['email'],
        'avatar_url' => $u['avatar_url'],
    ];
    $out['memories'] = $memories;
    $out['memory_limits'] = $memoryLimits;
    $imgUsed = acx_canvas_daily_count(acx_canvas_subject_key((int) $u['internal_id']));
    $imgCap = acx_canvas_daily_limit();
    $globalUnlimited = !empty($limitsCfg['unlimited']);
    $gaugeTier = static function (int $used, $cap, bool $forceUnlimited = false): array {
        $unlimited = $forceUnlimited || $cap === null;
        if ($unlimited) {
            return [
                'remaining' => null,
                'remaining_pct' => 100,
                'gauge_fill' => 100,
                'unlimited' => true,
            ];
        }
        $capN = max(0, (int) $cap);
        $remaining = max(0, $capN - $used);
        $pct = $capN > 0 ? (int) round(min(100, max(0, ($remaining / $capN) * 100))) : 0;
        return [
            'remaining' => $remaining,
            'remaining_pct' => $pct,
            'gauge_fill' => $pct,
            'unlimited' => false,
        ];
    };
    $tideUsed = (int) $usage['tide_tokens_used'];
    $flairUsed = (int) $usage['flair_tokens_used'];
    $pineUsed = (int) $usage['pine_tokens_used'];
    $tideG = $gaugeTier($tideUsed, $tideCap, $globalUnlimited);
    $flairG = $gaugeTier($flairUsed, $flairCap, $globalUnlimited);
    $pineG = $gaugeTier($pineUsed, $pineCap, $globalUnlimited);
    $out['usage'] = [
        'week_start_utc' => acx_week_start_utc(),
        'tide' => array_merge([
            'kind' => 'tokens',
            'tokens_used' => $tideUsed,
            'tokens_cap' => $tideCap,
        ], $tideG),
        'flair' => array_merge([
            'tokens_used' => $flairUsed,
            'tokens_cap' => $flairCap,
        ], $flairG),
        'pine' => array_merge([
            'kind' => 'requests',
            'tokens_used' => $pineUsed,
            'tokens_cap' => $pineCap,
            'requests_used' => $pineUsed,
            'requests_cap' => $pineCap,
        ], $pineG),
        'images' => [
            'kind' => 'daily',
            'used' => $imgUsed,
            'cap' => $imgCap,
            'remaining' => max(0, $imgCap - $imgUsed),
            'remaining_pct' => $imgCap > 0 ? (int) round(min(100, max(0, (($imgCap - $imgUsed) / $imgCap) * 100))) : 0,
            'gauge_fill' => $imgCap > 0 ? (int) round(min(100, max(0, (($imgCap - $imgUsed) / $imgCap) * 100))) : 0,
        ],
        'unlimited' => $globalUnlimited,
    ];
    $out['subscription'] = acx_subscription_public_for_user((int) $u['internal_id']);
    $out['guest_usage'] = null;
}

acx_json_out(['success' => true, 'data' => $out]);
