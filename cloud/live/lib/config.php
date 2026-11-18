<?php
declare(strict_types=1);

function acx_root(): string
{
    return dirname(__DIR__);
}

/** @return array<string,mixed> */
function acx_config(): array
{
    static $cached;
    if (is_array($cached)) {
        return $cached;
    }
    $root = acx_root();
    $local = $root . '/config.local.php';
    $example = $root . '/config.example.php';
    if (is_readable($local)) {
        $cfg = require $local;
    } elseif (is_readable($example)) {
        $cfg = require $example;
    } else {
        $cfg = [];
    }
    if (!is_array($cfg)) {
        $cfg = [];
    }
    $secret = (string) ($cfg['oauth']['client_secret'] ?? '');
    if ($secret === '') {
        $fromEnv = getenv('ASSISTIX_ID_CLIENT_SECRET_CHAT');
        if (is_string($fromEnv) && $fromEnv !== '') {
            $cfg['oauth']['client_secret'] = $fromEnv;
        }
    }
    if (($cfg['oauth']['client_secret'] ?? '') === '') {
        $idLocal = dirname($root) . DIRECTORY_SEPARATOR . 'id.assistix.org' . DIRECTORY_SEPARATOR . 'config.local.php';
        if (is_readable($idLocal)) {
            $idCfg = require $idLocal;
            if (is_array($idCfg) && isset($idCfg['clients']['assistix-chat']['secret'])) {
                $s = (string) $idCfg['clients']['assistix-chat']['secret'];
                if ($s !== '' && !str_starts_with($s, 'CHANGE_')) {
                    $cfg['oauth']['client_secret'] = $s;
                }
            }
        }
    }
    $kumoKey = (string) ($cfg['kumo']['api_key'] ?? '');
    if ($kumoKey === '') {
        foreach (['CHAT_KUMO_API_KEY', 'KUMO_API_KEY'] as $ev) {
            $e = getenv($ev);
            if (is_string($e) && $e !== '') {
                $cfg['kumo']['api_key'] = $e;
                break;
            }
        }
    }
    $nvKey = (string) ($cfg['nvidia']['api_key'] ?? '');
    if ($nvKey === '') {
        foreach (['CHAT_NVIDIA_API_KEY', 'NVIDIA_API_KEY'] as $ev) {
            $e = getenv($ev);
            if (is_string($e) && $e !== '') {
                $cfg['nvidia']['api_key'] = $e;
                break;
            }
        }
    }
    $ioKey = (string) ($cfg['ionet']['api_key'] ?? '');
    if ($ioKey === '') {
        $e = getenv('CHAT_IONET_API_KEY');
        if (is_string($e) && $e !== '') {
            $cfg['ionet']['api_key'] = $e;
        }
    }
    $cached = $cfg;
    return $cached;
}
