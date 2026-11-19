<?php
/**
 * Скопируйте в config.local.php на сервере и заполните значения.
 * config.local.php не должен попадать в публичный репозиторий с секретами.
 */
return [
    /** Canonical public URL (for SEO, OG, share links). Example: https://agent.assistix.org */
    'app_base_url' => 'https://agent.assistix.org',
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'u3354161_assistix_chat',
        'user' => 'u3354161_assistix_chat',
        'pass' => 'CHANGE_ME_DB_PASSWORD',
        'charset' => 'utf8mb4',
    ],
    /** База A>ID для обмена OAuth code → JWT (тот же хост, что в экосистеме). */
    'id_base_url' => 'https://id.assistix.org',
    'oauth' => [
        'client_id' => 'assistix-chat',
        /** Лучше задать через getenv ASSISTIX_ID_CLIENT_SECRET_CHAT на хостинге. */
        'client_secret' => '',
    ],
    /**
     * Assistix LLM Hub (канон). Prefer over direct Kumo when service_key is set.
     * getenv ASSISTIX_CHAT_SERVICE_KEY — plaintext ax_sk_chat_… (hash lives on api.assistix.org).
     */
    'assistix_hub' => [
        'api_url' => 'https://api.assistix.org/v1/chat/completions',
        'service_key' => '',
    ],
    /**
     * Kumo Router — legacy direct LLM/image (OpenAI-compatible).
     * getenv CHAT_KUMO_API_KEY / KUMO_API_KEY или строка ниже. Ключ только на сервере.
     */
    'kumo' => [
        'api_key' => '',
        'api_url' => 'https://api.kumorouter.com/v1/chat/completions',
        'images_url' => 'https://api.kumorouter.com/v1/images/generations',
        'image_model' => 'qwen-image-3',
        'image_size' => '1024x1024',
        'vision_model' => 'qwen3-8-flash',
        'utility_model' => 'deepseek-v4-flash',
    ],
    /** Резерв: NVIDIA NIM / integrate API. */
    'nvidia' => [
        'api_url' => 'https://integrate.api.nvidia.com/v1/chat/completions',
        /** getenv CHAT_NVIDIA_API_KEY / NVIDIA_API_KEY или строка ниже. */
        'api_key' => '',
        /**
         * Если shared-хостинг получает HTTP 451 от NVIDIA — HTTP/SOCKS прокси в разрешённом регионе.
         * Пример: http://user:pass@eu-vps:3128  или  socks5://127.0.0.1:1080
         * Альтернатива: сменить api_url на свой nginx/Cloudflare relay.
         */
        'http_proxy' => '',
    ],
    /** Спец-коды: снимают лимиты на N дней (UTC). */
    'promo_codes' => [
        'FPRrNW4CPe' => ['tier' => 'unlimited', 'days' => 31],
    ],
    /** Резерв: io.net intelligence. По умолчанию выключен — основной провайдер NVIDIA. */
    'ionet' => [
        'enabled' => false,
        'api_url' => 'https://api.intelligence.io.solutions/api/v1/chat/completions',
        'api_key' => '',
    ],
    /**
     * Sight (vision): NVIDIA Llama 3.2 vision by default.
     * ionet_model — только если io.net реально поддерживает multimodal для вашего ключа.
     */
    'vision' => [
        'nvidia_model' => 'meta/llama-3.2-11b-vision-instruct',
        'ionet_model' => '',
        'nvidia_fallback_models' => [
            'meta/llama-3.2-11b-vision-instruct',
            'meta/llama-3.2-90b-vision-instruct',
        ],
    ],
    /** Лимиты зарегистрированных пользователей (неделя по UTC, понедельник). */
    'limits' => [
        'flair_weekly_tokens' => 500_000,
        'pine_weekly_tokens' => 160_000,
        'max_messages_per_minute' => 20,
        'min_interval_seconds' => 1,
        'images_per_day' => 5,
    ],
    /** Демо без регистрации (на сессию + календарный день). */
    'guest' => [
        'max_conversations' => 5,
        'max_user_messages_per_day' => 30,
        'max_messages_per_minute' => 6,
        'min_interval_seconds' => 2,
        'history_messages' => 12,
        'max_tokens' => 1500,
    ],
    /** Таймауты стриминга (секунды). На nginx также увеличьте proxy_read_timeout. */
    'stream' => [
        'timeout_chat' => 300,
        'timeout_thinking' => 600,
        'timeout_research' => 600,
        'keepalive_interval' => 25,
    ],
    /**
     * PDF: OpenDataLoader (https://github.com/opendataloader-project/opendataloader-pdf)
     * Требует Java 11+ и pip install opendataloader-pdf
     * Для OCR/таблиц/диаграмм: pip install "opendataloader-pdf[hybrid]" && opendataloader-pdf-hybrid --port 5002
     */
    'pdf_extractor' => [
        'enabled' => true,
        'mode' => 'auto',
        'python' => 'python',
        'hybrid_url' => 'http://127.0.0.1:5002',
        'timeout_sec' => 300,
    ],
];
