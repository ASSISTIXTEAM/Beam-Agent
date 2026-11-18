<?php
declare(strict_types=1);

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/guest.php';
require_once dirname(__DIR__) . '/lib/ai.php';
require_once dirname(__DIR__) . '/lib/titles.php';
require_once dirname(__DIR__) . '/lib/ratelimit.php';

$method = $_SERVER['REQUEST_METHOD'];
$logged = acx_logged_user();
$guestMode = $logged === null;
if ($guestMode) {
    acx_json_out(['success' => false, 'error' => 'auth_required', 'login_url' => '/auth/login.php'], 401);
}
$cfg = acx_config();
$catalog = acx_model_catalog($guestMode);
$limitsCfg = acx_limits_config();
$guestCfg = acx_guest_config();

$pdo = null;

try {
    if ($method === 'GET') {
        if ($guestMode) {
            $g = acx_guest_state();
            if (!empty($_GET['local_id'])) {
                $lid = (string) $_GET['local_id'];
                $idx = acx_guest_find_conv($g, $lid);
                if ($idx === null) {
                    acx_json_out(['success' => false, 'error' => 'not_found'], 404);
                }
                $c = $g['conversations'][$idx];
                if (!empty($c['is_ephemeral'])) {
                    acx_json_out(['success' => false, 'error' => 'not_found'], 404);
                }
                $conv = [
                    'id' => 0,
                    'local_id' => $c['local_id'],
                    'title' => $c['title'],
                    'model' => $c['model'],
                    'created_at' => $c['created_at'],
                    'updated_at' => $c['updated_at'],
                    'is_pinned' => 0,
                ];
                $msgs = [];
                $n = 0;
                foreach ($c['messages'] ?? [] as $m) {
                    $n++;
                    $row = [
                        'id' => $n,
                        'role' => $m['role'],
                        'content' => $m['content'],
                        'model' => 'GUEST',
                        'created_at' => $c['updated_at'],
                    ];
                    $meta = [];
                    if (!empty($m['research']) && is_array($m['research'])) {
                        $meta['research'] = $m['research'];
                    }
                    if (!empty($m['reasoning']) && is_string($m['reasoning'])) {
                        $meta['reasoning'] = $m['reasoning'];
                    }
                    if ($meta !== []) {
                        $row['meta_json'] = json_encode($meta, JSON_UNESCAPED_UNICODE);
                    }
                    $msgs[] = $row;
                }
                acx_json_out(['success' => true, 'conversation' => $conv, 'messages' => $msgs, 'guest' => true]);
            }
            $offset = max(0, (int) ($_GET['offset'] ?? 0));
            $limit = min(40, max(1, (int) ($_GET['limit'] ?? 20)));
            $grouped = acx_guest_group_conversations_paged($g['conversations'] ?? [], $offset, $limit);
            acx_json_out([
                'success' => true,
                'conversations' => $grouped['groups'],
                'has_more' => $grouped['has_more'],
                'next_offset' => $grouped['next_offset'],
                'guest' => true,
            ]);
        }
        $pdo = acx_db();
        $uid = $logged['internal_id'];
        if (!empty($_GET['conversation_id'])) {
            $cid = (int) $_GET['conversation_id'];
            $st = $pdo->prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?');
            $st->execute([$cid, $uid]);
            $conv = $st->fetch();
            if (!$conv) {
                acx_json_out(['success' => false, 'error' => 'not_found'], 404);
            }
            if (!empty($conv['is_ephemeral'])) {
                acx_json_out(['success' => false, 'error' => 'not_found'], 404);
            }
            $st = $pdo->prepare(
                'SELECT id, role, content, attachments_json, model, meta_json, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC'
            );
            $st->execute([$cid]);
            $msgs = $st->fetchAll();
            acx_json_out(['success' => true, 'conversation' => $conv, 'messages' => $msgs]);
        }
        acx_purge_stale_ephemeral($pdo, $uid);
        $offset = max(0, (int) ($_GET['offset'] ?? 0));
        $limit = min(40, max(1, (int) ($_GET['limit'] ?? 20)));
        $st = $pdo->prepare(
            'SELECT c.id, c.title, c.model, c.created_at, c.updated_at, c.is_pinned, c.pinned_at,
                    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
             FROM conversations c WHERE c.user_id = ? AND c.is_ephemeral = 0
             ORDER BY c.is_pinned DESC, c.pinned_at DESC, c.updated_at DESC
             LIMIT ' . (int) $limit . ' OFFSET ' . (int) $offset
        );
        $st->execute([$uid]);
        $list = $st->fetchAll();
        $stCount = $pdo->prepare('SELECT COUNT(*) FROM conversations WHERE user_id = ? AND is_ephemeral = 0');
        $stCount->execute([$uid]);
        $total = (int) $stCount->fetchColumn();
        $grouped = acx_group_conversations_by_date($list);
        acx_json_out([
            'success' => true,
            'conversations' => $grouped,
            'has_more' => ($offset + count($list)) < $total,
            'next_offset' => $offset + count($list),
        ]);
    }

    if ($method !== 'POST') {
        acx_json_out(['success' => false, 'error' => 'method_not_allowed'], 405);
    }

    $raw = file_get_contents('php://input');
    $in = json_decode((string) $raw, true);
    if (!is_array($in)) {
        acx_json_out(['success' => false, 'error' => 'invalid_json'], 400);
    }
    $action = (string) ($in['action'] ?? '');
    if ($action === '') {
        acx_json_out(['success' => false, 'error' => 'missing_action'], 400);
    }

    if ($guestMode) {
        if ($action === 'send_message') {
            $message = trim((string) ($in['message'] ?? ''));
            if ($message === '') {
                acx_json_out(['success' => false, 'error' => 'empty_message'], 400);
            }
            $modelRow = $catalog['GUEST'];
            acx_handle_guest_send($in, $message, $modelRow, $guestCfg);
        }
        if ($action === 'guest_delete') {
            $lid = trim((string) ($in['local_id'] ?? ''));
            if ($lid === '') {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            $g = acx_guest_state();
            $idx = acx_guest_find_conv($g, $lid);
            if ($idx === null) {
                acx_json_out(['success' => false, 'error' => 'not_found'], 404);
            }
            array_splice($g['conversations'], $idx, 1);
            acx_json_out(['success' => true]);
        }
        if ($action === 'generate_title') {
            acx_chat_generate_title_guest($in);
        }
        acx_json_out(['success' => false, 'error' => 'guest_action_not_allowed'], 403);
    }

    $pdo = acx_db();
    $uid = $logged['internal_id'];

    if ($action === 'send_message') {
        $message = trim((string) ($in['message'] ?? ''));
        if ($message === '') {
            acx_json_out(['success' => false, 'error' => 'empty_message'], 400);
        }
        $modelKey = (string) ($in['model'] ?? acx_default_model_key(false));
        $modelRow = acx_resolve_model($modelKey, false, $catalog);
        $convIdIn = isset($in['conversation_id']) ? (int) $in['conversation_id'] : 0;
        acx_handle_user_send($logged, $message, $modelRow, $convIdIn, $limitsCfg);
    }

    switch ($action) {
        case 'rename':
            $cid = (int) ($in['conversation_id'] ?? 0);
            $title = trim((string) ($in['title'] ?? ''));
            if ($cid <= 0 || $title === '') {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            if (acx_conv_is_ephemeral($pdo, $cid, $uid)) {
                acx_json_out(['success' => false, 'error' => 'ephemeral_not_allowed'], 403);
            }
            $pdo->prepare('UPDATE conversations SET title = ?, title_auto = 2, updated_at = NOW() WHERE id = ? AND user_id = ?')->execute(
                [$title, $cid, $uid]
            );
            acx_json_out(['success' => true]);
        case 'generate_title':
            acx_chat_generate_title_user($pdo, $uid, $in);
        case 'share_link':
            acx_chat_share_link($pdo, $uid, $in);
        case 'pin':
            $cid = (int) ($in['conversation_id'] ?? 0);
            if ($cid <= 0) {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            if (acx_conv_is_ephemeral($pdo, $cid, $uid)) {
                acx_json_out(['success' => false, 'error' => 'ephemeral_not_allowed'], 403);
            }
            $pdo->prepare(
                'UPDATE conversations SET is_pinned = 1, pinned_at = NOW(), updated_at = NOW() WHERE id = ? AND user_id = ?'
            )->execute([$cid, $uid]);
            acx_json_out(['success' => true]);
        case 'unpin':
            $cid = (int) ($in['conversation_id'] ?? 0);
            if ($cid <= 0) {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            $pdo->prepare(
                'UPDATE conversations SET is_pinned = 0, pinned_at = NULL, updated_at = NOW() WHERE id = ? AND user_id = ?'
            )->execute([$cid, $uid]);
            acx_json_out(['success' => true]);
        case 'delete':
            $cid = (int) ($in['conversation_id'] ?? 0);
            if ($cid <= 0) {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            $pdo->beginTransaction();
            $pdo->prepare('DELETE FROM messages WHERE conversation_id = ?')->execute([$cid]);
            $pdo->prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')->execute([$cid, $uid]);
            $pdo->commit();
            acx_json_out(['success' => true]);
        case 'duplicate':
            $cid = (int) ($in['conversation_id'] ?? 0);
            if ($cid <= 0) {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            $st = $pdo->prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?');
            $st->execute([$cid, $uid]);
            $src = $st->fetch();
            if (!$src) {
                acx_json_out(['success' => false, 'error' => 'not_found'], 404);
            }
            $pdo->beginTransaction();
            $newTitle = $src['title'] . ' (копия)';
            $pdo->prepare(
                'INSERT INTO conversations (user_id, title, model, is_pinned, created_at, updated_at) VALUES (?,?,?,0,NOW(),NOW())'
            )->execute([$uid, $newTitle, $src['model']]);
            $newId = (int) $pdo->lastInsertId();
            $st = $pdo->prepare('SELECT role, content, model FROM messages WHERE conversation_id = ? ORDER BY id ASC');
            $st->execute([$cid]);
            $msgs = $st->fetchAll();
            $ins = $pdo->prepare(
                'INSERT INTO messages (conversation_id, role, content, model, created_at) VALUES (?,?,?,?,NOW())'
            );
            foreach ($msgs as $m) {
                $ins->execute([$newId, $m['role'], $m['content'], $m['model']]);
            }
            $pdo->commit();
            acx_json_out(['success' => true, 'new_conversation_id' => $newId, 'title' => $newTitle]);
        case 'branch':
            $cid = (int) ($in['conversation_id'] ?? 0);
            $keep = (int) ($in['keep_count'] ?? 0);
            if ($cid <= 0 || $keep <= 0) {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            $st = $pdo->prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?');
            $st->execute([$cid, $uid]);
            $src = $st->fetch();
            if (!$src) {
                acx_json_out(['success' => false, 'error' => 'not_found'], 404);
            }
            $st = $pdo->prepare('SELECT role, content, model, attachments_json FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT ' . (int) $keep);
            $st->execute([$cid]);
            $msgs = $st->fetchAll();
            if ($msgs === []) {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            $pdo->beginTransaction();
            $newTitle = ($src['title'] ?? 'Чат') . ' →';
            $pdo->prepare(
                'INSERT INTO conversations (user_id, title, model, is_pinned, created_at, updated_at) VALUES (?,?,?,0,NOW(),NOW())'
            )->execute([$uid, $newTitle, $src['model']]);
            $newId = (int) $pdo->lastInsertId();
            $ins = $pdo->prepare(
                'INSERT INTO messages (conversation_id, role, content, attachments_json, model, created_at) VALUES (?,?,?,?,?,NOW())'
            );
            foreach ($msgs as $m) {
                $ins->execute([$newId, $m['role'], $m['content'], $m['attachments_json'] ?? null, $m['model']]);
            }
            $pdo->commit();
            acx_json_out(['success' => true, 'new_conversation_id' => $newId, 'title' => $newTitle]);
        case 'truncate_messages':
            $cid = (int) ($in['conversation_id'] ?? 0);
            $keep = (int) ($in['keep_count'] ?? 0);
            if ($cid <= 0 || $keep < 0) {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            $st = $pdo->prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?');
            $st->execute([$cid, $uid]);
            if (!$st->fetch()) {
                acx_json_out(['success' => false, 'error' => 'not_found'], 404);
            }
            $st = $pdo->prepare('SELECT id FROM messages WHERE conversation_id = ? ORDER BY id ASC');
            $st->execute([$cid]);
            $ids = array_map(static fn ($r) => (int) $r['id'], $st->fetchAll() ?: []);
            $dropIds = array_slice($ids, $keep);
            if ($dropIds !== []) {
                $placeholders = implode(',', array_fill(0, count($dropIds), '?'));
                $pdo->prepare('DELETE FROM messages WHERE id IN (' . $placeholders . ') AND conversation_id = ?')
                    ->execute([...$dropIds, $cid]);
            }
            $pdo->prepare('UPDATE conversations SET updated_at = NOW() WHERE id = ? AND user_id = ?')->execute([$cid, $uid]);
            acx_json_out(['success' => true]);
        case 'save_ephemeral':
            $cid = (int) ($in['conversation_id'] ?? 0);
            $title = trim((string) ($in['title'] ?? ''));
            if ($cid <= 0) {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            $st = $pdo->prepare('SELECT id, title, is_ephemeral FROM conversations WHERE id = ? AND user_id = ?');
            $st->execute([$cid, $uid]);
            $conv = $st->fetch();
            if (!$conv) {
                acx_json_out(['success' => false, 'error' => 'not_found'], 404);
            }
            if (empty($conv['is_ephemeral'])) {
                acx_json_out(['success' => true, 'conversation_id' => $cid, 'already_saved' => true]);
            }
            if ($title === '') {
                $title = (string) ($conv['title'] ?? 'Новый чат');
            }
            $pdo->prepare(
                'UPDATE conversations SET is_ephemeral = 0, title = ?, updated_at = NOW() WHERE id = ? AND user_id = ?'
            )->execute([$title, $cid, $uid]);
            acx_json_out(['success' => true, 'conversation_id' => $cid, 'title' => $title]);
        case 'import_guest':
            $payload = $in['guest'] ?? null;
            if (!is_array($payload)) {
                acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
            }
            $title = trim((string) ($payload['title'] ?? 'Новый чат'));
            if ($title === '') {
                $title = 'Новый чат';
            }
            $modelKey = (string) ($payload['model'] ?? acx_default_model_key(false));
            $msgsIn = is_array($payload['messages'] ?? null) ? $payload['messages'] : [];
            if ($msgsIn === []) {
                acx_json_out(['success' => false, 'error' => 'empty_messages'], 400);
            }
            $pdo->beginTransaction();
            $pdo->prepare('INSERT INTO conversations (user_id, title, title_auto, model, is_ephemeral) VALUES (?,?,0,?,0)')->execute(
                [$uid, $title, $modelKey]
            );
            $newId = (int) $pdo->lastInsertId();
            $ins = $pdo->prepare(
                'INSERT INTO messages (conversation_id, role, content, attachments_json, model, meta_json, created_at) VALUES (?,?,?,?,?,?,NOW())'
            );
            foreach ($msgsIn as $m) {
                if (!is_array($m)) {
                    continue;
                }
                $role = (string) ($m['role'] ?? '');
                if ($role !== 'user' && $role !== 'assistant') {
                    continue;
                }
                $content = (string) ($m['content'] ?? '');
                if ($content === '') {
                    continue;
                }
                $attJson = null;
                if (!empty($m['attachments']) && is_array($m['attachments'])) {
                    $attJson = json_encode($m['attachments'], JSON_UNESCAPED_UNICODE);
                }
                $metaJson = null;
                if (!empty($m['research']) && is_array($m['research'])) {
                    $metaJson = json_encode(['research' => $m['research']], JSON_UNESCAPED_UNICODE);
                } elseif (!empty($m['meta_json'])) {
                    $metaJson = is_string($m['meta_json']) ? $m['meta_json'] : json_encode($m['meta_json'], JSON_UNESCAPED_UNICODE);
                }
                $ins->execute([
                    $newId,
                    $role,
                    $content,
                    $attJson,
                    (string) ($m['model'] ?? $modelKey),
                    $metaJson,
                ]);
            }
            $pdo->prepare('UPDATE conversations SET updated_at = NOW() WHERE id = ?')->execute([$newId]);
            $pdo->commit();
            acx_json_out(['success' => true, 'conversation_id' => $newId, 'title' => $title]);
        default:
            acx_json_out(['success' => false, 'error' => 'unknown_action'], 400);
    }
} catch (Throwable $e) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('chat api: ' . $e->getMessage());
    acx_json_out(['success' => false, 'error' => 'server_error'], 500);
}

function acx_purge_stale_ephemeral(PDO $pdo, int $uid): void
{
    $pdo->prepare(
        'DELETE FROM conversations WHERE user_id = ? AND is_ephemeral = 1 AND updated_at < DATE_SUB(NOW(), INTERVAL 3 DAY)'
    )->execute([$uid]);
}

function acx_conv_is_ephemeral(PDO $pdo, int $cid, int $uid): bool
{
    $st = $pdo->prepare('SELECT is_ephemeral FROM conversations WHERE id = ? AND user_id = ? LIMIT 1');
    $st->execute([$cid, $uid]);
    $row = $st->fetch();

    return is_array($row) && !empty($row['is_ephemeral']);
}

/**
 * @param list<array<string,mixed>> $rows
 * @return array<string, list<array<string,mixed>>>
 */
function acx_group_conversations_by_date(array $rows): array
{
    $grouped = [];
    $now = new DateTimeImmutable('now');
    foreach ($rows as $conv) {
        $date = new DateTimeImmutable((string) $conv['updated_at']);
        $days = (int) floor(abs($now->getTimestamp() - $date->getTimestamp()) / 86400);
        if ($days === 0) {
            $group = 'Сегодня';
        } elseif ($days === 1) {
            $group = 'Вчера';
        } elseif ($days <= 7) {
            $group = 'На этой неделе';
        } elseif ($days <= 30) {
            $group = 'В этом месяце';
        } else {
            $group = $date->format('F Y');
        }
        if (!isset($grouped[$group])) {
            $grouped[$group] = [];
        }
        $grouped[$group][] = $conv;
    }
    return $grouped;
}

/**
 * @param list<array<string,mixed>> $convs
 */
function acx_guest_group_conversations(array $convs): array
{
    $out = ['Демо' => []];
    foreach ($convs as $c) {
        if (!empty($c['is_ephemeral'])) {
            continue;
        }
        $out['Демо'][] = [
            'id' => 0,
            'local_id' => $c['local_id'],
            'title' => $c['title'],
            'model' => $c['model'],
            'created_at' => $c['created_at'],
            'updated_at' => $c['updated_at'],
            'message_count' => count($c['messages'] ?? []),
            'is_pinned' => 0,
        ];
    }
    return $out;
}

/**
 * @param list<array<string,mixed>> $convs
 * @return array{groups:array<string,list<array<string,mixed>>>,has_more:bool,next_offset:int}
 */
function acx_guest_group_conversations_paged(array $convs, int $offset, int $limit): array
{
    $regular = [];
    foreach ($convs as $c) {
        if (!empty($c['is_ephemeral'])) {
            continue;
        }
        $regular[] = $c;
    }
    usort($regular, static function (array $a, array $b): int {
        return strcmp((string) ($b['updated_at'] ?? ''), (string) ($a['updated_at'] ?? ''));
    });
    $slice = array_slice($regular, $offset, $limit);
    $items = [];
    foreach ($slice as $c) {
        $items[] = [
            'id' => 0,
            'local_id' => $c['local_id'],
            'title' => $c['title'],
            'model' => $c['model'],
            'created_at' => $c['created_at'],
            'updated_at' => $c['updated_at'],
            'message_count' => count($c['messages'] ?? []),
            'is_pinned' => 0,
        ];
    }

    return [
        'groups' => $items === [] ? [] : ['Демо' => $items],
        'has_more' => ($offset + count($slice)) < count($regular),
        'next_offset' => $offset + count($slice),
    ];
}

/**
 * @param array<string, mixed> $in
 * @param array<string, mixed> $modelRow
 * @param array<string, mixed> $guestCfg
 */
function acx_handle_guest_send(array $in, string $message, array $modelRow, array $guestCfg): void
{
    $g = acx_guest_state();
    $maxC = (int) $guestCfg['max_conversations'];
    $maxDay = (int) $guestCfg['max_user_messages_per_day'];
    $histN = (int) $guestCfg['history_messages'];
    $maxTok = (int) $guestCfg['max_tokens'];

    if ((int) ($g['daily_user_msgs'] ?? 0) >= $maxDay) {
        acx_json_out(['success' => false, 'error' => 'Достигнут дневной лимит демо-сообщений. Войдите через ASSISTIX ID для полного доступа.'], 429);
    }
    $rateErr = acx_rate_limit_check('guest', $guestCfg);
    if ($rateErr !== null) {
        acx_json_out(['success' => false, 'error' => $rateErr], 429);
    }

    $convs = &$g['conversations'];
    $activeIdx = null;
    $activeLocal = null;

    $localId = trim((string) ($in['local_id'] ?? ''));
    if ($localId !== '') {
        $idx = acx_guest_find_conv($g, $localId);
        if ($idx !== null) {
            $activeIdx = $idx;
            $activeLocal = $localId;
        }
    }

    if ($activeIdx === null) {
        if (count($convs) >= $maxC) {
            acx_json_out(['success' => false, 'error' => 'Максимум демо-чатов. Удалите один или войдите в аккаунт.'], 429);
        }
        $lid = acx_guest_new_local_id();
        $now = gmdate('c');
        $convs[] = [
            'local_id' => $lid,
            'title' => 'Новый чат',
            'title_auto' => 0,
            'model' => 'GUEST',
            'created_at' => $now,
            'updated_at' => $now,
            'messages' => [],
        ];
        $activeIdx = count($convs) - 1;
        $activeLocal = $lid;
    }

    $thread = &$convs[$activeIdx]['messages'];
    $thread[] = ['role' => 'user', 'content' => $message];
    $g['daily_user_msgs'] = (int) ($g['daily_user_msgs'] ?? 0) + 1;
    acx_rate_limit_record('guest');

    $slice = array_slice($thread, -$histN);
    $apiMsgs = [['role' => 'system', 'content' => acx_system_prompt('chat', 'GUEST')]];
    foreach ($slice as $m) {
        $apiMsgs[] = ['role' => $m['role'], 'content' => $m['content']];
    }

    $ioModel = trim((string) ($modelRow['ionet_model'] ?? ''));
    $useModel = acx_model_api_id($modelRow, false);
    $nvFallbacks = acx_model_nvidia_fallbacks($modelRow);
    $thinking = !empty($modelRow['thinking']);
    $temp = (float) ($modelRow['temperature'] ?? 0.7);
    $maxT = min($maxTok, (int) ($modelRow['max_tokens'] ?? 1200));

    $resp = acx_complete_openai_style(
        $apiMsgs,
        $useModel,
        $maxT,
        $temp,
        $thinking,
        $nvFallbacks,
        $ioModel !== '' && acx_ionet_enabled() ? $ioModel : null
    );
    if (isset($resp['error'])) {
        array_pop($thread);
        $g['daily_user_msgs']--;
        acx_json_out(['success' => false, 'error' => acx_sanitize_public_error((string) $resp['error'])], 502);
    }
    $assistant = (string) $resp['content'];
    $thread[] = ['role' => 'assistant', 'content' => $assistant];
    $convs[$activeIdx]['updated_at'] = gmdate('c');
    $convs[$activeIdx]['model'] = 'GUEST';

    acx_json_out([
        'success' => true,
        'guest' => true,
        'local_id' => $activeLocal,
        'conversation_id' => null,
        'user_message' => ['role' => 'user', 'content' => $message],
        'assistant_message' => ['role' => 'assistant', 'content' => $assistant],
        'model' => 'GUEST',
    ]);
}

/**
 * @param array{internal_id:int, id_user_id:int, email:string, display_name:string, avatar_url:string} $logged
 * @param array<string, mixed> $modelRow
 * @param array<string, mixed> $limitsCfg
 */
function acx_handle_user_send(array $logged, string $message, array $modelRow, int $convIdIn, array $limitsCfg): void
{
    $chk = acx_check_limits_before_send($modelRow, $logged['internal_id'], $limitsCfg);
    if (!$chk['ok']) {
        acx_json_out(['success' => false, 'error' => $chk['error']], 429);
    }

    $pdo = acx_db();
    $uid = $logged['internal_id'];
    $modelKey = (string) $modelRow['key'];

    if ($convIdIn <= 0) {
        $pdo->prepare('INSERT INTO conversations (user_id, title, title_auto, model) VALUES (?,?,0,?)')->execute([$uid, 'Новый чат', $modelKey]);
        $convIdIn = (int) $pdo->lastInsertId();
    } else {
        $st = $pdo->prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?');
        $st->execute([$convIdIn, $uid]);
        if (!$st->fetch()) {
            acx_json_out(['success' => false, 'error' => 'not_found'], 404);
        }
        $pdo->prepare('UPDATE conversations SET model = ?, updated_at = NOW() WHERE id = ? AND user_id = ?')->execute(
            [$modelKey, $convIdIn, $uid]
        );
    }

    $pdo->prepare('INSERT INTO messages (conversation_id, role, content, model) VALUES (?,?,?,?)')->execute(
        [$convIdIn, 'user', $message, $modelKey]
    );
    $userMsgId = (int) $pdo->lastInsertId();

    $st = $pdo->prepare(
        'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 40'
    );
    $st->execute([$convIdIn]);
    $hist = $st->fetchAll();
    $apiMsgs = [['role' => 'system', 'content' => acx_system_prompt('chat', $modelKey)]];
    foreach ($hist as $m) {
        $apiMsgs[] = ['role' => $m['role'], 'content' => $m['content']];
    }

    $ioModel = trim((string) ($modelRow['ionet_model'] ?? ''));
    $useModel = acx_model_api_id($modelRow, false);
    $nvFallbacks = acx_model_nvidia_fallbacks($modelRow);
    $thinking = !empty($modelRow['thinking']);
    $temp = (float) ($modelRow['temperature'] ?? 0.8);
    $maxT = (int) ($modelRow['max_tokens'] ?? 4096);

    $resp = acx_complete_openai_style(
        $apiMsgs,
        $useModel,
        $maxT,
        $temp,
        $thinking,
        $nvFallbacks,
        $ioModel !== '' && acx_ionet_enabled() ? $ioModel : null
    );
    if (isset($resp['error'])) {
        $pdo->prepare('DELETE FROM messages WHERE id = ?')->execute([$userMsgId]);
        acx_json_out(['success' => false, 'error' => acx_sanitize_public_error((string) $resp['error'])], 502);
    }
    $assistant = (string) $resp['content'];
    $tokens = $resp['total_tokens'] ?? null;
    $pdo->prepare('INSERT INTO messages (conversation_id, role, content, model) VALUES (?,?,?,?)')->execute(
        [$convIdIn, 'assistant', $assistant, $modelKey]
    );
    $asstId = (int) $pdo->lastInsertId();
    $pdo->prepare('UPDATE conversations SET updated_at = NOW() WHERE id = ?')->execute([$convIdIn]);

    acx_apply_usage_after_send($modelRow, $logged['internal_id'], is_int($tokens) ? $tokens : null, $message, $assistant);

    acx_json_out([
        'success' => true,
        'guest' => false,
        'conversation_id' => $convIdIn,
        'user_message' => ['id' => $userMsgId, 'role' => 'user', 'content' => $message],
        'assistant_message' => ['id' => $asstId, 'role' => 'assistant', 'content' => $assistant],
        'model' => $modelKey,
    ]);
}

/**
 * @param array<string, mixed> $in
 */
function acx_chat_generate_title_guest(array $in): void
{
    $lid = trim((string) ($in['local_id'] ?? ''));
    if ($lid === '') {
        acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
    }
    $g = acx_guest_state();
    $idx = acx_guest_find_conv($g, $lid);
    if ($idx === null) {
        acx_json_out(['success' => false, 'error' => 'not_found'], 404);
    }
    $conv = &$g['conversations'][$idx];
    if ((int) ($conv['title_auto'] ?? 0) !== 0) {
        acx_json_out(['success' => true, 'title' => (string) ($conv['title'] ?? 'Чат'), 'skipped' => true]);
    }
    $pair = acx_chat_first_message_pair($conv['messages'] ?? []);
    if ($pair === null) {
        acx_json_out(['success' => false, 'error' => 'no_messages'], 400);
    }
    $title = acx_generate_chat_title($pair['user'], $pair['assistant']);
    $conv['title'] = $title;
    $conv['title_auto'] = 1;
    acx_json_out(['success' => true, 'title' => $title]);
}

/**
 * @param array<string, mixed> $in
 */
function acx_chat_generate_title_user(PDO $pdo, int $uid, array $in): void
{
    $cid = (int) ($in['conversation_id'] ?? 0);
    if ($cid <= 0) {
        acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
    }
    $st = $pdo->prepare('SELECT id, title, title_auto FROM conversations WHERE id = ? AND user_id = ?');
    $st->execute([$cid, $uid]);
    $conv = $st->fetch();
    if (!$conv) {
        acx_json_out(['success' => false, 'error' => 'not_found'], 404);
    }
    if ((int) ($conv['title_auto'] ?? 0) !== 0) {
        acx_json_out(['success' => true, 'title' => (string) $conv['title'], 'skipped' => true]);
    }
    $st = $pdo->prepare(
        'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 6'
    );
    $st->execute([$cid]);
    $msgs = $st->fetchAll();
    $pair = acx_chat_first_message_pair($msgs);
    if ($pair === null) {
        acx_json_out(['success' => false, 'error' => 'no_messages'], 400);
    }
    $title = acx_generate_chat_title($pair['user'], $pair['assistant']);
    $pdo->prepare('UPDATE conversations SET title = ?, title_auto = 1, updated_at = NOW() WHERE id = ? AND user_id = ?')->execute(
        [$title, $cid, $uid]
    );
    acx_json_out(['success' => true, 'title' => $title]);
}

/**
 * @param array<string, mixed> $in
 */
function acx_chat_share_link(PDO $pdo, int $uid, array $in): void
{
    $cid = (int) ($in['conversation_id'] ?? 0);
    if ($cid <= 0) {
        acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
    }
    $st = $pdo->prepare('SELECT id, share_token FROM conversations WHERE id = ? AND user_id = ?');
    $st->execute([$cid, $uid]);
    $conv = $st->fetch();
    if (!$conv) {
        acx_json_out(['success' => false, 'error' => 'not_found'], 404);
    }
    if (acx_conv_is_ephemeral($pdo, $cid, $uid)) {
        acx_json_out(['success' => false, 'error' => 'ephemeral_not_allowed'], 403);
    }
    $token = trim((string) ($conv['share_token'] ?? ''));
    if ($token === '') {
        $token = acx_new_share_token();
        $pdo->prepare('UPDATE conversations SET share_token = ? WHERE id = ? AND user_id = ?')->execute([$token, $cid, $uid]);
    }
    $base = acx_app_base_url();
    acx_json_out([
        'success' => true,
        'share_url' => $base . '/s/' . $token,
        'owner_url' => $base . '/c/' . $cid,
    ]);
}

/**
 * @param list<array<string,mixed>> $messages
 * @return array{user:string,assistant:string}|null
 */
function acx_chat_first_message_pair(array $messages): ?array
{
    $user = '';
    $assistant = '';
    foreach ($messages as $m) {
        if (!is_array($m)) {
            continue;
        }
        $role = (string) ($m['role'] ?? '');
        $content = trim((string) ($m['content'] ?? ''));
        if ($content === '' || $content === '[файлы]') {
            continue;
        }
        if ($role === 'user' && $user === '') {
            $user = $content;
        } elseif ($role === 'assistant' && $user !== '' && $assistant === '') {
            $assistant = $content;
            break;
        }
    }
    if ($user === '') {
        return null;
    }

    return ['user' => $user, 'assistant' => $assistant];
}
