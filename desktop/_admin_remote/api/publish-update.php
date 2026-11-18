<?php
/**
 * Ops: publish a Beam Agent desktop package as the sole latest release.
 * Auth: Bearer / X-Beam-Update-Token / ?key=  (BEAM_UPDATE_TOKEN env or default ops token)
 *
 * POST multipart:
 *   package  – Setup.exe (required)
 *   version  – semver string (required)
 *   notes    – short changelog (optional)
 *   channel  – nightly|latest (optional, default nightly)
 *
 * Or JSON body with base64 "packageBase64" for small test payloads (not for full installers).
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, X-Beam-Update-Token');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST only']);
    exit;
}

$EXPECTED = getenv('BEAM_UPDATE_TOKEN') ?: (getenv('BEAM_OPS_TOKEN') ?: 'YOUR_UPDATE_TOKEN_HERE');
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$keyHeader = $_SERVER['HTTP_X_BEAM_UPDATE_TOKEN'] ?? '';
$token = '';
if (preg_match('/Bearer\s+(.+)/i', $auth, $m)) $token = trim($m[1]);
elseif ($keyHeader !== '') $token = trim($keyHeader);
elseif (isset($_GET['key'])) $token = trim((string)$_GET['key']);

if (!hash_equals($EXPECTED, $token)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'unauthorized']);
    exit;
}

$agentRoot = '/var/www/u3354161/data/www/agent.assistix.org';
$updatesDir = $agentRoot . '/updates';
$downloadDir = $agentRoot . '/download';

foreach ([$updatesDir, $downloadDir] as $dir) {
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'mkdir_failed', 'dir' => $dir]);
        exit;
    }
}

$version = '';
$notes = '';
$channel = 'nightly';
$tmpPackage = null;
$origName = 'Beam-Agent-Setup.exe';

$contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'multipart/form-data') !== false || !empty($_FILES)) {
    $version = trim((string)($_POST['version'] ?? ''));
    $notes = trim((string)($_POST['notes'] ?? $_POST['changelog'] ?? ''));
    $channel = trim((string)($_POST['channel'] ?? 'nightly'));
    if (empty($_FILES['package']) || !is_uploaded_file($_FILES['package']['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'package_required']);
        exit;
    }
    $tmpPackage = $_FILES['package']['tmp_name'];
    $origName = basename((string)($_FILES['package']['name'] ?: 'Beam-Agent-Setup.exe'));
} else {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: 'null', true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'invalid_body']);
        exit;
    }
    $version = trim((string)($body['version'] ?? ''));
    $notes = trim((string)($body['notes'] ?? $body['changelog'] ?? ''));
    $channel = trim((string)($body['channel'] ?? 'nightly'));
    if (!empty($body['packagePath']) && is_file($body['packagePath'])) {
        // Server-local path publish (ops SSH drop then activate)
        $tmpPackage = $body['packagePath'];
        $origName = basename((string)($body['file'] ?? $tmpPackage));
    } elseif (!empty($body['packageBase64'])) {
        $bin = base64_decode((string)$body['packageBase64'], true);
        if ($bin === false) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'bad_base64']);
            exit;
        }
        $tmpPackage = tempnam(sys_get_temp_dir(), 'beamupd');
        file_put_contents($tmpPackage, $bin);
        $origName = basename((string)($body['file'] ?? 'Beam-Agent-Setup.exe'));
    } else {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'package_required']);
        exit;
    }
}

if ($version === '' || !preg_match('/^\d+\.\d+\.\d+/', $version)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'version_required']);
    exit;
}
if ($channel !== 'nightly' && $channel !== 'latest') $channel = 'nightly';
if (!is_string($tmpPackage) || !is_file($tmpPackage)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'package_missing']);
    exit;
}

$size = filesize($tmpPackage);
$sha512 = base64_encode(hash_file('sha512', $tmpPackage, true));
$sha256 = hash_file('sha256', $tmpPackage);
$safeBase = preg_replace('/[^A-Za-z0-9._-]/', '-', $origName) ?: 'Beam-Agent-Setup.exe';
if (!preg_match('/\.exe$/i', $safeBase)) $safeBase .= '.exe';
// Prefer stable latest filename + versioned alias
$versionedName = 'Beam-Agent-' . preg_replace('/[^A-Za-z0-9._-]/', '-', $version) . '-Setup.exe';
$stableName = 'Beam-Agent-Setup.exe';

$releaseDate = gmdate('c');
$downloadUrl = 'https://agent.assistix.org/updates/' . rawurlencode($versionedName);

// Prune previous artifacts in updates/ (keep htaccess/index if any)
$keepNames = ['.htaccess', 'index.html', 'index.php', '.', '..'];
foreach (scandir($updatesDir) ?: [] as $entry) {
    if (in_array($entry, $keepNames, true)) continue;
    $path = $updatesDir . '/' . $entry;
    if (is_file($path)) @unlink($path);
}

$destVersioned = $updatesDir . '/' . $versionedName;
$destStable = $updatesDir . '/' . $stableName;
if (!@copy($tmpPackage, $destVersioned)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'store_failed']);
    exit;
}
@copy($destVersioned, $destStable);
@chmod($destVersioned, 0644);
@chmod($destStable, 0644);

$manifest = [
    'ok' => true,
    'version' => $version,
    'releaseDate' => $releaseDate,
    'notes' => $notes,
    'changelog' => $notes,
    'file' => $versionedName,
    'stableFile' => $stableName,
    'size' => $size,
    'sha512' => $sha512,
    'sha256' => $sha256,
    'downloadUrl' => $downloadUrl,
    'channel' => $channel,
    'minAppVersion' => null,
];
file_put_contents(
    $updatesDir . '/manifest.json',
    json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"
);

// electron-updater generic feed (mirror into /download, prune old Setup.exe)
$yml =
    "version: {$version}\n" .
    "files:\n" .
    "  - url: {$versionedName}\n" .
    "    sha512: {$sha512}\n" .
    "    size: {$size}\n" .
    "path: {$versionedName}\n" .
    "sha512: {$sha512}\n" .
    "releaseDate: '{$releaseDate}'\n";

foreach (scandir($downloadDir) ?: [] as $entry) {
    if (in_array($entry, ['.', '..', '.htaccess', 'index.html', 'index.php'], true)) continue;
    if (preg_match('/\.(exe|yml)$/i', $entry) || $entry === 'update-feed-meta.json') {
        @unlink($downloadDir . '/' . $entry);
    }
}
@copy($destVersioned, $downloadDir . '/' . $versionedName);
@copy($destVersioned, $downloadDir . '/' . $stableName);
// Also keep legacy Early-Alpha filename if version looks like early-alpha
$legacy = 'Beam-Agent-' . preg_replace('/[^A-Za-z0-9._-]/', '-', $version) . '.exe';
if (stripos($version, 'early') !== false) {
    $legacy = 'Beam-Agent-' . str_replace('-early-alpha', '-Early-Alpha', $version) . '-Setup.exe';
    // Beam-Agent-0.1.3-Early-Alpha-Setup.exe style
    $parts = explode('-', $version, 2);
    if (count($parts) === 2) {
        $legacy = 'Beam-Agent-' . $parts[0] . '-Early-Alpha-Setup.exe';
    }
    @copy($destVersioned, $downloadDir . '/' . $legacy);
    // Prefer yml pointing at the early-alpha named file electron-updater historically used
    $yml =
        "version: {$version}\n" .
        "files:\n" .
        "  - url: {$legacy}\n" .
        "    sha512: {$sha512}\n" .
        "    size: {$size}\n" .
        "path: {$legacy}\n" .
        "sha512: {$sha512}\n" .
        "releaseDate: '{$releaseDate}'\n";
    $manifest['feedFile'] = $legacy;
}
file_put_contents($downloadDir . '/nightly.yml', $yml);
file_put_contents($downloadDir . '/latest.yml', $yml);
file_put_contents($updatesDir . '/nightly.yml', $yml);
file_put_contents($updatesDir . '/latest.yml', $yml);

$meta = [
    'version' => $version,
    'file' => $manifest['feedFile'] ?? $versionedName,
    'size' => $size,
    'sha512' => $sha512,
    'urls' => [
        'page' => 'https://agent.assistix.org/download/',
        'exe' => 'https://agent.assistix.org/updates/' . rawurlencode($versionedName),
        'nightly' => 'https://agent.assistix.org/download/nightly.yml',
        'latest' => 'https://agent.assistix.org/download/latest.yml',
        'manifest' => 'https://agent.assistix.org/updates/manifest.json',
        'check' => 'https://agent.assistix.org/api/check-update.php',
    ],
];
file_put_contents($downloadDir . '/update-feed-meta.json', json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
file_put_contents($updatesDir . '/manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");

echo json_encode([
    'ok' => true,
    'published' => $manifest,
    'pruned' => true,
    'paths' => [
        'updates' => $updatesDir,
        'download' => $downloadDir,
    ],
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
