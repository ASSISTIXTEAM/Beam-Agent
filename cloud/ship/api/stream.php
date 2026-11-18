<?php
declare(strict_types=1);

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/guest.php';
require_once dirname(__DIR__) . '/lib/ai.php';
require_once dirname(__DIR__) . '/lib/search.php';
require_once dirname(__DIR__) . '/lib/documents.php';
require_once dirname(__DIR__) . '/lib/vision.php';
require_once dirname(__DIR__) . '/lib/pdf_vision.php';
require_once dirname(__DIR__) . '/lib/research.php';
require_once dirname(__DIR__) . '/lib/usage.php';
require_once dirname(__DIR__) . '/lib/ratelimit.php';
require_once dirname(__DIR__) . '/lib/memory.php';
require_once dirname(__DIR__) . '/lib/widgets.php';
require_once dirname(__DIR__) . '/lib/keyboard_layout.php';
require_once dirname(__DIR__) . '/lib/text_sanitize.php';
require_once dirname(__DIR__) . '/lib/subscriptions.php';
require_once dirname(__DIR__) . '/lib/images.php';
require_once dirname(__DIR__) . '/lib/canvas.php';
require_once dirname(__DIR__) . '/lib/promo.php';
require_once dirname(__DIR__) . '/lib/economy.php';
require_once dirname(__DIR__) . '/lib/agent.php';
require_once dirname(__DIR__) . '/lib/agent_runs.php';
require_once dirname(__DIR__) . '/lib/cloud_workspace.php';
require_once dirname(__DIR__) . '/lib/projects.php';

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

$raw = file_get_contents('php://input');
$in = json_decode((string) $raw, true);
if (!is_array($in)) {
    acx_json_out(['success' => false, 'error' => 'invalid_json'], 400);
}

$message = trim((string) ($in['message'] ?? ''));
$researchContinue = !empty($in['research_continue']);
$researchBase = trim((string) ($in['research_base'] ?? ''));
$researchQuery = trim((string) ($in['research_query'] ?? ''));
if ($researchContinue && $researchBase !== '') {
    $message = "Продолжи исследовательский отчёт (ещё примерно 5 страниц Word, ~2500–3500 слов). "
        . "Не повторяй уже написанное, продолжай с новых разделов ## и углубляй тему.\n\n"
        . "Уже написано:\n" . mb_substr($researchBase, -acx_economy_int('doc_context_chars', 2500));
}
$modelKey = strtoupper(trim((string) ($in['model'] ?? '')));
$web = !empty($in['web']);
$mode = strtolower(trim((string) ($in['mode'] ?? 'chat')));
$attachmentsIn = isset($in['attachments']) && is_array($in['attachments']) ? $in['attachments'] : [];
$convIdIn = isset($in['conversation_id']) ? (int) $in['conversation_id'] : 0;
$projectIdIn = trim((string) ($in['project_id'] ?? ''));
$localId = trim((string) ($in['local_id'] ?? ''));
$locale = acx_normalize_locale((string) ($in['locale'] ?? ''));
$ephemeral = !empty($in['ephemeral']);

if ($message === '' && $attachmentsIn === []) {
    acx_json_out(['success' => false, 'error' => 'empty_message'], 400);
}

@set_time_limit(0);
@ignore_user_abort(true);

// Клиент уходит (Esc/повторный send) → не тратим токены на «мёртвый» ответ.
ignore_user_abort(false);

$logged = acx_logged_user();
$guestMode = $logged === null;
if ($guestMode) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'auth_required', 'login_url' => '/auth/login.php'], JSON_UNESCAPED_UNICODE);
    exit;
}
$catalog = acx_model_catalog($guestMode);
$limitsCfg = $guestMode ? acx_limits_config() : acx_limits_config_for_user((int) $logged['internal_id']);
$guestCfg = acx_guest_config();

if ($modelKey === '') {
    $modelKey = acx_default_model_key($guestMode);
}
$modelRow = acx_resolve_model($modelKey, $guestMode, $catalog);

$resolved = acx_resolve_stream_model(
    $modelKey,
    $mode,
    $guestMode,
    $catalog,
    $logged ? (int) $logged['internal_id'] : null,
    $limitsCfg
);
$modelRow = $resolved['model_row'];
$modelKey = $resolved['model_key'];
$modelFallbackFrom = $resolved['fallback_from'];

if ($mode === 'web') {
    $web = true;
}
if ($mode === 'documents' && $attachmentsIn === []) {
    acx_json_out(['success' => false, 'error' => 'Прикрепите файл для режима «Документы».'], 400);
}
// image без вложений = генерация по тексту; с вложениями = анализ (Sight).
if ($mode === 'image' && !acx_has_images_in_attachments($attachmentsIn) && $message === '') {
    acx_json_out(['success' => false, 'error' => 'Опишите изображение для генерации или прикрепите файл для анализа.'], 400);
}
if ($mode === 'canvas' && $message === '' && $attachmentsIn === []) {
    acx_json_out(['success' => false, 'error' => 'Опишите, что нарисовать на холсте.'], 400);
}
if ($mode === 'agent') {
    $web = true;
}

$attachmentMeta = acx_stream_resolve_attachments($attachmentsIn, $logged, $guestMode);
if (isset($attachmentMeta['error'])) {
    acx_json_out(['success' => false, 'error' => $attachmentMeta['error']], 400);
}

$items = $attachmentMeta['items'] ?? [];
$visionOk = acx_vision_api_available();

if ($visionOk) {
    $items = acx_stream_resolve_inline_vision($attachmentsIn, $items);
    $items = acx_pdf_prepare_vision_attachments($items);
} else {
    $items = acx_pdf_enrich_text_for_items($items);
}

$attachmentMeta['items'] = $items;

$docContext = acx_stream_build_doc_context($items);
$hasImages = acx_has_images_in_attachments($items);
$pdfScanIntent = acx_attachments_pdf_scan_intent($items, $attachmentsIn);

if ($pdfScanIntent && !$visionOk) {
    $items = acx_pdf_strip_scan_images($items);
    $items = acx_pdf_enrich_text_for_items($items);
    $attachmentMeta['items'] = $items;
    $docContext = acx_stream_build_doc_context($items);
    $hasImages = acx_has_images_in_attachments($items);
    if ($mode === 'chat' || $mode === 'documents' || $mode === 'image') {
        $mode = 'documents';
    }
}
if (!$hasImages && $pdfScanIntent && $mode === 'image' && $docContext !== '') {
    $mode = 'documents';
}

$userContent = $message;
if ($docContext !== '') {
    $userContent = ($userContent !== '' ? $userContent . "\n\n" : '') . $docContext;
}
if ($hasImages && acx_attachments_include_pdf_scan($items)) {
    $scanNote = match (acx_normalize_locale($locale)) {
        'ru' => '[PDF-скан: страницы переданы как изображения ниже. Распознай текст и ответь по запросу пользователя.]',
        'it' => '[Scansione PDF: le pagine sono inviate come immagini sotto. Esegui OCR e rispondi alla richiesta.]',
        default => '[PDF scan: pages are attached as images below. OCR the content and answer the user\'s request.]',
    };
    $userContent = ($userContent !== '' ? $userContent . "\n\n" : '') . $scanNote;
}
if ($hasImages && in_array($mode, ['chat', 'documents'], true) && $items !== []) {
    $mode = 'image';
}
$docReadyErr = acx_stream_validate_doc_ready($items, $mode, $docContext, $hasImages, $locale);
if ($docReadyErr !== null) {
    acx_json_out(['success' => false, 'error' => $docReadyErr], 422);
}

$layoutHit = (!$researchContinue && $message !== '') ? acx_layout_analyze($message) : null;

// Все проверки позади: отвечаем уже SSE. Заголовки и первый байт уходят
// сразу — до лимитов, истории и запроса к модели, чтобы браузер не «думал».
acx_stream_sse_begin();
require_once dirname(__DIR__) . '/lib/stream_job.php';
acx_stream_job_boot_from_request($in);
acx_stream_headers_flush();

try {
    if ($guestMode) {
        acx_stream_guest($in, $userContent, $message, $modelRow, $guestCfg, $web, $mode, $localId, $attachmentMeta['items'] ?? [], $hasImages, $locale, $ephemeral, $modelFallbackFrom, $researchContinue, $researchQuery, $layoutHit);
    }
    acx_stream_user($logged, $userContent, $message, $modelRow, $limitsCfg, $web, $mode, $convIdIn, $attachmentMeta['items'] ?? [], $hasImages, $locale, $ephemeral, $modelKey, $modelFallbackFrom, $researchContinue, $researchQuery, $layoutHit);
} catch (Throwable $e) {
    error_log('stream api: ' . $e->getMessage());
    $jobId = acx_stream_job_active_id();
    if ($jobId !== '') {
        acx_stream_job_finish($jobId, 'error', 'server_error');
    }
    if (headers_sent()) {
        acx_chat_emit_stream_error(acx_sanitize_public_error('server_error', $locale));
        acx_stream_job_finish(acx_stream_job_active_id());
        acx_stream_write("data: [DONE]\n\n");
        exit;
    }
    acx_json_out(['success' => false, 'error' => 'server_error'], 500);
}

/**
 * @param list<array<string,mixed>> $attachmentsIn
 * @return array{items?:list<array<string,mixed>>,error?:string}
 */
function acx_stream_resolve_attachments(array $attachmentsIn, ?array $logged, bool $guestMode): array
{
    if ($attachmentsIn === []) {
        return ['items' => []];
    }

    if ($guestMode) {
        $images = 0;
        foreach ($attachmentsIn as $a) {
            if (!empty($a['is_image'])) {
                $images++;
            }
        }
        if ($images > 1 || count($attachmentsIn) > 1) {
            return ['error' => 'В демо доступно одно изображение. Войдите для полного доступа к файлам.'];
        }
        foreach ($attachmentsIn as $a) {
            if (empty($a['is_image']) && empty($a['guest_temp'])) {
                return ['error' => 'В демо PDF и документы недоступны. Войдите в аккаунт.'];
            }
        }
        $items = [];
        foreach ($attachmentsIn as $a) {
            if (!is_array($a)) {
                continue;
            }
            $path = (string) ($a['path'] ?? '');
            if ($path === '' && !empty($a['guest_file'])) {
                $path = acx_documents_root() . '/guest/' . basename((string) $a['guest_file']);
            }
            $items[] = array_merge($a, ['path' => $path]);
        }

        return ['items' => $items];
    }

    $pdo = acx_db();
    $uid = (int) $logged['internal_id'];
    $out = [];
    foreach ($attachmentsIn as $a) {
        if (!is_array($a)) {
            continue;
        }
        $id = (int) ($a['id'] ?? 0);
        if ($id <= 0) {
            continue;
        }
        $st = $pdo->prepare('SELECT * FROM attachments WHERE id = ? AND user_id = ?');
        $st->execute([$id, $uid]);
        $row = $st->fetch();
        if (!$row) {
            continue;
        }
        $path = acx_root() . '/' . ltrim((string) $row['storage_path'], '/');
        $meta = [];
        if (!empty($row['meta_json'])) {
            $decoded = json_decode((string) $row['meta_json'], true);
            if (is_array($decoded)) {
                $meta = $decoded;
            }
        }
        $out[] = [
            'id' => $id,
            'name' => (string) $row['original_name'],
            'mime' => (string) $row['mime_type'],
            'path' => $path,
            'kind' => (string) ($meta['kind'] ?? ''),
            'is_image' => !empty($meta['is_image']),
            'text' => (string) ($row['extracted_text'] ?? ''),
            'preview_url' => '/api/file.php?id=' . $id,
            'extract_status' => (string) ($meta['extract_status'] ?? 'done'),
            'extract_engine' => $meta['extract_engine'] ?? null,
            'extract_meta' => is_array($meta['extract_meta'] ?? null) ? $meta['extract_meta'] : [],
        ];
    }

    return ['items' => $out];
}

/**
 * @param list<array<string,mixed>> $items
 */
function acx_stream_build_doc_context(array $items): string
{
    $blocks = [];
    foreach ($items as $a) {
        if (!is_array($a) || !empty($a['is_image'])) {
            continue;
        }
        $text = trim((string) ($a['text'] ?? ''));
        if ($text === '') {
            continue;
        }
        $name = (string) ($a['name'] ?? 'file');
        $meta = is_array($a['extract_meta'] ?? null) ? $a['extract_meta'] : [];
        if ($meta !== [] || ($a['kind'] ?? '') === 'pdf') {
            $blocks[] = acx_documents_wrap_context_rich($name, $text, $meta);
        } else {
            $blocks[] = acx_documents_wrap_context($name, $text);
        }
    }
    $out = implode("\n\n", $blocks);
    if ($out !== '' && function_exists('acx_economy_truncate')) {
        $out = acx_economy_truncate($out, acx_economy_int('doc_context_chars', 2500));
    }

    return $out;
}

/**
 * @param list<array<string,mixed>> $items
 */
function acx_stream_validate_doc_ready(array $items, string $mode, string $docContext, bool $hasImages, string $locale): ?string
{
    if (!in_array($mode, ['documents', 'image'], true)) {
        return null;
    }
    $hasFile = false;
    foreach ($items as $a) {
        if (!is_array($a)) {
            continue;
        }
        if (($a['kind'] ?? '') === 'pdf' || !empty($a['from_pdf'])) {
            $hasFile = true;
            break;
        }
    }
    if (!$hasFile && $items !== []) {
        $hasFile = true;
    }
    if (!$hasFile) {
        return null;
    }

    if ($hasImages) {
        foreach ($items as $a) {
            if (!is_array($a) || empty($a['is_image'])) {
                continue;
            }
            $path = (string) ($a['path'] ?? '');
            if ($path !== '' && is_readable($path)) {
                return null;
            }
        }

        return acx_locale_error('pdf.no_content', $locale);
    }

    if (trim($docContext) === '') {
        return acx_locale_error('pdf.no_content', $locale);
    }

    return null;
}

/**
 * Текстовый fallback для PDF-скана, если Sight/vision недоступен или упал.
 *
 * @param list<array<string,mixed>> $attachments
 * @param list<array<string,mixed>> $hist
 * @return array<string,mixed>|null
 */
function acx_stream_build_pdf_text_fallback(
    array $hist,
    bool $web,
    string $displayMessage,
    array $attachments,
    array $modelRow,
    int $userId,
    string $userDisplayName,
    string $locale
): ?array {
    $docItems = acx_pdf_strip_scan_images($attachments);
    $docItems = acx_pdf_enrich_text_for_items($docItems);
    $docContext = acx_stream_build_doc_context($docItems);
    if ($docContext === '') {
        return null;
    }

    $note = match (acx_normalize_locale($locale)) {
        'ru' => '[PDF передан как извлечённый текст — модель Sight сейчас недоступна.]',
        'it' => '[PDF inviato come testo estratto — il modello Sight non è disponibile.]',
        default => '[PDF provided as extracted text — Sight vision is unavailable.]',
    };
    $content = ($displayMessage !== '' ? $displayMessage . "\n\n" : '') . $docContext . "\n\n" . $note;
    $msgs = acx_stream_build_api_messages(
        $hist,
        $web,
        'documents',
        $content,
        $docItems,
        false,
        $modelRow,
        $userId,
        $userDisplayName,
        $locale
    );

    $cfg = acx_config();
    $nvKey = trim((string) ($cfg['nvidia']['api_key'] ?? ''));
    $ioModel = trim((string) ($modelRow['ionet_model'] ?? ''));

    return [
        'messages' => $msgs,
        'model' => acx_model_api_id($modelRow, false),
        'max_tokens' => (int) ($modelRow['max_tokens'] ?? 4096),
        'temperature' => (float) ($modelRow['temperature'] ?? 0.8),
        'thinking' => false,
        'nv_fallbacks' => acx_model_nvidia_fallbacks($modelRow),
        'ionet_model' => $ioModel !== '' ? $ioModel : null,
    ];
}

/**
 * @param list<array<string,mixed>> $attachments
 * @return list<array<string,mixed>>
 */
function acx_stream_build_api_messages(
    array $hist,
    bool $web,
    string $mode,
    string $userContent,
    array $attachments,
    bool $hasImages,
    array $modelRow,
    int $userId = 0,
    string $userDisplayName = '',
    string $locale = 'en',
    ?array $researchBundle = null,
    array $prefetchWidgets = [],
    ?array $searchRich = null,
    ?array $layoutHit = null
): array {
    $modelKey = (string) ($modelRow['key'] ?? 'FLAIR');
    $system = acx_system_prompt($mode === 'chat' && $web ? 'web' : $mode, $modelKey, $locale);
    $wantContacts = function_exists('acx_persona_wants_contacts') && acx_persona_wants_contacts($userContent);
    $wantEco = function_exists('acx_persona_wants_ecosystem') && acx_persona_wants_ecosystem($userContent);
    if ($wantContacts || $wantEco) {
        if ($wantEco || $wantContacts) {
            $eco = acx_ecosystem_knowledge_block($locale, true);
            if ($eco !== '') {
                $system .= "\n\n" . $eco;
            }
        }
        if ($wantContacts && function_exists('acx_persona_contacts_block')) {
            $system .= "\n\n" . acx_persona_contacts_block($locale, true);
        }
    }
    if ($userId > 0) {
        $memBlock = acx_memory_prompt_block($userId, $userDisplayName, $locale);
        if ($memBlock !== '') {
            $system .= "\n\n" . $memBlock;
        }
    }
    if ($layoutHit !== null) {
        $layoutBlock = acx_layout_prompt_block($layoutHit, $locale);
        if ($layoutBlock !== '') {
            $system .= "\n\n" . $layoutBlock;
        }
    }
    $skipNow = acx_economy_bool('skip_now_context_chat', true) && !in_array($mode, ['web', 'research', 'agent'], true);
    $skipWidgets = acx_economy_bool('skip_widgets_chat', true) && !in_array($mode, ['web', 'research'], true);
    if ($mode !== 'research' && !$hasImages && !$skipNow) {
        $system .= "\n\n" . acx_now_context_block($locale);
    }
    if ($mode !== 'research' && !$hasImages && !$skipWidgets) {
        $widgetBlock = acx_widgets_prompt_block($prefetchWidgets, $locale);
        if ($widgetBlock !== '') {
            $system .= "\n\n" . $widgetBlock;
        }
    }
    if ($searchRich !== null && ($searchRich['text'] ?? '') !== '') {
        $system .= "\n\n" . (string) $searchRich['text'];
        $imgBlock = acx_chat_image_prompt_block($locale, ($searchRich['figures'] ?? []) !== []);
        if ($imgBlock !== '') {
            $system .= "\n\n" . $imgBlock;
        }
    } elseif ($prefetchWidgets !== []) {
        $hasIllustrations = false;
        foreach ($prefetchWidgets as $w) {
            if (is_array($w) && ($w['type'] ?? '') === 'entity' && !empty($w['image'])) {
                $hasIllustrations = true;
                break;
            }
        }
        $imgBlock = acx_chat_image_prompt_block($locale, $hasIllustrations);
        if ($imgBlock !== '') {
            $system .= "\n\n" . $imgBlock;
        }
    }
    if ($mode === 'research') {
        $system = acx_research_enrich_system($system, $userContent, $researchBundle);
    }

    $msgs = [['role' => 'system', 'content' => $system]];
    $histForApi = $hist;
    if (count($histForApi) > 0) {
        $last = $histForApi[count($histForApi) - 1];
        if (($last['role'] ?? '') === 'user') {
            array_pop($histForApi);
        }
    }
    foreach ($histForApi as $m) {
        if (!is_array($m)) {
            continue;
        }
        $role = (string) ($m['role'] ?? '');
        $content = (string) ($m['content'] ?? '');
        if ($role === '' || $content === '') {
            continue;
        }
        if ($role === 'system') {
            continue;
        }
        $metaJson = null;
        if (!empty($m['meta_json'])) {
            $metaJson = is_string($m['meta_json']) ? $m['meta_json'] : json_encode($m['meta_json'], JSON_UNESCAPED_UNICODE);
        } elseif (isset($m['reasoning']) && is_string($m['reasoning']) && trim($m['reasoning']) !== '') {
            $metaJson = json_encode(['reasoning' => $m['reasoning']], JSON_UNESCAPED_UNICODE) ?: null;
        }
        $content = acx_message_api_content($role, $content, is_string($metaJson) ? $metaJson : null);
        $msgs[] = ['role' => $role, 'content' => $content];
    }

    if ($hasImages) {
        $fromPdf = acx_attachments_include_pdf_scan($attachments);
        $images = array_values(array_filter($attachments, static fn ($a) => is_array($a) && !empty($a['is_image'])));
        if ($fromPdf) {
            $msgs[0] = ['role' => 'system', 'content' => acx_vision_system_prompt($locale, true)];
        } else {
            $msgs[0] = ['role' => 'system', 'content' => acx_vision_system_prompt($locale, false)];
        }
        $visionMsgs = acx_vision_build_messages($images, $userContent, $locale, $fromPdf);
        foreach ($visionMsgs as $vm) {
            if (($vm['role'] ?? '') === 'system') {
                continue;
            }
            $msgs[] = $vm;
        }

        return $msgs;
    }

    $msgs[] = ['role' => 'user', 'content' => $userContent];

    return $msgs;
}

/**
 * Холст: уточнения / генерация, стрим финального текста чанками.
 *
 * @param list<array<string,mixed>> $hist
 * @param list<string> $extraHeaders
 * @param callable(string,int,?int):void $persist
 */
function acx_stream_emit_canvas_turn(
    array $hist,
    string $userMessage,
    array $modelRow,
    string $modelKey,
    ?string $modelFallbackFrom,
    string $locale,
    string $subjectKey,
    callable $persist,
    array $extraHeaders = []
): void {
    foreach ($extraHeaders as $h) {
        if (is_string($h) && $h !== '') {
            header($h);
        }
    }
    if ($modelFallbackFrom !== null && $modelFallbackFrom !== '') {
        header('X-Model-Fallback-From: ' . $modelFallbackFrom);
    }
    acx_chat_emit_event('status', ['phase' => 'canvas']);

    $histFor = [];
    foreach ($hist as $row) {
        if (!is_array($row)) {
            continue;
        }
        $role = (string) ($row['role'] ?? '');
        $content = (string) ($row['content'] ?? '');
        if (($role !== 'user' && $role !== 'assistant') || $content === '') {
            continue;
        }
        $histFor[] = ['role' => $role, 'content' => $content];
    }
    while ($histFor !== [] && ($histFor[count($histFor) - 1]['role'] ?? '') === 'user') {
        array_pop($histFor);
    }

    $run = acx_canvas_run($histFor, $userMessage, $locale, $subjectKey, $modelRow);
    if (empty($run['ok']) && trim((string) ($run['content'] ?? '')) === '') {
        acx_chat_emit_stream_error(acx_sanitize_public_error((string) ($run['error'] ?? 'canvas_failed'), $locale));
        exit;
    }
    $assistantText = trim((string) ($run['content'] ?? ''));
    if ($assistantText === '') {
        $assistantText = acx_canvas_limit_message($locale);
    }
    $assistantText = acx_text_sanitize_assistant($assistantText, $locale, $userMessage);
    $len = mb_strlen($assistantText);
    $chunk = 56;
    for ($o = 0; $o < $len; $o += $chunk) {
        if (acx_stream_client_gone()) {
            break;
        }
        acx_chat_emit_delta(mb_substr($assistantText, $o, $chunk));
    }
    // Persist before DONE so hard-refresh / client recovery can load the reply.
    $persist($assistantText, (int) ($run['generated'] ?? 0), isset($run['tokens']) ? (int) $run['tokens'] : null);
    acx_stream_job_finish(acx_stream_job_active_id());
    acx_stream_write("data: [DONE]\n\n");
}

/**
 * @param list<array<string,mixed>> $attachments
 */
function acx_stream_user(
    array $logged,
    string $userContent,
    string $displayMessage,
    array $modelRow,
    array $limitsCfg,
    bool $web,
    string $mode,
    int $convIdIn,
    array $attachments,
    bool $hasImages,
    string $locale = 'en',
    bool $ephemeral = false,
    string $modelKey = 'FLAIR',
    ?string $modelFallbackFrom = null,
    bool $researchContinue = false,
    string $researchQuery = '',
    ?array $layoutHit = null
): void {
    $chk = acx_check_limits_before_send($modelRow, $logged['internal_id'], $limitsCfg);
    if (!$chk['ok']) {
        acx_json_out(['success' => false, 'error' => $chk['error']], 429);
    }
    $rateErr = acx_rate_limit_check('user', $limitsCfg);
    if ($rateErr !== null) {
        acx_json_out(['success' => false, 'error' => $rateErr], 429);
    }

    $pdo = acx_db();
    $uid = $logged['internal_id'];
    $modelKey = (string) $modelRow['key'];
    $attJson = $attachments !== [] ? json_encode($attachments, JSON_UNESCAPED_UNICODE) : null;

    if ($convIdIn <= 0) {
        $title = 'Новый чат';
        $pdo->prepare('INSERT INTO conversations (user_id, title, title_auto, model, is_ephemeral) VALUES (?,?,0,?,?)')->execute(
            [$uid, $title, $modelKey, $ephemeral ? 1 : 0]
        );
        $convIdIn = (int) $pdo->lastInsertId();
    } else {
        $st = $pdo->prepare('SELECT id, is_ephemeral FROM conversations WHERE id = ? AND user_id = ?');
        $st->execute([$convIdIn, $uid]);
        $existing = $st->fetch();
        if (!$existing) {
            acx_json_out(['success' => false, 'error' => 'not_found'], 404);
        }
        if (!empty($existing['is_ephemeral'])) {
            $ephemeral = true;
        }
        $pdo->prepare('UPDATE conversations SET model = ?, updated_at = NOW() WHERE id = ? AND user_id = ?')->execute(
            [$modelKey, $convIdIn, $uid]
        );
    }

    $pdo->prepare('INSERT INTO messages (conversation_id, role, content, attachments_json, model) VALUES (?,?,?,?,?)')->execute(
        [$convIdIn, 'user', $displayMessage !== '' ? $displayMessage : '[файлы]', $attJson, $modelKey]
    );
    $userMsgId = (int) $pdo->lastInsertId();
    acx_rate_limit_record('user');
    // id чата в журнал сразу: клиент увидит его через stream_poll, не дожидаясь заголовков буферизованного SSE.
    if (function_exists('acx_stream_job_event') && acx_stream_job_active_id() !== '') {
        acx_stream_job_event(acx_stream_job_active_id(), 'meta', ['conversation_id' => $convIdIn, 'model_key' => $modelKey]);
    }

    foreach ($attachments as $a) {
        if (!is_array($a) || empty($a['id'])) {
            continue;
        }
        $pdo->prepare('UPDATE attachments SET conversation_id = ?, message_id = ? WHERE id = ? AND user_id = ?')->execute(
            [$convIdIn, $userMsgId, (int) $a['id'], $uid]
        );
    }

    $histLimit = max(4, acx_economy_int('history_messages', 5) + 2);
    $st = $pdo->prepare('SELECT role, content, meta_json FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ' . (int) $histLimit);
    $st->execute([$convIdIn]);
    $hist = array_reverse($st->fetchAll() ?: []);
    $hist = acx_economy_trim_history($hist);

    if (!acx_llm_is_configured()) {
        acx_json_out(['success' => false, 'error' => acx_sanitize_public_error('assistix_unconfigured', $locale)], 503);
    }

    // Холст / генерация по тексту (canvas, image без вложений, или явный запрос в чате).
    $canvasMsg = $displayMessage !== '' ? $displayMessage : $userContent;
    $useCanvas = !$hasImages && (
        $mode === 'canvas'
        || ($mode === 'image')
        || (in_array($mode, ['chat', 'web'], true) && acx_canvas_wants_image_intent($canvasMsg, $hist))
    );
    if ($useCanvas) {
        acx_stream_emit_canvas_turn(
            $hist,
            $canvasMsg,
            $modelRow,
            $modelKey,
            $modelFallbackFrom,
            $locale,
            acx_canvas_subject_key((int) $logged['internal_id']),
            static function (string $assistantText, int $generated, ?int $tokens) use ($pdo, $convIdIn, $modelKey, $modelRow, $logged, $displayMessage): void {
                $pdo->prepare('INSERT INTO messages (conversation_id, role, content, model, meta_json) VALUES (?,?,?,?,?)')->execute(
                    [
                        $convIdIn,
                        'assistant',
                        $assistantText,
                        $modelKey,
                        json_encode([
                            'canvas' => true,
                            'image' => $generated > 0,
                            'provider' => 'kumo',
                        ], JSON_UNESCAPED_UNICODE),
                    ]
                );
                $pdo->prepare('UPDATE conversations SET updated_at = NOW() WHERE id = ?')->execute([$convIdIn]);
                acx_apply_usage_after_send(
                    $modelRow,
                    (int) $logged['internal_id'],
                    $tokens ?? max(400, (int) (mb_strlen($displayMessage . $assistantText) / 3)),
                    $displayMessage,
                    $assistantText
                );
            },
            [
                'X-Conversation-Id: ' . $convIdIn,
                'X-User-Message-Id: ' . $userMsgId,
                'X-Model-Key: ' . $modelKey,
            ]
        );
        exit;
    }

    // Beam Agent → ASSISTIX Environment (tools + durable cloud workspace + subagents).
    if ($mode === 'agent') {
        header('X-Conversation-Id: ' . $convIdIn);
        header('X-User-Message-Id: ' . $userMsgId);
        header('X-Model-Key: ' . $modelKey);
        if ($modelFallbackFrom !== null && $modelFallbackFrom !== '') {
            header('X-Model-Fallback-From: ' . $modelFallbackFrom);
        }

        $goal = $userContent !== '' ? $userContent : $displayMessage;
        $resumeJob = '';

        // Bind durable per-account/project cloud workspace (persists across runs).
        $bindProjectId = $projectIdIn;
        if ($bindProjectId === '' && $convIdIn > 0 && function_exists('acx_projects_load')) {
            $pdata = acx_projects_load((int) $uid);
            foreach ($pdata['projects'] as $p) {
                if (in_array($convIdIn, $p['session_ids'] ?? [], true)) {
                    $bindProjectId = (string) $p['id'];
                    break;
                }
            }
        }
        $cloudSess = acx_cloud_workspace_bind(
            (int) $uid,
            $bindProjectId !== '' ? $bindProjectId : null,
            (int) $convIdIn
        );
        // Prefix agent_ so acx-core routes this through onAgent handlers.
        acx_chat_emit_event('agent_cloud_session', [
            'ws_key' => (string) ($cloudSess['ws_key'] ?? ''),
            'project_id' => $cloudSess['project_id'] ?? null,
            'durable' => true,
            'environment' => 'ASSISTIX Environment',
        ]);

        $emit = static function (string $event, array $payload): void {
            if ($event === 'agent_final') {
                $text = (string) ($payload['content'] ?? '');
                if ($text === '') {
                    return;
                }
                $len = mb_strlen($text);
                $chunk = 48;
                for ($o = 0; $o < $len; $o += $chunk) {
                    if (acx_stream_client_gone()) {
                        return;
                    }
                    acx_chat_emit_delta(mb_substr($text, $o, $chunk));
                }

                return;
            }
            acx_chat_emit_event($event, $payload);
        };

        $run = acx_agent_run(
            $goal,
            $modelRow,
            (int) $uid,
            $locale,
            (string) ($logged['display_name'] ?? ''),
            $emit,
            $resumeJob !== '' ? $resumeJob : null,
            0
        );
        if (function_exists('acx_agent_run_begin')) {
            $jobMetaId = (string) (($run['job']['id'] ?? '') ?: '');
            $runRowId = acx_agent_run_begin(
                (int) $uid,
                $jobMetaId,
                (string) $modelKey,
                (string) $goal,
                (int) $convIdIn
            );
            acx_agent_run_finish(
                $runRowId,
                (string) (($run['job']['status'] ?? '') === 'paused' ? 'cancelled' : 'done'),
                is_array($run['steps'] ?? null) ? $run['steps'] : []
            );
        }
        $assistantText = trim((string) ($run['content'] ?? ''));
        if (function_exists('acx_agent_strip_call')) {
            $assistantText = acx_agent_strip_call($assistantText);
        }
        if ($assistantText === '' || (function_exists('acx_agent_looks_like_protocol') && acx_agent_looks_like_protocol($assistantText))) {
            $assistantText = $locale === 'ru'
                ? 'Beam Agent завершил шаг. Подробности — в плашке выше.'
                : 'Beam Agent finished this step. See the agent strip above.';
            // agent_final мог уже ничего не отдать — допишем чистый текст
            acx_chat_emit_delta($assistantText);
        }

        $assistantText = acx_text_sanitize_assistant($assistantText, $locale, $displayMessage);
        if (!$ephemeral && $assistantText !== '') {
            $memResult = acx_memory_apply_from_response((int) $uid, $assistantText, true);
            $assistantText = (string) ($memResult['text'] ?? $assistantText);
            if (!empty($memResult['ops'])) {
                acx_chat_emit_event('memory', [
                    'ops' => $memResult['ops'],
                    'memories' => $memResult['memories'] ?? [],
                ]);
            }
        }

        $jobMeta = is_array($run['job'] ?? null) ? $run['job'] : [];
        $meta = [
            'agent' => true,
            'agent_name' => 'Beam Agent',
            'environment' => 'ASSISTIX Environment',
            'job_id' => (string) ($jobMeta['id'] ?? ''),
            'cloud_ws' => (string) ($cloudSess['ws_key'] ?? ''),
            'project_id' => $cloudSess['project_id'] ?? null,
            'steps' => count($run['steps'] ?? []),
            'code_hook' => 'ASSISTIX CODE',
        ];
        $pdo->prepare('INSERT INTO messages (conversation_id, role, content, model, meta_json) VALUES (?,?,?,?,?)')->execute(
            [$convIdIn, 'assistant', $assistantText, $modelKey, json_encode($meta, JSON_UNESCAPED_UNICODE)]
        );
        $pdo->prepare('UPDATE conversations SET updated_at = NOW() WHERE id = ?')->execute([$convIdIn]);
        acx_apply_usage_after_send(
            $modelRow,
            (int) $uid,
            null,
            $displayMessage,
            $assistantText
        );
        acx_stream_job_finish(acx_stream_job_active_id());
            acx_stream_write("data: [DONE]\n\n");
        exit;
    }

    $useModel = acx_model_api_id($modelRow, $hasImages);
    $nvFallbacks = $hasImages ? acx_vision_nvidia_fallbacks() : acx_model_nvidia_fallbacks($modelRow);
    $ioModel = trim((string) ($modelRow['ionet_model'] ?? ''));
    $thinking = acx_stream_use_thinking($modelRow, $mode, $hasImages);
    $temp = (float) ($modelRow['temperature'] ?? 0.45);
    $maxT = (int) ($modelRow['max_tokens'] ?? 480);
    if ($mode === 'research') {
        $maxT = acx_research_max_tokens($displayMessage, $maxT);
    }
    $maxT = acx_economy_cap_max_tokens($maxT, $mode);

    $textFallback = null;
    if (acx_attachments_pdf_scan_intent($attachments)) {
        $textFallback = acx_stream_build_pdf_text_fallback(
            $hist,
            $web,
            $displayMessage,
            $attachments,
            $modelRow,
            $uid,
            (string) ($logged['display_name'] ?? ''),
            $locale
        );
    }

    header('X-Conversation-Id: ' . $convIdIn);
    header('X-User-Message-Id: ' . $userMsgId);
    header('X-Model-Key: ' . $modelKey);
    if ($modelFallbackFrom !== null && $modelFallbackFrom !== '') {
        header('X-Model-Fallback-From: ' . $modelFallbackFrom);
    }

    $queryMessage = acx_layout_effective_query($displayMessage, $layoutHit);

    $researchMeta = null;
    $researchEmitted = false;
    $searchRich = null;
    $sseStarted = false;
    if ($mode === 'research') {
        $sseStarted = true;
        acx_chat_emit_event('status', ['phase' => 'research']);
        $collectQ = ($researchContinue && $researchQuery !== '') ? $researchQuery : $queryMessage;
        $researchMeta = acx_research_collect($collectQ, static function (array $progress): void {
            if (acx_stream_client_gone()) {
                return;
            }
            $type = (string) ($progress['type'] ?? 'progress');
            if ($type === 'skeleton') {
                acx_chat_emit_event('research_skeleton', [
                    'title' => (string) ($progress['title'] ?? ''),
                    'intro' => (string) ($progress['intro'] ?? ''),
                    'sections' => $progress['sections'] ?? [],
                ]);

                return;
            }
            acx_chat_emit_event('research_progress', $progress);
        });
        if (acx_stream_client_gone()) {
            exit;
        }
        acx_chat_emit_event('research', $researchMeta);
        $researchEmitted = true;
        $sources = $researchMeta['sources'];
    } else {
        $sseStarted = true;
        if ($hasImages) {
            acx_chat_emit_event('status', ['phase' => 'vision']);
        } elseif ($mode === 'documents') {
            acx_chat_emit_event('status', ['phase' => 'docs']);
        } elseif ($web || $mode === 'web') {
            acx_chat_emit_event('status', ['phase' => 'search']);
        } elseif ($mode === 'reasoning') {
            acx_chat_emit_event('status', ['phase' => 'reason']);
        } else {
            acx_chat_emit_event('status', ['phase' => 'think']);
        }
        $searchRich = ($mode !== 'research' && !$hasImages)
            ? acx_search_context_for_message($queryMessage, $web, $mode, $locale)
            : null;
        $sources = acx_collect_stream_sources($web, $mode, $queryMessage, $searchRich);
        if ($searchRich || ($sources !== [] && ($web || $mode === 'web'))) {
            acx_chat_emit_event('status', ['phase' => 'think']);
        }
    }

    $prefetchWidgets = ($mode !== 'research' && !$hasImages && !acx_economy_bool('skip_widgets_chat', true))
        ? acx_widgets_for_message($queryMessage, $locale)
        : [];

    $memUserId = $ephemeral ? 0 : $uid;
    $apiMsgs = acx_stream_build_api_messages($hist, $web, $mode, $userContent, $attachments, $hasImages, $modelRow, $memUserId, (string) ($logged['display_name'] ?? ''), $locale, $researchMeta, $prefetchWidgets, $searchRich ?? null, $layoutHit);

    $streamResult = acx_stream_or_complete(
        $apiMsgs,
        $useModel,
        $maxT,
        $temp,
        $thinking,
        $nvFallbacks,
        $ioModel !== '' ? $ioModel : null,
        $sources,
        $researchMeta,
        $researchEmitted,
        $locale,
        $textFallback,
        $sseStarted,
        $prefetchWidgets,
        false
    );
    $assistantText = (string) ($streamResult['content'] ?? '');
    $reasoningText = $mode === 'reasoning' ? trim((string) ($streamResult['reasoning'] ?? '')) : '';

    if ($assistantText !== '' || $reasoningText !== '') {
        if ($mode === 'research') {
            $assistantText = acx_research_sanitize_report($assistantText, $locale, $displayMessage);
            $langQ = (string) (($researchMeta['query'] ?? '') !== '' ? $researchMeta['query'] : (($researchContinue && $researchQuery !== '') ? $researchQuery : $displayMessage));
            // Второй проход = двойная оплата токенов — в экономе выключен.
            if (!acx_economy_bool('no_second_pass', true)
                && $langQ !== '' && $assistantText !== '' && acx_research_language_mismatch($langQ, $assistantText)) {
                $retryLang = acx_complete_openai_style(
                    $apiMsgs,
                    $useModel,
                    $maxT,
                    min(0.7, $temp),
                    false,
                    $nvFallbacks,
                    $ioModel !== '' ? $ioModel : null,
                    $locale
                );
                if (!isset($retryLang['error'])) {
                    $langText = acx_research_sanitize_report((string) ($retryLang['content'] ?? ''), $locale, $displayMessage);
                    if ($langText !== '' && !acx_research_language_mismatch($langQ, $langText)) {
                        $assistantText = $langText;
                    }
                }
            }
        }
        $assistantText = acx_text_sanitize_assistant($assistantText, $locale, $displayMessage);
        $reasoningText = acx_text_sanitize_assistant($reasoningText, $locale, $displayMessage);
        if ($assistantText !== '') {
            $memResult = acx_memory_apply_from_response(
                (int) $logged['internal_id'],
                $assistantText,
                !$ephemeral
            );
            $assistantText = (string) ($memResult['text'] ?? $assistantText);
            if (!$ephemeral && !empty($memResult['ops'])) {
                acx_chat_emit_event('memory', [
                    'ops' => $memResult['ops'],
                    'memories' => $memResult['memories'] ?? [],
                ]);
            }
        }
        $widgetOut = [];
        if ($prefetchWidgets !== [] && $assistantText !== '') {
            $finalized = acx_widgets_finalize_content($assistantText, $prefetchWidgets, $locale);
            $assistantText = (string) ($finalized['content'] ?? $assistantText);
            $widgetOut = $finalized['widgets'] ?? [];
        }
        $metaJson = acx_assistant_message_meta($researchMeta, $assistantText, $reasoningText, $mode === 'reasoning', $widgetOut);
        $pdo->prepare('INSERT INTO messages (conversation_id, role, content, model, meta_json) VALUES (?,?,?,?,?)')->execute(
            [$convIdIn, 'assistant', $assistantText !== '' ? $assistantText : '[рассуждение]', $modelKey, $metaJson]
        );
        $pdo->prepare('UPDATE conversations SET updated_at = NOW() WHERE id = ?')->execute([$convIdIn]);
        acx_apply_usage_after_send(
            $modelRow,
            $logged['internal_id'],
            null,
            $displayMessage,
            $assistantText !== '' ? $assistantText : $reasoningText
        );
    }

    acx_stream_job_finish(acx_stream_job_active_id());
    acx_stream_write("data: [DONE]\n\n");
    exit;
}

/**
 * @param list<array<string,mixed>> $attachments
 */
function acx_stream_guest(
    array $in,
    string $userContent,
    string $displayMessage,
    array $modelRow,
    array $guestCfg,
    bool $web,
    string $mode,
    string $localId,
    array $attachments,
    bool $hasImages,
    string $locale = 'en',
    bool $ephemeral = false,
    ?string $modelFallbackFrom = null,
    bool $researchContinue = false,
    string $researchQuery = '',
    ?array $layoutHit = null
): void {
    $rateErr = acx_rate_limit_check('guest', $guestCfg);
    if ($rateErr !== null) {
        acx_json_out(['success' => false, 'error' => $rateErr], 429);
    }

    $g = acx_guest_state();
    $maxDay = (int) $guestCfg['max_user_messages_per_day'];
    if ((int) ($g['daily_user_msgs'] ?? 0) >= $maxDay) {
        acx_json_out(['success' => false, 'error' => 'Достигнут дневной лимит демо-сообщений.'], 429);
    }

    $convs = &$g['conversations'];
    $activeIdx = null;
    $activeLocal = null;
    if ($localId !== '') {
        $idx = acx_guest_find_conv($g, $localId);
        if ($idx !== null) {
            $activeIdx = $idx;
            $activeLocal = $localId;
        }
    }
    if ($activeIdx === null) {
        $regularCount = 0;
        foreach ($convs as $c) {
            if (empty($c['is_ephemeral'])) {
                $regularCount++;
            }
        }
        if (!$ephemeral && $regularCount >= (int) $guestCfg['max_conversations']) {
            acx_json_out(['success' => false, 'error' => 'Максимум демо-чатов.'], 429);
        }
        $activeLocal = acx_guest_new_local_id();
        $now = gmdate('c');
        $convs[] = [
            'local_id' => $activeLocal,
            'title' => 'Новый чат',
            'title_auto' => 0,
            'model' => 'GUEST',
            'is_ephemeral' => $ephemeral ? 1 : 0,
            'created_at' => $now,
            'updated_at' => $now,
            'messages' => [],
        ];
        $activeIdx = count($convs) - 1;
    } elseif ($ephemeral && empty($convs[$activeIdx]['is_ephemeral'])) {
        $convs[$activeIdx]['is_ephemeral'] = 1;
    }

    $thread = &$convs[$activeIdx]['messages'];
    $thread[] = ['role' => 'user', 'content' => $displayMessage !== '' ? $displayMessage : '[файлы]'];
    $g['daily_user_msgs'] = (int) ($g['daily_user_msgs'] ?? 0) + 1;
    acx_rate_limit_record('guest');

    $histN = min((int) $guestCfg['history_messages'], acx_economy_int('guest_history', 3));
    $slice = acx_economy_trim_history(array_slice($thread, -$histN), $histN, acx_economy_int('history_chars', 700));

    if (!acx_llm_is_configured()) {
        acx_json_out(['success' => false, 'error' => acx_sanitize_public_error('assistix_unconfigured', $locale)], 503);
    }

    // Генерация картинок дорогая — гостям запрещена (холст / image / явный запрос).
    $guestCanvasMsg = $displayMessage !== '' ? $displayMessage : $userContent;
    $guestWantsCanvas = !$hasImages && (
        $mode === 'canvas'
        || $mode === 'image'
        || (in_array($mode, ['chat', 'web'], true) && acx_canvas_wants_image_intent($guestCanvasMsg, $slice))
    );
    if ($guestWantsCanvas) {
        $err = match (acx_normalize_locale($locale)) {
            'ru' => 'Генерация изображений (Холст) доступна после входа в аккаунт.',
            'it' => 'La generazione immagini (Canvas) è disponibile dopo l\'accesso.',
            default => 'Image generation (Canvas) is available after signing in.',
        };
        acx_json_out(['success' => false, 'error' => $err], 403);
    }

    // Guest Beam Agent (ограниченный Environment, user_id=0).
    if ($mode === 'agent') {
        header('X-Guest-Local-Id: ' . $activeLocal);
        header('X-Model-Key: GUEST');
        if ($modelFallbackFrom !== null && $modelFallbackFrom !== '') {
            header('X-Model-Fallback-From: ' . $modelFallbackFrom);
        }

        $emit = static function (string $event, array $payload): void {
            if ($event === 'agent_final') {
                $text = (string) ($payload['content'] ?? '');
                $len = mb_strlen($text);
                for ($o = 0; $o < $len; $o += 48) {
                    if (acx_stream_client_gone()) {
                        return;
                    }
                    acx_chat_emit_delta(mb_substr($text, $o, 48));
                }

                return;
            }
            acx_chat_emit_event($event, $payload);
        };

        $run = acx_agent_run(
            $userContent !== '' ? $userContent : $displayMessage,
            $modelRow,
            0,
            $locale,
            '',
            $emit,
            null,
            0
        );
        if (function_exists('acx_agent_run_begin')) {
            $guestJobId = (string) (($run['job']['id'] ?? '') ?: '');
            $guestRunRow = acx_agent_run_begin(
                0,
                $guestJobId,
                'GUEST',
                (string) ($userContent !== '' ? $userContent : $displayMessage),
                0
            );
            acx_agent_run_finish(
                $guestRunRow,
                (string) (($run['job']['status'] ?? '') === 'paused' ? 'cancelled' : 'done'),
                is_array($run['steps'] ?? null) ? $run['steps'] : []
            );
        }
        $assistantText = trim((string) ($run['content'] ?? ''));
        if (function_exists('acx_agent_strip_call')) {
            $assistantText = acx_agent_strip_call($assistantText);
        }
        if ($assistantText === '' || (function_exists('acx_agent_looks_like_protocol') && acx_agent_looks_like_protocol($assistantText))) {
            $assistantText = $locale === 'ru'
                ? 'Beam Agent завершил шаг. Подробности — в плашке выше.'
                : 'Beam Agent finished this step. See the agent strip above.';
            acx_chat_emit_delta($assistantText);
        }
        $assistantText = acx_text_sanitize_assistant($assistantText, $locale, $displayMessage);
        $jobMeta = is_array($run['job'] ?? null) ? $run['job'] : [];
        $thread[] = [
            'role' => 'assistant',
            'content' => $assistantText,
            'meta' => [
                'agent' => true,
                'job_id' => (string) ($jobMeta['id'] ?? ''),
                'environment' => 'ASSISTIX Environment',
            ],
        ];
        $convs[$activeIdx]['updated_at'] = gmdate('c');
        $convs[$activeIdx]['model'] = 'GUEST';
        acx_stream_job_finish(acx_stream_job_active_id());
            acx_stream_write("data: [DONE]\n\n");
        exit;
    }

    $useModel = acx_model_api_id($modelRow, $hasImages);
    $maxTok = min(
        (int) $guestCfg['max_tokens'],
        (int) ($modelRow['max_tokens'] ?? 220),
        acx_economy_int('guest_max_tokens', 180)
    );
    if ($mode === 'research') {
        $maxTok = acx_economy_cap_max_tokens(acx_research_max_tokens($displayMessage, $maxTok), 'research');
    }
    $maxTok = acx_economy_cap_max_tokens($maxTok, $mode);
    $ioModel = trim((string) ($modelRow['ionet_model'] ?? ''));

    header('X-Guest-Local-Id: ' . $activeLocal);
    header('X-Model-Key: GUEST');
    if ($modelFallbackFrom !== null && $modelFallbackFrom !== '') {
        header('X-Model-Fallback-From: ' . $modelFallbackFrom);
    }

    $queryMessage = acx_layout_effective_query($displayMessage, $layoutHit);

    $researchMeta = null;
    $researchEmitted = false;
    $searchRich = null;
    $sseStarted = false;
    if ($mode === 'research') {
        $sseStarted = true;
        acx_chat_emit_event('status', ['phase' => 'research']);
        $collectQ = ($researchContinue && $researchQuery !== '') ? $researchQuery : $queryMessage;
        $researchMeta = acx_research_collect($collectQ, static function (array $progress): void {
            if (acx_stream_client_gone()) {
                return;
            }
            $type = (string) ($progress['type'] ?? 'progress');
            if ($type === 'skeleton') {
                acx_chat_emit_event('research_skeleton', [
                    'title' => (string) ($progress['title'] ?? ''),
                    'intro' => (string) ($progress['intro'] ?? ''),
                    'sections' => $progress['sections'] ?? [],
                ]);

                return;
            }
            acx_chat_emit_event('research_progress', $progress);
        });
        if (acx_stream_client_gone()) {
            exit;
        }
        acx_chat_emit_event('research', $researchMeta);
        $researchEmitted = true;
        $sources = $researchMeta['sources'];
    } else {
        $sseStarted = true;
        if ($hasImages) {
            acx_chat_emit_event('status', ['phase' => 'vision']);
        } elseif ($mode === 'documents') {
            acx_chat_emit_event('status', ['phase' => 'docs']);
        } elseif ($web || $mode === 'web') {
            acx_chat_emit_event('status', ['phase' => 'search']);
        } elseif ($mode === 'reasoning') {
            acx_chat_emit_event('status', ['phase' => 'reason']);
        } else {
            acx_chat_emit_event('status', ['phase' => 'think']);
        }
        $searchRich = ($mode !== 'research' && !$hasImages)
            ? acx_search_context_for_message($queryMessage, $web, $mode, $locale)
            : null;
        $sources = acx_collect_stream_sources($web, $mode, $queryMessage, $searchRich);
        if ($searchRich || ($sources !== [] && ($web || $mode === 'web'))) {
            acx_chat_emit_event('status', ['phase' => 'think']);
        }
    }

    $prefetchWidgets = [];

    $apiMsgs = acx_stream_build_api_messages($slice, $web, $mode, $userContent, $attachments, $hasImages, $modelRow, 0, '', $locale, $researchMeta, $prefetchWidgets, $searchRich ?? null, $layoutHit);

    $textFallback = null;
    $guestThinking = acx_stream_use_thinking($modelRow, $mode, $hasImages);

    $streamResult = acx_stream_or_complete(
        $apiMsgs,
        $useModel,
        $maxTok,
        (float) ($modelRow['temperature'] ?? 0.65),
        $guestThinking,
        acx_model_nvidia_fallbacks($modelRow),
        $ioModel !== '' ? $ioModel : null,
        $sources,
        $researchMeta,
        $researchEmitted,
        $locale,
        $textFallback,
        $sseStarted,
        $prefetchWidgets,
        false
    );
    $assistantText = (string) ($streamResult['content'] ?? '');
    $reasoningText = $mode === 'reasoning' ? trim((string) ($streamResult['reasoning'] ?? '')) : '';

    if ($assistantText !== '' || $reasoningText !== '') {
        if ($mode === 'research') {
            $assistantText = acx_research_sanitize_report($assistantText, $locale, $displayMessage);
            $langQ = (string) (($researchMeta['query'] ?? '') !== '' ? $researchMeta['query'] : (($researchContinue && $researchQuery !== '') ? $researchQuery : $displayMessage));
            if ($langQ !== '' && $assistantText !== '' && acx_research_language_mismatch($langQ, $assistantText)) {
                $retryLang = acx_complete_openai_style(
                    $apiMsgs,
                    $useModel,
                    $maxTok,
                    min(0.7, (float) ($modelRow['temperature'] ?? 0.65)),
                    false,
                    acx_model_nvidia_fallbacks($modelRow),
                    $ioModel !== '' ? $ioModel : null,
                    $locale
                );
                if (!isset($retryLang['error'])) {
                    $langText = acx_research_sanitize_report((string) ($retryLang['content'] ?? ''), $locale, $displayMessage);
                    if ($langText !== '' && !acx_research_language_mismatch($langQ, $langText)) {
                        $assistantText = $langText;
                    }
                }
            }
        }
        $assistantText = acx_text_sanitize_assistant($assistantText, $locale, $displayMessage);
        $reasoningText = acx_text_sanitize_assistant($reasoningText, $locale, $displayMessage);
        $guestResearch = null;
        if ($researchMeta !== null && $researchMeta !== []) {
            $guestResearch = [
                'query' => (string) ($researchMeta['query'] ?? ''),
                'bundle' => $researchMeta,
                'sources' => $researchMeta['sources'] ?? [],
                'report' => $assistantText,
            ];
        }
        $widgetOut = [];
        if ($prefetchWidgets !== [] && $assistantText !== '') {
            $finalized = acx_widgets_finalize_content($assistantText, $prefetchWidgets, $locale);
            $assistantText = (string) ($finalized['content'] ?? $assistantText);
            $widgetOut = $finalized['widgets'] ?? [];
        }
        $thread[] = [
            'role' => 'assistant',
            'content' => $assistantText !== '' ? $assistantText : '[рассуждение]',
            'research' => $guestResearch,
            'reasoning' => $reasoningText !== '' ? $reasoningText : null,
            'widgets' => $widgetOut !== [] ? $widgetOut : null,
        ];
    }
    $convs[$activeIdx]['updated_at'] = gmdate('c');

    acx_stream_job_finish(acx_stream_job_active_id());
    acx_stream_write("data: [DONE]\n\n");
    exit;
}
