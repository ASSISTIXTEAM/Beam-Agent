<?php
declare(strict_types=1);

require_once __DIR__ . '/ai.php';

/**
 * Streaming-вызов с нативными tool_calls. Текст стримится в $onText (живое «думание»),
 * tool_calls аккумулируются по index и возвращаются целиком.
 *
 * @param list<array<string,mixed>> $messages
 * @param list<array<string,mixed>> $tools
 * @param list<string> $nvFallbackModels
 * @param callable(string):void|null $onText
 * @return array{content:string,tool_calls:list<array{id:string,name:string,arguments:string,args:array<string,mixed>|null}>,finish_reason:string,total_tokens?:int,error?:string}
 */
function acx_stream_complete_tools(
    array $messages,
    string $model,
    array $tools,
    int $maxTokens,
    float $temperature,
    array $nvFallbackModels = [],
    ?string $ionetFallbackModel = null,
    string $locale = 'en',
    ?callable $onText = null,
    int $timeoutSec = 0
): array {
    $cfg = acx_config();
    $ep = acx_primary_chat_endpoint();
    $key = $ep['key'];
    $url = $ep['url'];
    $strict = !empty($ep['strict']);
    $extraHeaders = $ep['headers'];

    $fail = static function (string $msg) use ($locale): array {
        return [
            'content' => '',
            'tool_calls' => [],
            'finish_reason' => '',
            'error' => acx_sanitize_public_error($msg, $locale),
        ];
    };

    if ($key === '') {
        return $fail('assistix_unconfigured');
    }
    if ($timeoutSec <= 0) {
        $timeoutSec = acx_api_timeout(false) + 45;
    }

    require_once __DIR__ . '/models.php';
    $chain = acx_filter_kumo_models(array_values(array_unique(array_filter(
        array_merge([trim($model)], $nvFallbackModels)
    ))));
    $lastErr = 'LLM: не удалось получить ответ';

    // Последний рубеж против 400 Request limit exceeded: тело не должно превышать ~0.7 МБ.
    $messages = acx_tools_payload_guard($messages);

    foreach ($chain as $tryModel) {
        $body = [
            'model' => $tryModel,
            'messages' => $strict ? acx_messages_strip_vision_to_text($messages) : $messages,
            'max_tokens' => $maxTokens,
            'temperature' => $temperature,
            'stream' => true,
            'tools' => $tools,
        ];
        if (!$strict) {
            $body['top_p'] = 1.0;
        }

        $payload = json_encode($body, JSON_UNESCAPED_UNICODE);
        $content = '';
        $finish = '';
        $buf = '';
        $rawHead = '';
        $tokens = null;
        $calls = [];
        $httpCode = 0;
        $gotBytes = 0;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => array_merge([
                'Content-Type: application/json',
                'Authorization: Bearer ' . $key,
                'Accept: text/event-stream',
            ], $extraHeaders),
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => $timeoutSec,
            CURLOPT_LOW_SPEED_LIMIT => 24,
            CURLOPT_LOW_SPEED_TIME => 40,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_WRITEFUNCTION => static function ($h, string $chunk) use (
                &$buf, &$content, &$finish, &$calls, &$tokens, &$httpCode, &$gotBytes, &$rawHead, $onText
            ): int {
                $gotBytes += strlen($chunk);
                if (strlen($rawHead) < 1200) {
                    $rawHead .= substr($chunk, 0, 1200 - strlen($rawHead));
                }
                $httpCode = (int) curl_getinfo($h, CURLINFO_HTTP_CODE);
                $buf .= $chunk;
                while (($pos = strpos($buf, "\n")) !== false) {
                    $line = rtrim(substr($buf, 0, $pos), "\r");
                    $buf = substr($buf, $pos + 1);
                    if ($line === '' || !str_starts_with($line, 'data:')) {
                        continue;
                    }
                    $data = trim(substr($line, 5));
                    if ($data === '' || $data === '[DONE]') {
                        continue;
                    }
                    $j = json_decode($data, true);
                    if (!is_array($j)) {
                        continue;
                    }
                    if (isset($j['usage']['total_tokens'])) {
                        $tokens = (int) $j['usage']['total_tokens'];
                    }
                    $choice = $j['choices'][0] ?? null;
                    if (!is_array($choice)) {
                        continue;
                    }
                    if (!empty($choice['finish_reason'])) {
                        $finish = (string) $choice['finish_reason'];
                    }
                    $delta = is_array($choice['delta'] ?? null) ? $choice['delta'] : [];
                    if (isset($delta['content']) && $delta['content'] !== '') {
                        $piece = (string) $delta['content'];
                        $content .= $piece;
                        if ($onText !== null) {
                            $onText($piece);
                        }
                    }
                    if (!empty($delta['tool_calls']) && is_array($delta['tool_calls'])) {
                        foreach ($delta['tool_calls'] as $piece) {
                            if (!is_array($piece)) {
                                continue;
                            }
                            $idx = (int) ($piece['index'] ?? 0);
                            if (!isset($calls[$idx])) {
                                $calls[$idx] = ['id' => '', 'name' => '', 'arguments' => ''];
                            }
                            if (!empty($piece['id'])) {
                                $calls[$idx]['id'] = (string) $piece['id'];
                            }
                            $fn = is_array($piece['function'] ?? null) ? $piece['function'] : [];
                            if (!empty($fn['name'])) {
                                $calls[$idx]['name'] .= (string) $fn['name'];
                            }
                            if (isset($fn['arguments']) && $fn['arguments'] !== '') {
                                $calls[$idx]['arguments'] .= (string) $fn['arguments'];
                            }
                        }
                    }
                }

                return strlen($chunk);
            },
        ]);
        acx_curl_apply_outbound_proxy($ch);
        acx_curl_apply_nvidia_tls($ch);
        curl_exec($ch);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($gotBytes === 0) {
            $lastErr = $curlErr !== '' ? 'network: ' . $curlErr : 'empty_stream_http_' . $httpCode;
            @file_put_contents(__DIR__ . '/../storage/_tools_dbg.log',
                date('c') . " model=$tryModel gotBytes=0 http=$httpCode curl=$curlErr\n", FILE_APPEND);
            continue;
        }

        $out = [];
        ksort($calls);
        foreach ($calls as $i => $c) {
            $name = trim((string) $c['name']);
            if ($name === '') {
                continue;
            }
            $decoded = json_decode((string) $c['arguments'], true);
            $out[] = [
                'id' => $c['id'] !== '' ? $c['id'] : 'call_' . $i . '_' . substr(md5($name . $c['arguments']), 0, 8),
                'name' => strtolower($name),
                'arguments' => (string) $c['arguments'],
                'args' => is_array($decoded) ? $decoded : null,
            ];
        }

        if ($out === [] && trim($content) === '') {
            $lastErr = 'empty_stream_content_http_' . $httpCode;
            continue;
        }

        $res = [
            'content' => $content,
            'tool_calls' => $out,
            'finish_reason' => $finish !== '' ? $finish : ($out !== [] ? 'tool_calls' : 'stop'),
        ];
        if ($tokens !== null) {
            $res['total_tokens'] = $tokens;
        }

        return $res;
    }

    return $fail($lastErr);
}
