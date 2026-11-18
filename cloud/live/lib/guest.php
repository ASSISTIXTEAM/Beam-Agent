<?php
declare(strict_types=1);

/**
 * Состояние демо-чата в сессии (возврат по ссылке — изменения сохраняются в $_SESSION).
 *
 * @return array<string, mixed>
 */
function &acx_guest_state(): array
{
    if (empty($_SESSION['acx_guest']) || !is_array($_SESSION['acx_guest'])) {
        $_SESSION['acx_guest'] = [
            'day' => gmdate('Y-m-d'),
            'daily_user_msgs' => 0,
            'conversations' => [],
        ];
    }
    $g = &$_SESSION['acx_guest'];
    $today = gmdate('Y-m-d');
    if (($g['day'] ?? '') !== $today) {
        $g['day'] = $today;
        $g['daily_user_msgs'] = 0;
    }
    return $g;
}

function acx_guest_new_local_id(): string
{
    return 'g_' . bin2hex(random_bytes(8));
}

/** @param array<string, mixed> $g */
function acx_guest_find_conv(array &$g, string $localId): ?int
{
    foreach ($g['conversations'] as $i => $c) {
        if (($c['local_id'] ?? '') === $localId) {
            return (int) $i;
        }
    }
    return null;
}
