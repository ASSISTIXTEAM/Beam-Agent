<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
if (empty($_SESSION['admin_logged_in'])) {
    if (str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json')
        || str_starts_with($_SERVER['REQUEST_URI'] ?? '', '/admin/api')) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'error' => 'unauthorized']);
        exit;
    }
    header('Location: /admin/login.php');
    exit;
}
