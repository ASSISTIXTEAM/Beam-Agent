<?php
declare(strict_types=1);

/**
 * Desktop-bridge-shaped status for cloud UI shims.
 * Mirrors GET http://127.0.0.1:17865/assistix/status fields used by Beam desktop.
 */

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/usage.php';
require_once dirname(__DIR__) . '/lib/oauth.php';
require_once dirname(__DIR__) . '/lib/models.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$action = strtolower(trim((string) ($_GET['action'] ?? 'status')));
$logged = acx_logged_user();

if ($action === 'logout' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    require_once dirname(__DIR__) . '/lib/session.php';
    acx_session_logout();
    echo json_encode(['ok' => true, 'signedIn' => false], JSON_UNESCAPED_UNICODE);
    exit;
}

$loginUrl = acx_oauth_login_url('https://agent.assistix.org/');
$catalog = acx_model_catalog(false);
$models = [];
foreach (['TIDE' => 'tide', 'FLARE' => 'flare', 'PINE' => 'pine'] as $key => $id) {
    if (!isset($catalog[$key])) {
        continue;
    }
    $row = $catalog[$key];
    $models[] = [
        'id' => $id,
        'name' => (string) ($row['name'] ?? $id),
        'description' => (string) ($row['description'] ?? ''),
    ];
}

if ($logged === null) {
    echo json_encode([
        'signedIn' => false,
        'user' => null,
        'pendingUser' => null,
        'quotas' => null,
        'models' => $models,
        'authUrl' => $loginUrl,
        'product' => 'beam-agent-cloud',
        'capabilities' => [
            'computer_use' => false,
            'cloud_workspace' => true,
            'agent_tools' => true,
        ],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$limitsCfg = acx_limits_config_for_user((int) $logged['internal_id']);
$usage = acx_get_weekly_usage((int) $logged['internal_id']);
$tideCap = acx_limits_weekly_tokens($limitsCfg, 'tide');
$flareCap = acx_limits_weekly_tokens($limitsCfg, 'flair');
$pineCap = acx_limits_weekly_tokens($limitsCfg, 'pine');

$quotas = [
    'tide' => [
        'used' => (int) ($usage['tide_tokens_used'] ?? 0),
        'limit' => $tideCap,
    ],
    'flare' => [
        'used' => (int) ($usage['flair_tokens_used'] ?? 0),
        'limit' => $flareCap,
    ],
    'pine' => [
        'used' => (int) ($usage['pine_tokens_used'] ?? 0),
        'limit' => $pineCap,
    ],
    'week_start_utc' => acx_week_start_utc(),
    'unlimited' => !empty($limitsCfg['unlimited']),
];

echo json_encode([
    'signedIn' => true,
    'user' => [
        'display_name' => (string) ($logged['display_name'] ?? ''),
        'email' => (string) ($logged['email'] ?? ''),
        'avatar_url' => (string) ($logged['avatar_url'] ?? ''),
        'id_user_id' => (int) ($logged['id_user_id'] ?? 0),
    ],
    'pendingUser' => null,
    'quotas' => $quotas,
    'models' => $models,
    'authUrl' => $loginUrl,
    'product' => 'beam-agent-cloud',
    'capabilities' => [
        'computer_use' => false,
        'computer_use_note' => 'Desktop Beam Agent only',
        'cloud_workspace' => true,
        'agent_tools' => true,
        'projects' => true,
    ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
