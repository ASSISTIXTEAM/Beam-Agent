<?php
declare(strict_types=1);

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/users.php';
require_once dirname(__DIR__) . '/lib/memory.php';
require_once dirname(__DIR__) . '/lib/usage.php';
require_once dirname(__DIR__) . '/lib/subscriptions.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$logged = acx_logged_user();

if ($method === 'GET') {
    if ($logged === null) {
        acx_json_out(['success' => true, 'authenticated' => false]);
    }

    $limitsCfg = acx_limits_config_for_user($logged['internal_id']);
    $usage = acx_get_weekly_usage($logged['internal_id']);
    $memories = acx_memory_list($logged['internal_id']);
    $memoryLimits = acx_memory_limits_for_user($logged['internal_id']);
    $flairCap = acx_limits_weekly_tokens($limitsCfg, 'flair');
    $pineCap = acx_limits_weekly_tokens($limitsCfg, 'pine');

    acx_json_out([
        'success' => true,
        'authenticated' => true,
        'user' => [
            'display_name' => $logged['display_name'] !== '' ? $logged['display_name'] : (explode('@', $logged['email'])[0] ?? 'Пользователь'),
            'email' => $logged['email'],
            'avatar_url' => $logged['avatar_url'],
            'subscription_tier' => acx_subscription_tier_for_user($logged['internal_id']),
        ],
        'memories' => $memories,
        'memory_limits' => $memoryLimits,
        'subscription' => acx_subscription_public_for_user($logged['internal_id']),
        'usage' => (static function () use ($usage, $flairCap, $pineCap, $limitsCfg) {
            $unlimited = !empty($limitsCfg['unlimited']);
            $tier = static function (int $used, $cap) use ($unlimited): array {
                if ($unlimited || $cap === null) {
                    return [
                        'tokens_used' => $used,
                        'tokens_cap' => $cap,
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
                    'tokens_used' => $used,
                    'tokens_cap' => $cap,
                    'remaining' => $remaining,
                    'remaining_pct' => $pct,
                    'gauge_fill' => $pct,
                    'unlimited' => false,
                ];
            };
            return [
                'week_start_utc' => acx_week_start_utc(),
                'flair' => $tier((int) $usage['flair_tokens_used'], $flairCap),
                'pine' => $tier((int) $usage['pine_tokens_used'], $pineCap),
                'unlimited' => $unlimited,
            ];
        })(),
        // Beam Code использует тот же недельный бюджет (единая таблица weekly_usage),
        // поэтому здесь показываем, сколько уже израсходовано в экосистеме в целом.
        'beam' => (static function () use ($usage, $flairCap, $pineCap, $limitsCfg) {
            $unlimited = !empty($limitsCfg['unlimited']);
            $tier = static function (int $used, $cap) use ($unlimited): array {
                if ($unlimited || $cap === null) {
                    return [
                        'tokens_used' => $used,
                        'tokens_cap' => $cap,
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
                    'tokens_used' => $used,
                    'tokens_cap' => $cap,
                    'remaining' => $remaining,
                    'remaining_pct' => $pct,
                    'gauge_fill' => $pct,
                    'unlimited' => false,
                ];
            };
            return [
                'app' => 'Beam Code',
                'url' => 'https://code.assistix.org',
                'shared_budget' => true,
                'flair' => $tier((int) $usage['flair_tokens_used'], $flairCap),
                'pine' => $tier((int) $usage['pine_tokens_used'], $pineCap),
            ];
        })(),
    ]);
}

if ($method !== 'POST') {
    acx_json_out(['success' => false, 'error' => 'method_not_allowed'], 405);
}

if ($logged === null) {
    acx_json_out(['success' => false, 'error' => 'auth_required'], 401);
}

$raw = file_get_contents('php://input');
$in = json_decode((string) $raw, true);
if (!is_array($in)) {
    acx_json_out(['success' => false, 'error' => 'invalid_json'], 400);
}

$displayName = trim((string) ($in['display_name'] ?? ''));
if ($displayName === '') {
    acx_json_out(['success' => false, 'error' => 'empty_name'], 400);
}

$user = acx_update_user_profile($logged['internal_id'], $displayName);
if ($user === null) {
    acx_json_out(['success' => false, 'error' => 'update_failed'], 500);
}

$deleteIds = isset($in['delete_memory_ids']) && is_array($in['delete_memory_ids'])
    ? array_map('intval', $in['delete_memory_ids'])
    : [];
$memoryItems = isset($in['memories']) && is_array($in['memories']) ? $in['memories'] : [];
$memories = acx_memory_save_batch($logged['internal_id'], $memoryItems, $deleteIds);

acx_json_out([
    'success' => true,
    'user' => [
        'display_name' => $user['display_name'] !== '' ? $user['display_name'] : (explode('@', $user['email'])[0] ?? 'Пользователь'),
        'email' => $user['email'],
        'avatar_url' => $user['avatar_url'],
    ],
    'memories' => $memories,
]);
