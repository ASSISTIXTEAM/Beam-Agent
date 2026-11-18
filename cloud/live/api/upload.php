<?php
declare(strict_types=1);

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/documents.php';
require_once dirname(__DIR__) . '/lib/subscriptions.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    acx_json_out(['success' => false, 'error' => 'method_not_allowed'], 405);
}

$logged = acx_logged_user();
$guestMode = $logged === null;

if (!isset($_FILES['file']) || !is_array($_FILES['file'])) {
    acx_json_out(['success' => false, 'error' => 'no_file'], 400);
}

$file = $_FILES['file'];
if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    acx_json_out(['success' => false, 'error' => 'upload_failed'], 400);
}

$original = (string) ($file['name'] ?? 'file');
$tmp = (string) ($file['tmp_name'] ?? '');
$size = (int) ($file['size'] ?? 0);
$mime = (string) ($file['type'] ?? 'application/octet-stream');

if ($tmp === '' || !is_uploaded_file($tmp)) {
    acx_json_out(['success' => false, 'error' => 'invalid_upload'], 400);
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
if ($finfo) {
    $detected = finfo_file($finfo, $tmp);
    finfo_close($finfo);
    if (is_string($detected) && $detected !== '') {
        $mime = $detected;
    }
}

$kind = acx_documents_detect_kind($mime, $original);
if ($kind === 'unknown') {
    acx_json_out(['success' => false, 'error' => 'Неподдерживаемый тип файла'], 400);
}

$max = acx_documents_max_bytes($kind === 'image' ? 'image' : ($kind === 'pdf' ? 'pdf' : 'doc'));
if ($size > $max) {
    acx_json_out(['success' => false, 'error' => 'Файл слишком большой'], 400);
}

if ($guestMode) {
    if ($kind !== 'image') {
        acx_json_out(['success' => false, 'error' => 'В демо доступны только изображения. Войдите в аккаунт.'], 403);
    }
    $guestDir = acx_documents_root() . '/guest';
    if (!is_dir($guestDir) && !mkdir($guestDir, 0755, true) && !is_dir($guestDir)) {
        acx_json_out(['success' => false, 'error' => 'storage_error'], 500);
    }
    $stored = 'g_' . bin2hex(random_bytes(12)) . '.' . (pathinfo($original, PATHINFO_EXTENSION) ?: 'jpg');
    $dest = $guestDir . '/' . $stored;
    if (!move_uploaded_file($tmp, $dest)) {
        acx_json_out(['success' => false, 'error' => 'save_failed'], 500);
    }
    acx_json_out([
        'success' => true,
        'guest' => true,
        'attachment' => [
            'guest_temp' => true,
            'name' => $original,
            'mime' => $mime,
            'kind' => 'image',
            'is_image' => true,
            'preview_url' => '/api/file.php?guest=' . rawurlencode($stored),
            'path' => $dest,
            'guest_file' => $stored,
        ],
    ]);
}

$uid = (int) $logged['internal_id'];
$convIdIn = isset($_POST['conversation_id']) ? (int) $_POST['conversation_id'] : 0;
$pdo = acx_db();
$limits = acx_attachment_limits_for_user($uid);
$cfg = acx_config();
if (is_array($cfg['attachments'] ?? null)) {
    $limits = array_merge($limits, $cfg['attachments']);
}
if ($convIdIn > 0) {
    $st = $pdo->prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?');
    $st->execute([$convIdIn, $uid]);
    if (!$st->fetch()) {
        $convIdIn = 0;
    }
}
$scopeSql = $convIdIn > 0
    ? 'user_id = ? AND (conversation_id = ? OR conversation_id IS NULL)'
    : 'user_id = ? AND conversation_id IS NULL AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)';
$scopeParams = $convIdIn > 0 ? [$uid, $convIdIn] : [$uid];
$st = $pdo->prepare('SELECT COUNT(*) FROM attachments WHERE ' . $scopeSql);
$st->execute($scopeParams);
$existingCount = (int) $st->fetchColumn();
if ($existingCount >= (int) $limits['max_per_conversation']) {
    acx_json_out(['success' => false, 'error' => 'Лимит: не более ' . (int) $limits['max_per_conversation'] . ' вложений на чат'], 403);
}
$st = $pdo->prepare('SELECT storage_path FROM attachments WHERE ' . $scopeSql);
$st->execute($scopeParams);
$totalBytes = 0;
while ($row = $st->fetch()) {
    $p = dirname(__DIR__) . '/' . ltrim((string) $row['storage_path'], '/');
    if (is_file($p)) {
        $totalBytes += (int) filesize($p);
    }
}
if ($totalBytes + $size > (int) $limits['max_total_bytes']) {
    $mb = max(1, (int) round(((int) $limits['max_total_bytes']) / (1024 * 1024)));
    acx_json_out(['success' => false, 'error' => 'Общий размер вложений в чате не более ' . $mb . ' МБ'], 403);
}

$root = acx_documents_root();
$userDir = $root . '/' . $uid;
if (!is_dir($userDir) && !mkdir($userDir, 0755, true) && !is_dir($userDir)) {
    acx_json_out(['success' => false, 'error' => 'storage_error'], 500);
}

$ext = pathinfo($original, PATHINFO_EXTENSION);
$ext = $ext !== '' ? strtolower($ext) : $kind;
$stored = bin2hex(random_bytes(16)) . '.' . $ext;
$dest = $userDir . '/' . $stored;
if (!move_uploaded_file($tmp, $dest)) {
    acx_json_out(['success' => false, 'error' => 'save_failed'], 500);
}

$extracted = acx_documents_extract($dest, $original, $mime);
$relPath = 'storage/uploads/' . $uid . '/' . $stored;
$meta = [
    'kind' => $extracted['kind'],
    'is_image' => !empty($extracted['is_image']),
    'warning' => $extracted['warning'] ?? null,
    'size' => $size,
    'extract_status' => $extracted['extract_status'] ?? 'done',
    'extract_engine' => $extracted['extract_engine'] ?? null,
    'extract_meta' => $extracted['extract_meta'] ?? [],
];

$pdo->prepare(
    'INSERT INTO attachments (user_id, conversation_id, original_name, mime_type, storage_path, extracted_text, meta_json) VALUES (?,?,?,?,?,?,?)'
)->execute([
    $uid,
    $convIdIn > 0 ? $convIdIn : null,
    $original,
    $mime,
    $relPath,
    (string) ($extracted['text'] ?? ''),
    json_encode($meta, JSON_UNESCAPED_UNICODE),
]);
$id = (int) $pdo->lastInsertId();

acx_json_out([
    'success' => true,
    'attachment' => [
        'id' => $id,
        'name' => $original,
        'mime' => $mime,
        'kind' => $extracted['kind'],
        'is_image' => !empty($extracted['is_image']),
        'text' => (string) ($extracted['text'] ?? ''),
        'warning' => $extracted['warning'] ?? null,
        'preview_url' => '/api/file.php?id=' . $id,
        'extract_status' => $extracted['extract_status'] ?? 'done',
        'extract_engine' => $extracted['extract_engine'] ?? null,
        'extract_meta' => $extracted['extract_meta'] ?? [],
    ],
]);
