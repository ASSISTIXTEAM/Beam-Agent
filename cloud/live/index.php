<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/rollout-gate.php';

// Same invite / beta gate as CHAT / SEARCH / A.DROP (Phase 1).
rollout_gate_enforce('chat');

header('Content-Type: text/html; charset=utf-8');
readfile(__DIR__ . '/index.html');
