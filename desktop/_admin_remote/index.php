<?php
session_start();
require __DIR__ . '/auth_check.php';
$display = htmlspecialchars($_SESSION['admin_display'] ?? $_SESSION['admin_username'] ?? 'Ops');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ASSISTIX Control</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/admin/assets/admin.css?v=5" />
  <link rel="icon" type="image/svg+xml" href="/admin/assets/assistix-mark.svg" />
</head>
<body>
  <div class="app">
    <aside class="rail">
      <div class="rail-brand">
        <img class="rail-logo" src="/admin/assets/assistix-mark.svg" width="42" height="42" alt="ASSISTIX" />
        <div>
          <strong>ASSISTIX</strong>
          <span>Control</span>
        </div>
      </div>
      <nav class="rail-nav" id="nav">
        <button data-view="overview" class="active">Обзор</button>
        <button data-view="users">Пользователи</button>
        <button data-view="chats">Чаты</button>
        <button data-view="requests">Запросы API</button>
        <button data-view="reports">Репорты / Feedback</button>
        <button data-view="logs">Системные логи</button>
        <button data-view="security">Безопасность</button>
        <button data-view="database">База данных</button>
        <button data-view="search">Глобальный поиск</button>
        <button data-view="settings">Настройки</button>
      </nav>
      <div class="rail-foot">
        <div class="who">
          <div class="avatar"><?= mb_substr($display, 0, 1) ?></div>
          <div>
            <strong><?= $display ?></strong>
            <span>полный доступ</span>
          </div>
        </div>
        <a class="logout" href="/admin/logout.php">Выйти</a>
      </div>
    </aside>

    <main class="stage">
      <header class="top">
        <div>
          <h1 id="title">Обзор</h1>
          <p id="subtitle">Контроль всей экосистемы ASSISTIX и Beam</p>
        </div>
        <div class="top-actions">
          <div class="searchbox">
            <input id="globalQ" placeholder="Быстрый поиск…" />
            <button id="globalGo" type="button">Найти</button>
          </div>
          <a class="ghost" href="https://assistix.org/" target="_blank" rel="noopener">Сайт</a>
          <a class="ghost" href="https://chat.assistix.org/" target="_blank" rel="noopener">Chat</a>
          <a class="ghost" href="https://agent.assistix.org/" target="_blank" rel="noopener">Beam</a>
        </div>
      </header>
      <section id="view" class="view"></section>
    </main>
  </div>

  <div id="drawer" class="drawer" hidden>
    <div class="drawer-panel">
      <header>
        <h2 id="drawerTitle">Детали</h2>
        <button type="button" id="drawerClose">Закрыть</button>
      </header>
      <div id="drawerBody"></div>
    </div>
  </div>

  <script src="/admin/assets/admin.js?v=5"></script>
</body>
</html>
