<?php
declare(strict_types=1);

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/documents.php';

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
$guestFile = trim((string) ($_GET['guest'] ?? ''));

if ($guestFile !== '') {
    if (!preg_match('/^g_[a-f0-9]+\.(jpg|jpeg|png|webp|gif)$/i', $guestFile)) {
        http_response_code(404);
        exit;
    }
    $path = acx_documents_root() . '/guest/' . $guestFile;
    if (!is_readable($path)) {
        http_response_code(404);
        exit;
    }
    $ext = strtolower(pathinfo($guestFile, PATHINFO_EXTENSION));
    $mime = match ($ext) {
        'png' => 'image/png',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        default => 'image/jpeg',
    };
    header('Content-Type: ' . $mime);
    header('Cache-Control: private, max-age=300');
    readfile($path);
    exit;
}

if ($id <= 0) {
    http_response_code(404);
    exit;
}

$logged = acx_logged_user();
if ($logged === null) {
    http_response_code(403);
    exit;
}

$pdo = acx_db();
$st = $pdo->prepare('SELECT * FROM attachments WHERE id = ? AND user_id = ?');
$st->execute([$id, $logged['internal_id']]);
$row = $st->fetch();
if (!$row) {
    http_response_code(404);
    exit;
}

$path = acx_root() . '/' . ltrim((string) $row['storage_path'], '/');
if (!is_readable($path)) {
    http_response_code(404);
    exit;
}

$mime = (string) ($row['mime_type'] ?? 'application/octet-stream');
header('Content-Type: ' . $mime);
header('Content-Disposition: inline; filename="' . rawurlencode((string) $row['original_name']) . '"');
header('Cache-Control: private, max-age=3600');
readfile($path);
