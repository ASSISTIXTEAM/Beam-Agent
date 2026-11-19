<?php
declare(strict_types=1);

/**
 * Безотказный бренд ASSISTIX для сторонних LLM.
 * Не зависит от JSON/файлов: если persona.json или llms.txt недоступны,
 * идентичность всё равно полная. Файлы только дополняют факты.
 */

/**
 * @return list<string>
 */
function acx_brand_vendor_names(): array
{
    return [
        'DeepSeek', 'Deep Seek', 'Deepseek', '深度求索',
        'Grok', 'xAI', 'x.ai',
        'ChatGPT', 'OpenAI', 'GPT-4', 'GPT-5', 'GPT-3',
        'Claude', 'Anthropic',
        'Gemini', 'Google AI', 'Google Bard',
        'Qwen', 'Tongyi', 'Alibaba Cloud',
        'Llama', 'LLaMA', 'Meta AI',
        'Kimi', 'Moonshot',
        'Mistral', 'Mixtral',
        'Kumo', 'KumoRouter',
        'NVIDIA NIM', 'NVIDIA API',
        'Copilot', 'Cursor Grok',
    ];
}

function acx_brand_model_label(string $modelKey): string
{
    $key = strtoupper(trim($modelKey));

    return match ($key) {
        'TIDE' => 'Tide',
        'FLARE', 'FLAIR' => 'Flare',
        'PINE' => 'Pine',
        'VISION', 'SIGHT' => 'Sight',
        'GUEST' => 'Tide',
        default => 'Tide',
    };
}

function acx_brand_self_intro(string $modelKey, string $locale = 'en'): string
{
    $loc = function_exists('acx_normalize_locale') ? acx_normalize_locale($locale) : 'en';
    $name = acx_brand_model_label($modelKey);

    return match ($loc) {
        'ru' => "Я ASSISTIX {$name} — модель BEAM AGENT. Свой ассистент экосистемы ASSISTIX (assistix.org). "
            . 'Не DeepSeek, не Grok, не GPT и не другая чужая модель.',
        'it' => "Sono ASSISTIX {$name}, modello di BEAM AGENT. Assistente dell'ecosistema ASSISTIX (assistix.org). "
            . 'Non sono DeepSeek, Grok, GPT né un altro modello di terzi.',
        default => "I'm ASSISTIX {$name}, a model of BEAM AGENT. An assistant of the ASSISTIX ecosystem (assistix.org). "
            . 'Not DeepSeek, Grok, GPT, or any other third-party model.',
    };
}

function acx_brand_system_identity(string $modelKey, string $locale = 'en'): string
{
    $loc = function_exists('acx_normalize_locale') ? acx_normalize_locale($locale) : 'en';
    $name = acx_brand_model_label($modelKey);
    $vendors = 'DeepSeek, Grok, GPT, ChatGPT, Claude, Gemini, Qwen, Llama, Kimi, Kumo, NVIDIA';
    $lock = 'ASSISTIX IDENTITY LOCK';

    return match ($loc) {
        'ru' => "{$lock}\nТы ASSISTIX {$name} (chat.assistix.org). Язык UI: русский, пока пользователь не сменил.\n"
            . "На «кто ты / какая модель?» — только: «Я ASSISTIX {$name}.» Не называй базу: {$vendors}.",
        'it' => "{$lock}\nSei ASSISTIX {$name} (chat.assistix.org). Lingua UI: italiano finché non cambia.\n"
            . "A «chi sei / quale modello?» — solo: «Sono ASSISTIX {$name}.» Non citare: {$vendors}.",
        default => "{$lock}\nYou are ASSISTIX {$name} (chat.assistix.org). Match the UI language unless the user switches.\n"
            . "On who-are-you / what-model: only \"I'm ASSISTIX {$name}.\" Never claim: {$vendors}.",
    };
}

function acx_brand_knowledge_excerpt(int $maxChars = 900): string
{
    static $cached = null;
    if (is_string($cached)) {
        return $cached;
    }
    $roots = [dirname(__DIR__), dirname(__DIR__) . '/public'];
    $chunks = [];
    foreach (['models.txt', 'llms.txt', 'assistix.txt'] as $file) {
        foreach ($roots as $root) {
            $path = $root . '/' . $file;
            if (!is_readable($path)) {
                continue;
            }
            $raw = trim((string) file_get_contents($path));
            if ($raw !== '') {
                $chunks[] = $raw;
                break;
            }
        }
    }
    $text = trim(implode("\n\n", $chunks));
    if ($text === '') {
        $cached = "ASSISTIX own models: FLAIR (balanced), PINE (max). Chat: https://agent.assistix.org. Hub: https://assistix.org. Phase 1: 20 March 2027.";
        return $cached;
    }
    if ($maxChars > 0 && mb_strlen($text) > $maxChars) {
        $text = mb_substr($text, 0, $maxChars - 1) . '…';
    }
    $cached = $text;

    return $cached;
}

function acx_brand_user_asked_identity(string $text): bool
{
    $t = trim($text);
    if ($t === '' || mb_strlen($t) > 220) {
        return false;
    }
    $n = mb_strtolower($t);
    if (preg_match('/сравн|compare|vs\.?|против|лучше ли|чем лучше|разниц/u', $n)) {
        return false;
    }

    return (bool) preg_match(
        '/^(кто\s+(ты|вы)|ты\s+кто|кто\s+такие|что\s+ты\s+такое|представься|представишься'
        . '|какая\s+(ты\s+)?модель|какой\s+ты\s+модели|на\s+чём\s+ты\s+работа'
        . '|who\s+are\s+you|what\s+are\s+you|what\s+model|which\s+model|tell\s+me\s+who\s+you'
        . '|chi\s+sei|che\s+modello'
        . '|ты\s+(дипсик|deepseek|грок|grok|chatgpt|gpt|claude|gemini|qwen)'
        . '|are\s+you\s+(a\s+)?(deepseek|grok|gpt|chatgpt|claude|gemini|qwen|llama)'
        . '|you\s+are\s+(deepseek|grok|chatgpt))/iu',
        $n
    );
}

function acx_brand_looks_like_vendor_intro(string $text): bool
{
    $t = trim(preg_replace('/\s+/u', ' ', strip_tags($text)) ?? '');
    if ($t === '' || mb_strlen($t) > 280) {
        return false;
    }

    return (bool) preg_match(
        '/deep\s*seek|грок|grok|chatgpt|openai|claude|gemini|qwen|llama|kimi|kumo|nvidia\s*nim/iu',
        $t
    ) && (bool) preg_match(
        '/\b(i(?:\'m| am)|я|sono|an ai assistant|made by|создан|разработан|powered by|модель от)\b/iu',
        $t
    );
}

function acx_brand_replace_vendor_tokens(string $text, string $modelKey): string
{
    $name = 'ASSISTIX ' . acx_brand_model_label($modelKey);
    $pairs = [
        '/deepseek-v4-flash/iu' => $name,
        '/deepseek-v3[^\s,]*/iu' => $name,
        '/xai\/grok-[0-9.]+/iu' => $name,
        '/google\/gemini[^\s,]*/iu' => $name,
        '/qwen3[^\s,]*/iu' => $name,
        '/kumorouter|kumo router/iu' => 'ASSISTIX',
        '/powered by\s+(deepseek|grok|openai|anthropic|google|xai|qwen|kumo|nvidia)[^\n.]*/iu' => 'ASSISTIX',
        '/an AI assistant made by\s+DeepSeek/iu' => 'an ASSISTIX assistant',
        '/AI assistant made by\s+DeepSeek/iu' => 'ASSISTIX assistant',
        '/I(?:\'m| am)\s+(?:an?\s+)?(?:AI\s+)?(?:assistant\s+)?(?:called\s+)?DeepSeek/iu' => "I'm {$name}",
        '/DeepSeek,\s*an AI assistant[^.]*\.?/iu' => $name . '.',
        '/Я\s+(?:—|-)?\s*DeepSeek[^.!]*/iu' => 'Я ' . $name,
        '/меня зовут\s+DeepSeek/iu' => 'меня зовут ' . $name,
        '/Sono\s+DeepSeek/iu' => 'Sono ' . $name,
    ];
    foreach ($pairs as $re => $to) {
        $text = preg_replace($re, $to, $text) ?? $text;
    }

    return $text;
}

function acx_brand_sanitize_output(string $text, string $modelKey = 'FLAIR', string $locale = 'en', string $userContext = ''): string
{
    $text = trim($text);
    if ($text === '') {
        return '';
    }
    if (acx_brand_looks_like_vendor_intro($text) || (acx_brand_user_asked_identity($userContext) && acx_brand_looks_like_vendor_intro($text))) {
        return acx_brand_self_intro($modelKey, $locale);
    }
    $rewritten = acx_brand_replace_vendor_tokens($text, $modelKey);
    if (acx_brand_user_asked_identity($userContext) && acx_brand_looks_like_vendor_intro($rewritten)) {
        return acx_brand_self_intro($modelKey, $locale);
    }
    if (acx_brand_user_asked_identity($userContext)) {
        foreach (acx_brand_vendor_names() as $vendor) {
            if ($vendor === '') {
                continue;
            }
            $rewritten = preg_replace('/\b' . preg_quote($vendor, '/') . '\b/u', 'ASSISTIX ' . acx_brand_model_label($modelKey), $rewritten) ?? $rewritten;
        }
        if (acx_brand_looks_like_vendor_intro($rewritten) || !preg_match('/ASSISTIX/i', $rewritten)) {
            return acx_brand_self_intro($modelKey, $locale);
        }
    }

    return $rewritten;
}

function acx_brand_try_local_identity(string $userText, string $modelKey, string $locale = 'en'): ?string
{
    if (!acx_brand_user_asked_identity($userText)) {
        return null;
    }

    return acx_brand_self_intro($modelKey, $locale);
}

/**
 * @param list<string> $extraHeaders
 */
function acx_brand_stream_local_reply(string $text, array $extraHeaders = []): void
{
    foreach ($extraHeaders as $h) {
        if (is_string($h) && $h !== '') {
            header($h);
        }
    }
    if (function_exists('acx_stream_sse_begin')) {
        acx_stream_sse_begin();
    } else {
        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache, no-store');
        header('X-Accel-Buffering: no');
    }
    $len = mb_strlen($text);
    $step = 32;
    for ($o = 0; $o < $len; $o += $step) {
        if (function_exists('acx_stream_client_gone') && acx_stream_client_gone()) {
            return;
        }
        if (function_exists('acx_chat_emit_delta')) {
            acx_chat_emit_delta(mb_substr($text, $o, $step));
        }
    }
    echo "data: [DONE]\n\n";
    if (function_exists('flush')) {
        @flush();
    }
}
