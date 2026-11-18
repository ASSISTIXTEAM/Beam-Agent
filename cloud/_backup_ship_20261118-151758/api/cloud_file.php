<?php
declare(strict_types=1);

/**
 * Serve a file from the durable cloud agent workspace (auth required).
 * GET ?ws=default|p_…&path=rel/file.txt
 */

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/cloud_workspace.php';

$logged = acx_logged_user();
if ($logged === null) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'auth_required']);
    exit;
}

$uid = (int) $logged['internal_id'];
$wsKey = acx_cloud_ws_sanitize((string) ($_GET['ws'] ?? 'default'));
$rel = (string) ($_GET['path'] ?? '');

$path = acx_cloud_workspace_safe_file($uid, $wsKey, $rel);
if ($path === null) {
    http_response_code(404);
    exit;
}

$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$mimeMap = [
    'txt' => 'text/plain; charset=utf-8',
    'md' => 'text/markdown; charset=utf-8',
    'json' => 'application/json; charset=utf-8',
    'html' => 'text/html; charset=utf-8',
    'css' => 'text/css; charset=utf-8',
    'js' => 'text/javascript; charset=utf-8',
    'py' => 'text/x-python; charset=utf-8',
    'php' => 'text/plain; charset=utf-8',
    'csv' => 'text/csv; charset=utf-8',
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'svg' => 'image/svg+xml',
    'pdf' => 'application/pdf',
    'zip' => 'application/zip',
];
$mime = $mimeMap[$ext] ?? 'application/octet-stream';

$name = basename($path);
header('Content-Type: ' . $mime);
header('Content-Disposition: inline; filename="' . rawurlencode($name) . '"');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
readfile($path);
exit;
