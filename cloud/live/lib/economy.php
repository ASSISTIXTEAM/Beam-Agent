<?php
declare(strict_types=1);

/**
 * Жёсткий эконом токенов BEAM AGENT.
 * Все потолки читаются из config.local.php → economy (+ безопасные дефолты).
 */

/** @return array<string,mixed> */
function acx_economy(): array
{
    static $cached = null;
    if (is_array($cached)) {
        return $cached;
    }
    $cfg = function_exists('acx_config') ? acx_config() : [];
    $e = is_array($cfg['economy'] ?? null) ? $cfg['economy'] : [];
    $cached = array_merge([
        'enabled' => true,
        'history_messages' => 4,
        'history_chars' => 480,
        'system_max_chars' => 700,
        'memory_items' => 6,
        'memory_item_chars' => 120,
        'search_sources' => 2,
        'search_snippet_chars' => 90,
        'doc_context_chars' => 1600,
        'research_max_tokens' => 600,
        'research_excerpt_chars' => 350,
        'research_excerpts' => 2,
        'skip_widgets_chat' => true,
        'skip_now_context_chat' => true,
        'compact_system' => true,
        'no_second_pass' => true,
        'guest_max_tokens' => 160,
        'guest_history' => 2,
        'image_prompt_chars' => 480,
    ], $e);

    return $cached;
}

function acx_economy_on(): bool
{
    return !empty(acx_economy()['enabled']);
}

function acx_economy_int(string $key, int $fallback): int
{
    $v = (int) (acx_economy()[$key] ?? $fallback);

    return $v > 0 ? $v : $fallback;
}

function acx_economy_bool(string $key, bool $fallback = false): bool
{
    if (!array_key_exists($key, acx_economy())) {
        return $fallback;
    }

    return !empty(acx_economy()[$key]);
}

function acx_economy_truncate(string $text, int $maxChars): string
{
    $text = trim($text);
    if ($maxChars <= 0 || mb_strlen($text) <= $maxChars) {
        return $text;
    }

    return mb_substr($text, 0, max(1, $maxChars - 1)) . '…';
}

/**
 * Обрезает историю диалога перед отправкой в LLM.
 *
 * @param list<array<string,mixed>> $hist
 * @return list<array<string,mixed>>
 */
function acx_economy_trim_history(array $hist, ?int $maxMessages = null, ?int $maxChars = null): array
{
    if (!acx_economy_on()) {
        return $hist;
    }
    $maxMessages = $maxMessages ?? acx_economy_int('history_messages', 6);
    $maxChars = $maxChars ?? acx_economy_int('history_chars', 900);
    if (count($hist) > $maxMessages) {
        $hist = array_slice($hist, -$maxMessages);
    }
    $out = [];
    foreach ($hist as $m) {
        if (!is_array($m)) {
            continue;
        }
        $row = $m;
        if (isset($row['content']) && is_string($row['content'])) {
            $row['content'] = acx_economy_truncate($row['content'], $maxChars);
        }
        // reasoning в meta жрёт токены — в экономе не тащим
        if (isset($row['meta_json'])) {
            unset($row['meta_json']);
        }
        $out[] = $row;
    }

    return $out;
}

function acx_economy_cap_max_tokens(int $requested, string $mode = 'chat'): int
{
    if (!acx_economy_on()) {
        return max(1, $requested);
    }
    $cap = match ($mode) {
        'research' => acx_economy_int('research_max_tokens', 900),
        'agent' => min($requested, 800),
        'reasoning' => min($requested, 1000),
        'image' => min($requested, 400),
        default => $requested,
    };

    return max(64, min($requested, $cap));
}
