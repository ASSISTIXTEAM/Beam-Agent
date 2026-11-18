<?php
declare(strict_types=1);

/**
 * Beam Agent cloud models (Kumorouter) — parity with desktop Tide / Flare / Pine.
 * Guest/demo catalog removed: ASSISTIX ID required.
 *
 * @return array<string, array<string, mixed>>
 */
function acx_model_catalog(bool $guestMode): array
{
    if ($guestMode) {
        // Auth-only product: no demo model. Callers must reject unauthenticated use.
        return [];
    }

    $tide = 'deepseek-v4-1-flash';
    $tideFallbacks = acx_filter_kumo_models(['deepseek-v4-flash', 'qwen3-8-flash']);
    // Prefer Gemini 3.8 family; 3.1 lite is blocked on Kumo.
    $flare = 'gemini-3.8-flash';
    $flareFallbacks = acx_filter_kumo_models(['google/gemini-3.8-flash-high', 'qwen3-8-flash', 'deepseek-v4-flash']);
    $pine = 'xai/grok-4.7';
    $pineFallbacks = acx_filter_kumo_models(['xai/grok-4.6', 'deepseek-v4-pro-0813', 'deepseek-v4-flash']);

    $catalog = [
        'TIDE' => [
            'key' => 'TIDE',
            'name' => 'Tide',
            'description' => 'Быстрый режим Beam Agent — код, агент, повседневные задачи.',
            'guest_only' => false,
            'nvidia_model' => $tide,
            'kumo_model' => $tide,
            'nvidia_fallback_models' => $tideFallbacks,
            'ionet_model' => '',
            'max_tokens' => 8192,
            'temperature' => 0.4,
            'thinking' => false,
            'usage_tide' => true,
            'usage_flair' => false,
            'usage_pine' => false,
            'supports_vision' => true,
        ],
        'FLARE' => [
            'key' => 'FLARE',
            'name' => 'Flare',
            'description' => 'Сбалансированный режим — длинный контекст и мультимодальность.',
            'guest_only' => false,
            'nvidia_model' => $flare,
            'kumo_model' => $flare,
            'nvidia_fallback_models' => $flareFallbacks,
            'ionet_model' => '',
            'max_tokens' => 8192,
            'temperature' => 0.4,
            'thinking' => false,
            'usage_tide' => false,
            'usage_flair' => true,
            'usage_pine' => false,
            'supports_vision' => true,
        ],
        'PINE' => [
            'key' => 'PINE',
            'name' => 'Pine',
            'description' => 'Сильный режим — сложные задачи и глубокое рассуждение.',
            'guest_only' => false,
            'nvidia_model' => $pine,
            'kumo_model' => $pine,
            'nvidia_fallback_models' => $pineFallbacks,
            'ionet_model' => '',
            'max_tokens' => 8192,
            'temperature' => 0.35,
            'thinking' => false,
            'usage_tide' => false,
            'usage_flair' => false,
            'usage_pine' => true,
            'supports_vision' => false,
        ],
    ];

    // Back-compat aliases for older conversations / clients
    $catalog['FLAIR'] = $catalog['FLARE'];
    $catalog['FLAIR']['key'] = 'FLAIR';
    $catalog['FLAIR']['name'] = 'Flare';

    return $catalog;
}

function acx_utility_model_id(): string
{
    $cfg = function_exists('acx_config') ? acx_config() : [];
    $m = trim((string) ($cfg['kumo']['utility_model'] ?? $cfg['utility_model'] ?? 'deepseek-v4-flash'));

    return $m !== '' ? $m : 'deepseek-v4-flash';
}

/** @return list<string> */
function acx_utility_fallbacks(): array
{
    return acx_filter_kumo_models(['qwen3-8-flash']);
}

/** @return list<string> */
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
    return $guestMode ? '' : 'TIDE';
}

/** @param array<string, mixed> $cat */
function acx_resolve_model(string $requested, bool $guestMode, array $cat): array
{
    $k = strtoupper(trim($requested));
    if ($guestMode || $cat === []) {
        throw new RuntimeException('auth_required');
    }
    if ($k === 'FLAIR') {
        $k = 'FLARE';
    }
    if ($k === 'FLARE' && !isset($cat['FLARE']) && isset($cat['FLAIR'])) {
        return $cat['FLAIR'];
    }
    if (!isset($cat[$k])) {
        return $cat['TIDE'] ?? $cat['FLARE'] ?? $cat['FLAIR'] ?? reset($cat);
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
