<?php
require '/var/www/u3354161/data/www/assistix.org/db.php';
$w = new DateTimeImmutable('now', new DateTimeZone('UTC'));
$dow = (int)$w->format('N');
$ws = $w->modify('-' . ($dow - 1) . ' days')->format('Y-m-d');
$legacy = $pdo->query(
    "SELECT COUNT(*) c FROM beam_weekly_usage WHERE week_start=" . $pdo->quote($ws)
    . " AND (tide_limit IN (500000,1000000) OR flare_limit IN (10000,100000) OR pine_limit IN (1000,50000))"
)->fetch(PDO::FETCH_ASSOC);
$sample = $pdo->query(
    "SELECT tide_limit, flare_limit, pine_limit, COUNT(*) c FROM beam_weekly_usage WHERE week_start="
    . $pdo->quote($ws) . " GROUP BY tide_limit, flare_limit, pine_limit ORDER BY c DESC LIMIT 10"
)->fetchAll(PDO::FETCH_ASSOC);
$migs = $pdo->query('SELECT id, applied_at FROM beam_quota_migrations ORDER BY applied_at')->fetchAll(PDO::FETCH_ASSOC);
$cols = $pdo->query("SHOW COLUMNS FROM beam_user_limits")->fetchAll(PDO::FETCH_ASSOC);
echo json_encode([
    'week' => $ws,
    'legacy_week_rows' => (int)$legacy['c'],
    'limit_distribution' => $sample,
    'migrations' => $migs,
    'user_limit_cols' => array_column($cols, 'Field'),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
