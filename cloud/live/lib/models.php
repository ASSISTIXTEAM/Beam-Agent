<?php
declare(strict_types=1);

/**
 * Модели ASSISTIX (Kumo):
 * - FLAIR → DeepSeek V4 Flash (быстрый режим)
 * - PINE  → Grok 4.5 (сильный режим)
 * Побочные ИИ-задачи (авто-название чата и т.п.) → DeepSeek V4 Flash.
 *
 * @return array<string, array<string, mixed>>
 */
function acx_model_catalog(bool $guestMode): array
{
    $deepseek = 'deepseek-v4-flash';
    // Только рабочие дешёвые фолбэки. Gemini 3.1 Flash Lite на Kumo мёртвый — не трогаем.
    $cheapFallback = ['qwen3-8-flash'];

    if ($guestMode) {
        return [
            'GUEST' => [
                'key' => 'GUEST',
                'name' => 'Демо',
                'description' => 'Короткое демо BEAM AGENT. Войдите для полного доступа.',
                'guest_only' => true,
                'nvidia_model' => $deepseek,
                'kumo_model' => $deepseek,
                'nvidia_fallback_models' => $cheapFallback,
                'ionet_model' => '',
                'max_tokens' => 260,
                'temperature' => 0.4,
                'thinking' => false,
                'usage_tide' => false,
                'usage_flair' => false,
                'usage_pine' => false,
                'supports_vision' => false,
            ],
        ];
    }

    return [
        'FLAIR' => [
            'key' => 'FLAIR',
            'name' => 'FLAIR',
            'description' => 'Быстрый режим на DeepSeek V4 Flash — код и агент.',
            'guest_only' => false,
            'nvidia_model' => $deepseek,
            'kumo_model' => $deepseek,
            'nvidia_fallback_models' => $cheapFallback,
            'ionet_model' => '',
            'max_tokens' => 900,
            'temperature' => 0.4,
            'thinking' => false,
            'usage_tide' => false,
            'usage_flair' => true,
            'usage_pine' => false,
            'supports_vision' => false,
        ],
        'PINE' => [
            'key' => 'PINE',
            'name' => 'PINE',
            'description' => 'Grok 4.5 — сильный режим. 2 запроса/нед.',
            'guest_only' => false,
            'nvidia_model' => 'xai/grok-4.5',
            'kumo_model' => 'xai/grok-4.5',
            'nvidia_fallback_models' => [$deepseek, 'qwen3-8-flash'],
            'ionet_model' => '',
            'max_tokens' => 1400,
            'temperature' => 0.35,
            'thinking' => false,
            'usage_tide' => false,
            'usage_flair' => false,
            'usage_pine' => true,
            'supports_vision' => false,
        ],
    ];
}

/**
 * Модель для побочных ИИ-действий (авто-название чата, короткие утилиты).
 * Не списывает лимиты TIDE/FLAIR/PINE — отдельный дешёвый вызов.
 */
function acx_utility_model_id(): string
{
    $cfg = function_exists('acx_config') ? acx_config() : [];
    $m = trim((string) ($cfg['kumo']['utility_model'] ?? $cfg['utility_model'] ?? 'deepseek-v4-flash'));

    return $m !== '' ? $m : 'deepseek-v4-flash';
}

/**
 * @return list<string>
 */
function acx_utility_fallbacks(): array
{
    return acx_filter_kumo_models(['qwen3-8-flash']);
}

/**
 * Модели, которые на Kumo не работают / жрут таймауты — никогда не дергать.
 *
 * @return list<string>
 */
function acx_kumo_blocked_models(): array
{
    return [
        'google/gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite',
        'google/gemini-3.1-flash',
        'gemini-3.1-flash',
    ];
}

/**
 * @param list<string> $models
 * @return list<string>
 */
function acx_filter_kumo_models(array $models): array
{
    $blocked = array_fill_keys(acx_kumo_blocked_models(), true);
    $out = [];
    foreach ($models as $m) {
        $s = trim((string) $m);
        $low = strtolower($s);
        if ($s === '' || isset($blocked[$s]) || isset($blocked[$low])) {
            continue;
        }
        if (str_contains($low, 'gemini-3.1') || str_contains($low, 'gemini-3-1')) {
            continue;
        }
        $out[] = $s;
    }

    return array_values(array_unique($out));
}

function acx_vision_model_catalog(): array
{
    return [
        'key' => 'VISION',
        'name' => 'Sight',
        'nvidia_model' => acx_vision_model_from_config(),
        'kumo_model' => acx_vision_model_from_config(),
        'supports_vision' => true,
    ];
}

function acx_vision_model_from_config(): string
{
    $cfg = acx_config();
    if (acx_kumo_enabled()) {
        $m = trim((string) ($cfg['vision']['kumo_model'] ?? $cfg['kumo']['vision_model'] ?? 'qwen3-8-flash'));
        $filtered = acx_filter_kumo_models([$m]);

        return $filtered[0] ?? 'qwen3-8-flash';
    }
    $m = trim((string) ($cfg['vision']['nvidia_model'] ?? 'meta/llama-3.2-11b-vision-instruct'));

    return $m !== '' ? $m : 'meta/llama-3.2-11b-vision-instruct';
}

function acx_default_model_key(bool $guestMode): string
{
    return $guestMode ? 'GUEST' : 'FLAIR';
}

/** @param array<string, mixed> $cat */
function acx_resolve_model(string $requested, bool $guestMode, array $cat): array
{
    $k = strtoupper(trim($requested));
    if ($guestMode) {
        return $cat['GUEST'];
    }
    if (!isset($cat[$k])) {
        return $cat['FLAIR'] ?? $cat['GUEST'];
    }

    return $cat[$k];
}

function acx_estimate_tokens(string $text): int
{
    $len = strlen($text);

    return (int) max(1, ceil($len / 4));
}

/**
 * @param array<string, mixed> $modelRow
 * @return list<string>
 */
function acx_model_nvidia_fallbacks(array $modelRow): array
{
    $raw = $modelRow['nvidia_fallback_models'] ?? [];
    if (!is_array($raw)) {
        return [];
    }

    return acx_filter_kumo_models($raw);
}

function acx_model_primary_nvidia_id(array $modelRow, bool $hasImages = false): string
{
    if ($hasImages) {
        return acx_vision_model_from_config();
    }
    if (acx_kumo_enabled()) {
        $kumo = trim((string) ($modelRow['kumo_model'] ?? ''));
        if ($kumo !== '') {
            return $kumo;
        }
    }

    return trim((string) ($modelRow['nvidia_model'] ?? ''));
}

function acx_model_api_id(array $modelRow, bool $hasImages = false): string
{
    if (!acx_llm_configured()) {
        return '';
    }
    $model = acx_model_primary_nvidia_id($modelRow, $hasImages);

    return $model !== '' ? $model : (acx_kumo_enabled() ? 'deepseek-v4-flash' : 'poolside/laguna-xs-2.1');
}

function acx_kumo_enabled(): bool
{
    if (!function_exists('acx_config')) {
        return false;
    }

    return trim((string) (acx_config()['kumo']['api_key'] ?? '')) !== '';
}

function acx_llm_configured(): bool
{
    if (!function_exists('acx_config')) {
        return false;
    }
    $cfg = acx_config();
    if (trim((string) ($cfg['kumo']['api_key'] ?? '')) !== '') {
        return true;
    }

    return trim((string) ($cfg['nvidia']['api_key'] ?? '')) !== '';
}
