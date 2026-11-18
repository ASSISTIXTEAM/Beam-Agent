<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/ratelimit.php';
require_once __DIR__ . '/models.php';

const ACX_TOKENS_PER_LEGACY_FLAIR_REQUEST = 4000;
const ACX_TOKENS_PER_LEGACY_PINE_REQUEST = 8000;

function acx_week_start_utc(): string
{
    $dt = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $dow = (int) $dt->format('N');
    $monday = $dt->modify('-' . ($dow - 1) . ' days');

    return $monday->format('Y-m-d');
}

/** @return array{tide_tokens_used:int, flair_tokens_used:int, pine_tokens_used:int} */
function acx_get_weekly_usage(int $internalUserId): array
{
    if (is_readable(__DIR__ . '/promo.php')) {
        require_once __DIR__ . '/promo.php';
        if (function_exists('acx_db_ensure_promo_columns')) {
            acx_db_ensure_promo_columns();
        }
    }
    $week = acx_week_start_utc();
    $pdo = acx_db();
    try {
        $st = $pdo->prepare(
            'SELECT tide_tokens_used, flair_tokens_used, pine_tokens_used FROM weekly_usage WHERE user_id = ? AND week_start = ? LIMIT 1'
        );
        $st->execute([$internalUserId, $week]);
        $row = $st->fetch();
    } catch (Throwable) {
        $st = $pdo->prepare(
            'SELECT flair_tokens_used, pine_tokens_used FROM weekly_usage WHERE user_id = ? AND week_start = ? LIMIT 1'
        );
        $st->execute([$internalUserId, $week]);
        $row = $st->fetch();
        if (is_array($row)) {
            $row['tide_tokens_used'] = 0;
        }
    }
    if (!$row) {
        try {
            $ins = $pdo->prepare(
                'INSERT IGNORE INTO weekly_usage (user_id, week_start, tide_tokens_used, flair_tokens_used, pine_tokens_used) VALUES (?,?,0,0,0)'
            );
            $ins->execute([$internalUserId, $week]);
        } catch (Throwable) {
            $ins = $pdo->prepare(
                'INSERT IGNORE INTO weekly_usage (user_id, week_start, flair_tokens_used, pine_tokens_used) VALUES (?,?,0,0)'
            );
            $ins->execute([$internalUserId, $week]);
        }
        try {
            $st = $pdo->prepare(
                'SELECT tide_tokens_used, flair_tokens_used, pine_tokens_used FROM weekly_usage WHERE user_id = ? AND week_start = ? LIMIT 1'
            );
            $st->execute([$internalUserId, $week]);
            $row = $st->fetch();
        } catch (Throwable) {
            $st = $pdo->prepare(
                'SELECT flair_tokens_used, pine_tokens_used FROM weekly_usage WHERE user_id = ? AND week_start = ? LIMIT 1'
            );
            $st->execute([$internalUserId, $week]);
            $row = $st->fetch() ?: [];
            $row['tide_tokens_used'] = 0;
        }
    }

    return [
        'tide_tokens_used' => (int) ($row['tide_tokens_used'] ?? 0),
        'flair_tokens_used' => (int) ($row['flair_tokens_used'] ?? 0),
        'pine_tokens_used' => (int) ($row['pine_tokens_used'] ?? 0),
    ];
}

function acx_add_tide_tokens(int $internalUserId, int $tokens): void
{
    $tokens = max(0, $tokens);
    if ($tokens === 0) {
        return;
    }
    $week = acx_week_start_utc();
    $pdo = acx_db();
    try {
        $pdo->prepare(
            'INSERT INTO weekly_usage (user_id, week_start, tide_tokens_used, flair_tokens_used, pine_tokens_used)
             VALUES (?,?,?,0,0)
             ON DUPLICATE KEY UPDATE tide_tokens_used = tide_tokens_used + VALUES(tide_tokens_used)'
        )->execute([$internalUserId, $week, $tokens]);
    } catch (Throwable) {
        // column may be missing briefly
    }
}

function acx_add_flair_tokens(int $internalUserId, int $tokens): void
{
    $tokens = max(0, $tokens);
    if ($tokens === 0) {
        return;
    }
    $week = acx_week_start_utc();
    $pdo = acx_db();
    $pdo->prepare(
        'INSERT INTO weekly_usage (user_id, week_start, flair_tokens_used, pine_tokens_used)
         VALUES (?,?,?,0)
         ON DUPLICATE KEY UPDATE flair_tokens_used = flair_tokens_used + VALUES(flair_tokens_used)'
    )->execute([$internalUserId, $week, $tokens]);
}

function acx_add_pine_tokens(int $internalUserId, int $tokens): void
{
    $tokens = max(0, $tokens);
    if ($tokens === 0) {
        return;
    }
    $week = acx_week_start_utc();
    $pdo = acx_db();
    $pdo->prepare(
        'INSERT INTO weekly_usage (user_id, week_start, flair_tokens_used, pine_tokens_used)
         VALUES (?,?,0,?)
         ON DUPLICATE KEY UPDATE pine_tokens_used = pine_tokens_used + VALUES(pine_tokens_used)'
    )->execute([$internalUserId, $week, $tokens]);
}

/** @param array<string,mixed> $cfgLimits */
function acx_limits_weekly_tokens(array $cfgLimits, string $model): ?int
{
    if (!empty($cfgLimits['unlimited'])) {
        return null;
    }

    if ($model === 'tide') {
        return max(1, (int) ($cfgLimits['tide_weekly_tokens'] ?? 10_000));
    }

    if ($model === 'pine' && isset($cfgLimits['pine_weekly_requests'])) {
        return max(1, (int) $cfgLimits['pine_weekly_requests']);
    }

    $tokenKey = $model === 'pine' ? 'pine_weekly_tokens' : 'flair_weekly_tokens';
    $legacyKey = $model === 'pine' ? 'pine_weekly_requests' : 'flair_weekly_requests';
    $legacyMul = $model === 'pine'
        ? ACX_TOKENS_PER_LEGACY_PINE_REQUEST
        : ACX_TOKENS_PER_LEGACY_FLAIR_REQUEST;
    $default = $model === 'pine' ? 2 : 25_000;

    if (isset($cfgLimits[$tokenKey]) && $model !== 'pine') {
        return max(1, (int) $cfgLimits[$tokenKey]);
    }
    if ($model === 'pine' && isset($cfgLimits['pine_weekly_tokens']) && !isset($cfgLimits['pine_weekly_requests'])) {
        return max(1, (int) $cfgLimits['pine_weekly_tokens']);
    }
    if (isset($cfgLimits[$legacyKey])) {
        return max(1, (int) $cfgLimits[$legacyKey] * ($model === 'pine' ? 1 : $legacyMul));
    }

    return max(1, $default);
}

function acx_turn_token_usage(?int $apiTotal, string $userMessage, string $assistantMessage): int
{
    if ($apiTotal !== null && $apiTotal > 0) {
        return $apiTotal;
    }

    return max(1, acx_estimate_tokens($userMessage) + acx_estimate_tokens($assistantMessage));
}

/**
 * @param array<string, mixed> $modelRow from acx_model_catalog
 * @return array{ok:true}|array{ok:false, error:string}
 */
function acx_check_limits_before_send(array $modelRow, int $internalUserId, array $cfgLimits): array
{
    if (!empty($cfgLimits['unlimited'])) {
        return ['ok' => true];
    }

    $tideCap = acx_limits_weekly_tokens($cfgLimits, 'tide');
    $flairCap = acx_limits_weekly_tokens($cfgLimits, 'flair');
    $pineCap = acx_limits_weekly_tokens($cfgLimits, 'pine');
    $u = acx_get_weekly_usage($internalUserId);

    if (!empty($modelRow['usage_pine'])) {
        if ($pineCap !== null && $u['pine_tokens_used'] >= $pineCap) {
            return [
                'ok' => false,
                'error' => 'Недельный лимит PINE исчерпан (2 запроса). Выберите FLAIR или дождитесь сброса (понедельник UTC).',
            ];
        }
    }
    if (!empty($modelRow['usage_flair'])) {
        if ($flairCap !== null && $u['flair_tokens_used'] >= $flairCap) {
            return [
                'ok' => false,
                'error' => 'Недельный лимит токенов FLAIR исчерпан. Переключитесь на PINE или дождитесь сброса.',
            ];
        }
    }
    if (!empty($modelRow['usage_tide'])) {
        if ($tideCap !== null && $u['tide_tokens_used'] >= $tideCap) {
            return [
                'ok' => false,
                'error' => 'Недельный лимит токенов FLAIR исчерпан. Переключитесь на PINE или дождитесь сброса (понедельник UTC).',
            ];
        }
    }

    return ['ok' => true];
}

function acx_model_limit_ok(array $modelRow, int $internalUserId, array $cfgLimits): bool
{
    return acx_check_limits_before_send($modelRow, $internalUserId, $cfgLimits)['ok'];
}

/**
 * @param array<string, array<string, mixed>> $catalog
 * @return list<string>
 */
function acx_stream_fallback_model_keys(array $catalog): array
{
    $out = [];
    foreach (['FLAIR'] as $k) {
        if (isset($catalog[$k])) {
            $out[] = $k;
        }
    }

    return $out;
}

/**
 * @param array<string, array<string, mixed>> $catalog
 * @return array{model_row: array<string, mixed>, model_key: string, fallback_from: ?string}
 */
function acx_resolve_stream_model(
    string $requestedKey,
    string $mode,
    bool $guestMode,
    array $catalog,
    ?int $internalUserId,
    array $cfgLimits
): array {
    if ($guestMode) {
        $row = acx_resolve_model($requestedKey, true, $catalog);

        return [
            'model_row' => $row,
            'model_key' => (string) ($row['key'] ?? 'GUEST'),
            'fallback_from' => null,
        ];
    }

    if ($mode === 'reasoning' && isset($catalog['PINE'])) {
        $requestedKey = 'PINE';
    }
    if ($mode === 'agent' && isset($catalog['FLAIR'])) {
        // Agent mode always runs on FLAIR.
        $requestedKey = 'FLAIR';
    }

    $modelRow = acx_resolve_model($requestedKey, false, $catalog);
    $modelKey = strtoupper((string) ($modelRow['key'] ?? 'FLAIR'));

    if ($internalUserId === null) {
        return ['model_row' => $modelRow, 'model_key' => $modelKey, 'fallback_from' => null];
    }

    if (acx_model_limit_ok($modelRow, $internalUserId, $cfgLimits)) {
        return ['model_row' => $modelRow, 'model_key' => $modelKey, 'fallback_from' => null];
    }

    if ($mode !== 'research' && $mode !== 'reasoning' && $mode !== 'agent') {
        return ['model_row' => $modelRow, 'model_key' => $modelKey, 'fallback_from' => null];
    }

    $fallbackFrom = $modelKey;
    foreach (acx_stream_fallback_model_keys($catalog) as $altKey) {
        $altRow = $catalog[$altKey];
        if (acx_model_limit_ok($altRow, $internalUserId, $cfgLimits)) {
            return ['model_row' => $altRow, 'model_key' => $altKey, 'fallback_from' => $fallbackFrom];
        }
    }

    return ['model_row' => $modelRow, 'model_key' => $modelKey, 'fallback_from' => null];
}

/**
 * @param array<string, mixed> $modelRow
 */
function acx_apply_usage_after_send(
    array $modelRow,
    int $internalUserId,
    ?int $totalTokensFromApi,
    string $userMessage,
    string $assistantMessage
): void {
    $tokens = acx_turn_token_usage($totalTokensFromApi, $userMessage, $assistantMessage);
    if (!empty($modelRow['usage_tide'])) {
        acx_add_tide_tokens($internalUserId, $tokens);
    }
    if (!empty($modelRow['usage_flair'])) {
        acx_add_flair_tokens($internalUserId, $tokens);
    }
    if (!empty($modelRow['usage_pine'])) {
        // PINE считаем запросами (1 за ответ), не сырыми токенами.
        acx_add_pine_tokens($internalUserId, 1);
    }
}

/** @deprecated Use acx_limits_weekly_tokens() */
function acx_limits_flair_cap(array $cfgLimits): int
{
    return acx_limits_weekly_tokens($cfgLimits, 'flair') ?? 500_000;
}
