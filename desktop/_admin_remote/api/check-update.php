<?php
/**
 * Public Beam Agent desktop update check.
 * GET /api/check-update.php?current=0.1.3-early-alpha
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Beam-Client-Version');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Cache-Control: no-store, max-age=0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'GET only']);
    exit;
}

$rootCandidates = [
    dirname(__DIR__, 2) . '/updates',                         // agent.assistix.org/updates
    '/var/www/u3354161/data/www/agent.assistix.org/updates',
];
$updatesDir = null;
foreach ($rootCandidates as $dir) {
    if (is_dir($dir)) {
        $updatesDir = $dir;
        break;
    }
}

$manifestPath = $updatesDir ? ($updatesDir . '/manifest.json') : null;
$manifest = null;
if ($manifestPath && is_file($manifestPath)) {
    $raw = file_get_contents($manifestPath);
    $manifest = json_decode($raw ?: 'null', true);
}

if (!is_array($manifest) || empty($manifest['version'])) {
    http_response_code(404);
    echo json_encode([
        'ok' => false,
        'error' => 'no_release',
        'updateAvailable' => false,
    ]);
    exit;
}

$current = trim((string)($_GET['current'] ?? $_SERVER['HTTP_X_BEAM_CLIENT_VERSION'] ?? ''));
$latest = trim((string)$manifest['version']);
$updateAvailable = false;
if ($current !== '' && $latest !== '') {
    // Normalize early-alpha style tags for version_compare
    $a = preg_replace('/[^0-9A-Za-z\.\-\+]/', '', $current);
    $b = preg_replace('/[^0-9A-Za-z\.\-\+]/', '', $latest);
    $updateAvailable = version_compare($b, $a, '>');
} elseif ($latest !== '') {
    $updateAvailable = true;
}

$downloadUrl = (string)($manifest['downloadUrl'] ?? $manifest['url'] ?? '');
if ($downloadUrl === '' && !empty($manifest['file'])) {
    $downloadUrl = 'https://agent.assistix.org/updates/' . rawurlencode((string)$manifest['file']);
}

$criticalFlag = !empty($manifest['critical']) || !empty($manifest['mandatory']) || !empty($manifest['force']);
// Critical only binds when a newer package is actually available for this client.
$critical = $updateAvailable && $criticalFlag;

echo json_encode([
    'ok' => true,
    'updateAvailable' => $updateAvailable,
    'critical' => $critical,
    'mandatory' => $critical,
    'version' => $latest,
    'current' => $current !== '' ? $current : null,
    'releaseDate' => $manifest['releaseDate'] ?? null,
    'notes' => $manifest['notes'] ?? $manifest['changelog'] ?? '',
    'downloadUrl' => $downloadUrl,
    'sha512' => $manifest['sha512'] ?? null,
    'sha256' => $manifest['sha256'] ?? null,
    'size' => isset($manifest['size']) ? (int)$manifest['size'] : null,
    'file' => $manifest['file'] ?? null,
    'channel' => $manifest['channel'] ?? 'nightly',
    'minAppVersion' => $manifest['minAppVersion'] ?? null,
    'feed' => [
        'nightly' => 'https://agent.assistix.org/download/nightly.yml',
        'latest' => 'https://agent.assistix.org/download/latest.yml',
        'updates' => 'https://agent.assistix.org/updates/manifest.json',
    ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
