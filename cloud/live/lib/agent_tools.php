<?php
declare(strict_types=1);

require_once __DIR__ . '/agent_sandbox.php';
require_once __DIR__ . '/search.php';

/**
 * Beam Agent tool registry.
 */

function acx_agent_tool_specs(string $locale = 'ru'): array
{
    $loc = function_exists('acx_normalize_locale') ? acx_normalize_locale($locale) : 'en';
    if ($loc === 'ru') {
        return [
            'web_search' => 'Поиск в интернете. args: {q: string, limit?: number}',
            'web_fetch' => 'Скачать текст страницы. args: {url: string}',
            'http_request' => 'HTTP запрос (GET/POST). args: {url, method?, headers?, body?, json?}',
            'python' => 'Выполнить Python в ASSISTIX Environment. args: {code: string}',
            'shell' => 'Команда в workspace (whitelist). args: {command: string}',
            'fs_list' => 'Список файлов workspace. args: {path?: string}',
            'fs_read' => 'Прочитать файл. args: {path: string}',
            'fs_write' => 'Записать файл. args: {path: string, content: string}',
            'subagent' => 'Субагент на узкую подзадачу. args: {goal: string, context?: string}',
            'code_handoff' => 'Подготовить workspace к передаче в ASSISTIX CODE. args: {}',
            'finish' => 'Завершить и отдать итоговый ответ пользователю. args: {summary: string}',
        ];
    }

    return [
        'web_search' => 'Web search. args: {q: string, limit?: number}',
        'web_fetch' => 'Fetch page text. args: {url: string}',
        'http_request' => 'HTTP request. args: {url, method?, headers?, body?, json?}',
        'python' => 'Run Python in ASSISTIX Environment. args: {code: string}',
        'shell' => 'Shell in workspace (whitelist). args: {command: string}',
        'fs_list' => 'List workspace files. args: {path?: string}',
        'fs_read' => 'Read file. args: {path: string}',
        'fs_write' => 'Write file. args: {path: string, content: string}',
        'subagent' => 'Spawn focused subagent. args: {goal: string, context?: string}',
        'code_handoff' => 'Prepare workspace for ASSISTIX CODE handoff. args: {}',
        'finish' => 'Finish and give the user the final answer. args: {summary: string}',
    ];
}

function acx_agent_ssrf_blocked(string $url): bool
{
    $host = parse_url($url, PHP_URL_HOST);
    if (!is_string($host) || $host === '') {
        return true;
    }
    $host = strtolower($host);
    if (in_array($host, ['localhost', '127.0.0.1', '0.0.0.0', '::1'], true)) {
        return true;
    }
    if (preg_match('/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/', $host)) {
        return true;
    }
    $ip = gethostbyname($host);
    if ($ip && $ip !== $host) {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return true;
        }
    }

    return false;
}

/**
 * @param array<string,mixed> $args
 * @param array<string,mixed> $ctx user_id, job_id, locale, depth
 * @return array<string,mixed>
 */
function acx_agent_tool_run(string $name, array $args, array $ctx): array
{
    $userId = (int) ($ctx['user_id'] ?? 0);
    $jobId = (string) ($ctx['job_id'] ?? 'job');
    $locale = (string) ($ctx['locale'] ?? 'ru');
    $depth = (int) ($ctx['depth'] ?? 0);

    switch ($name) {
        case 'web_search':
            $q = trim((string) ($args['q'] ?? ''));
            $limit = max(1, min(6, (int) ($args['limit'] ?? 4)));
            if ($q === '') {
                return ['ok' => false, 'error' => 'empty_query'];
            }
            $rich = acx_search_rich_context($q, $locale, false);
            $sources = array_slice($rich['sources'] ?? [], 0, $limit);

            return ['ok' => true, 'sources' => $sources];

        case 'web_fetch':
            $url = trim((string) ($args['url'] ?? ''));
            if ($url === '' || !preg_match('~^https?://~i', $url) || acx_agent_ssrf_blocked($url)) {
                return ['ok' => false, 'error' => 'bad_or_blocked_url'];
            }
            $res = acx_search_curl($url, [
                CURLOPT_TIMEOUT => 12,
                CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'],
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 4,
            ]);
            if (($res['code'] ?? 0) < 200 || ($res['code'] ?? 0) >= 400) {
                return ['ok' => false, 'error' => 'http_' . ($res['code'] ?? 0), 'body' => mb_substr((string) ($res['body'] ?? ''), 0, 500)];
            }
            $body = (string) ($res['body'] ?? '');
            $ct = (string) ($res['content_type'] ?? '');
            if (stripos($ct, 'json') !== false || str_starts_with(ltrim($body), '{') || str_starts_with(ltrim($body), '[')) {
                return ['ok' => true, 'url' => $url, 'type' => 'json', 'text' => mb_substr($body, 0, 14000)];
            }
            $text = html_entity_decode(strip_tags(preg_replace('/<(script|style)\b[^>]*>.*?<\/\1>/is', ' ', $body) ?? $body), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');

            return ['ok' => true, 'url' => $url, 'type' => 'html', 'text' => mb_substr($text, 0, 14000)];

        case 'http_request':
            $url = trim((string) ($args['url'] ?? ''));
            $method = strtoupper((string) ($args['method'] ?? 'GET'));
            if ($url === '' || !preg_match('~^https?://~i', $url) || acx_agent_ssrf_blocked($url)) {
                return ['ok' => false, 'error' => 'bad_or_blocked_url'];
            }
            if (!in_array($method, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'], true)) {
                return ['ok' => false, 'error' => 'bad_method'];
            }
            $headers = [];
            if (!empty($args['headers']) && is_array($args['headers'])) {
                foreach ($args['headers'] as $k => $v) {
                    $headers[] = $k . ': ' . $v;
                }
            }
            $body = null;
            if (array_key_exists('json', $args)) {
                $body = json_encode($args['json'], JSON_UNESCAPED_UNICODE);
                $headers[] = 'Content-Type: application/json';
            } elseif (isset($args['body'])) {
                $body = (string) $args['body'];
            }
            $opts = [
                CURLOPT_TIMEOUT => 20,
                CURLOPT_CUSTOMREQUEST => $method,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 3,
            ];
            if ($body !== null && $method !== 'GET' && $method !== 'HEAD') {
                $opts[CURLOPT_POSTFIELDS] = $body;
            }
            $res = acx_search_curl($url, $opts);

            return [
                'ok' => ($res['code'] ?? 0) >= 200 && ($res['code'] ?? 0) < 400,
                'status' => (int) ($res['code'] ?? 0),
                'body' => mb_substr((string) ($res['body'] ?? ''), 0, 14000),
            ];

        case 'python':
            $code = (string) ($args['code'] ?? '');
            if (trim($code) === '') {
                return ['ok' => false, 'error' => 'empty_code'];
            }
            $res = acx_agent_python_exec($userId, $jobId, $code, 25);

            return [
                'ok' => !empty($res['ok']),
                'stdout' => $res['stdout'] ?? '',
                'stderr' => $res['stderr'] ?? '',
                'code' => $res['code'] ?? -1,
                'timed_out' => !empty($res['timed_out']),
            ];

        case 'shell':
            $cmd = (string) ($args['command'] ?? '');
            $res = acx_agent_shell_exec($userId, $jobId, $cmd, 20);

            return [
                'ok' => !empty($res['ok']),
                'stdout' => $res['stdout'] ?? '',
                'stderr' => $res['stderr'] ?? '',
                'code' => $res['code'] ?? -1,
                'timed_out' => !empty($res['timed_out']),
            ];

        case 'fs_list':
            return [
                'ok' => true,
                'files' => acx_agent_fs_list($userId, $jobId, (string) ($args['path'] ?? '.')),
            ];

        case 'fs_read':
            return acx_agent_fs_read($userId, $jobId, (string) ($args['path'] ?? ''));

        case 'fs_write':
            return acx_agent_fs_write(
                $userId,
                $jobId,
                (string) ($args['path'] ?? ''),
                (string) ($args['content'] ?? '')
            );

        case 'subagent':
            if ($depth >= 1) {
                return ['ok' => false, 'error' => 'nested_subagents_blocked'];
            }
            require_once __DIR__ . '/agent.php';
            $goal = trim((string) ($args['goal'] ?? ''));
            if ($goal === '') {
                return ['ok' => false, 'error' => 'empty_goal'];
            }
            $report = acx_agent_run_subagent($goal, (string) ($args['context'] ?? ''), $ctx);

            return ['ok' => true, 'report' => $report];

        case 'finish':
            return [
                'ok' => true,
                'finished' => true,
                'summary' => (string) ($args['summary'] ?? ''),
            ];

        case 'code_handoff':
            // Future ASSISTIX CODE integration hook
            return [
                'ok' => true,
                'status' => 'queued_for_assistix_code',
                'message' => $locale === 'ru'
                    ? 'Workspace подготовлен к передаче в ASSISTIX CODE (скоро). Файлы сохранены в Environment.'
                    : 'Workspace prepared for ASSISTIX CODE handoff (coming soon). Files stay in Environment.',
                'files' => acx_agent_fs_list($userId, $jobId, '.', 30),
            ];

        default:
            return ['ok' => false, 'error' => 'unknown_tool'];
    }
}

/**
 * Native OpenAI-style tool definitions (Kumo / OpenAI-compatible `tools` array).
 *
 * @return list<array{type:string,function:array{name:string,description:string,parameters:array}}>
 */
function acx_agent_tool_definitions(string $locale = 'en'): array
{
    $ru = (function_exists('acx_normalize_locale') ? acx_normalize_locale($locale) : 'en') === 'ru';
    $t = static function (string $en, string $ruText) use ($ru): string {
        return $ru ? $ruText : $en;
    };
    $obj = static function (array $props, array $required = []): array {
        $schema = ['type' => 'object', 'properties' => $props];
        if ($required !== []) {
            $schema['required'] = $required;
        }
        $schema['additionalProperties'] = false;

        return $schema;
    };
    $str = static fn (string $d): array => ['type' => 'string', 'description' => $d];

    return [
        [
            'type' => 'function',
            'function' => [
                'name' => 'fs_write',
                'description' => $t('Write a file inside the workspace. Use several calls for large files instead of one huge one.', 'Записать файл в workspace. Большие файлы — несколькими вызовами, а не одним огромным.'),
                'parameters' => $obj([
                    'path' => $str($t('Relative path, e.g. src/app.php', 'Относительный путь, например src/app.php')),
                    'content' => $str($t('Full file content', 'Полное содержимое файла')),
                ], ['path', 'content']),
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'fs_read',
                'description' => $t('Read a workspace file.', 'Прочитать файл в workspace.'),
                'parameters' => $obj([
                    'path' => $str($t('Relative path', 'Относительный путь')),
                ], ['path']),
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'fs_list',
                'description' => $t('List workspace files.', 'Список файлов workspace.'),
                'parameters' => $obj([
                    'path' => $str($t('Directory, default "."', 'Каталог, по умолчанию "."')),
                ]),
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'shell',
                'description' => $t('Run one whitelisted shell command inside the workspace (php -l, grep, ls, python3, ...). Pipe allowed.', 'Одна команда из whitelist внутри workspace (php -l, grep, ls, python3, ...). Пайпы разрешены.'),
                'parameters' => $obj([
                    'command' => $str($t('Command line', 'Строка команды')),
                ], ['command']),
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'python',
                'description' => $t('Run Python 3 code in the workspace.', 'Выполнить Python 3 в workspace.'),
                'parameters' => $obj([
                    'code' => $str($t('Python source', 'Исходник Python')),
                ], ['code']),
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'web_search',
                'description' => $t('Search the web and get sources with snippets.', 'Поиск в интернете, источники с фрагментами.'),
                'parameters' => $obj([
                    'q' => $str($t('Query', 'Запрос')),
                    'limit' => ['type' => 'integer', 'description' => $t('1-6 results', '1-6 результатов')],
                ], ['q']),
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'web_fetch',
                'description' => $t('Fetch a page and return its text.', 'Скачать страницу и вернуть текст.'),
                'parameters' => $obj([
                    'url' => $str($t('Absolute http(s) URL', 'Абсолютный http(s) URL')),
                ], ['url']),
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'http_request',
                'description' => $t('Raw HTTP request to an API endpoint.', 'HTTP-запрос к API.'),
                'parameters' => $obj([
                    'url' => $str('URL'),
                    'method' => $str($t('GET/POST/PUT/PATCH/DELETE', 'GET/POST/PUT/PATCH/DELETE')),
                    'headers' => ['type' => 'object', 'description' => $t('Header map', 'Заголовки')],
                    'body' => $str($t('Raw body', 'Тело запроса')),
                    'json' => ['type' => 'object', 'description' => $t('JSON body', 'JSON-тело')],
                ], ['url']),
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'subagent',
                'description' => $t('Spawn a focused subagent for a narrow side task (runs on the cheap model).', 'Субагент на узкую подзадачу (на дешёвой модели).'),
                'parameters' => $obj([
                    'goal' => $str($t('What it must do', 'Что нужно сделать')),
                    'context' => $str($t('Optional context', 'Контекст, необязательно')),
                ], ['goal']),
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'code_handoff',
                'description' => $t('Mark the workspace as ready for ASSISTIX CODE.', 'Отметить workspace готовым для ASSISTIX CODE.'),
                'parameters' => $obj([]),
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name' => 'finish',
                'description' => $t('Finish the job and return the final user-facing report.', 'Завершить работу и вернуть итоговый отчёт пользователю.'),
                'parameters' => $obj([
                    'summary' => $str($t('Final markdown report', 'Итоговый отчёт в markdown')),
                ], ['summary']),
            ],
        ],
    ];
}
