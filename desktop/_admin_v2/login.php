<?php
session_start();
$creds = require __DIR__ . '/credentials.php';

if (!empty($_SESSION['admin_logged_in'])) {
    header('Location: /admin/');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim((string)($_POST['username'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    $okUser = hash_equals((string)$creds['username'], $username);
    $okPass = password_verify($password, (string)$creds['password_hash']);
    if ($okUser && $okPass) {
        session_regenerate_id(true);
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_username'] = $creds['username'];
        $_SESSION['admin_display'] = $creds['display_name'] ?? $creds['username'];
        $_SESSION['admin_login_at'] = date('c');
        header('Location: /admin/');
        exit;
    }
    $error = 'Неверный логин или пароль';
    usleep(350000);
}
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
  <style>
    :root {
      --ink: #1a1228;
      --muted: #6b6280;
      --line: rgba(124, 58, 237, 0.14);
      --violet: #7c3aed;
      --magenta: #c026d3;
      --soft: #f7f3ff;
      --card: rgba(255,255,255,0.78);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      font-family: Manrope, system-ui, sans-serif;
      color: var(--ink);
      background:
        radial-gradient(900px 500px at 12% -10%, rgba(192,38,211,.22), transparent 55%),
        radial-gradient(800px 480px at 95% 0%, rgba(124,58,237,.28), transparent 50%),
        linear-gradient(180deg, #fbf8ff 0%, #f3ecff 48%, #efe7ff 100%);
      display: grid;
      place-items: center;
      padding: 24px;
    }
    body::before {
      content: "ASSISTIX";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: .035;
      font-family: Sora, sans-serif;
      font-weight: 700;
      font-size: clamp(64px, 14vw, 180px);
      letter-spacing: -.06em;
      display: grid;
      place-items: center;
      transform: rotate(-8deg);
    }
    .shell {
      width: min(440px, 100%);
      position: relative;
      z-index: 1;
      animation: rise .55s ease both;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(14px); }
      to { opacity: 1; transform: none; }
    }
    .brand {
      text-align: center;
      margin-bottom: 22px;
    }
    .mark {
      width: 56px; height: 56px; margin: 0 auto 14px;
      border-radius: 16px;
      background: linear-gradient(135deg, var(--violet), var(--magenta));
      box-shadow: 0 16px 40px rgba(124,58,237,.35);
      display: grid; place-items: center;
      color: #fff; font-family: Sora, sans-serif; font-weight: 700; font-size: 22px;
    }
    .brand h1 {
      font-family: Sora, sans-serif;
      font-size: 28px;
      letter-spacing: -.04em;
      background: linear-gradient(120deg, #5b21b6, #c026d3);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .brand p { color: var(--muted); margin-top: 6px; font-size: 14px; }
    .card {
      background: var(--card);
      backdrop-filter: blur(18px);
      border: 1px solid var(--line);
      border-radius: 28px;
      padding: 28px;
      box-shadow: 0 30px 80px rgba(88, 28, 135, .12);
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .field { margin-bottom: 16px; }
    input {
      width: 100%;
      border: 1px solid rgba(124,58,237,.18);
      background: #fff;
      border-radius: 14px;
      padding: 14px 16px;
      font: 500 15px/1.2 Manrope, sans-serif;
      color: var(--ink);
      outline: none;
      transition: border-color .2s, box-shadow .2s;
    }
    input:focus {
      border-color: rgba(124,58,237,.55);
      box-shadow: 0 0 0 4px rgba(124,58,237,.12);
    }
    .error {
      background: #fff1f2;
      color: #be123c;
      border: 1px solid #fecdd3;
      border-radius: 12px;
      padding: 10px 12px;
      font-size: 13px;
      margin-bottom: 14px;
    }
    button {
      width: 100%;
      border: 0;
      border-radius: 999px;
      padding: 14px 18px;
      margin-top: 6px;
      font: 700 15px/1 Sora, sans-serif;
      color: #fff;
      cursor: pointer;
      background: linear-gradient(120deg, var(--violet), var(--magenta));
      box-shadow: 0 14px 30px rgba(124,58,237,.28);
      transition: transform .15s ease, filter .15s ease;
    }
    button:hover { filter: brightness(1.05); transform: translateY(-1px); }
    .foot {
      margin-top: 16px;
      text-align: center;
      font-size: 13px;
      color: var(--muted);
    }
    .foot a { color: var(--violet); text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="brand">
      <div class="mark">A</div>
      <h1>ASSISTIX Control</h1>
      <p>Панель управления экосистемой и Beam</p>
    </div>
    <form class="card" method="post" autocomplete="username">
      <?php if ($error): ?><div class="error"><?= htmlspecialchars($error) ?></div><?php endif; ?>
      <div class="field">
        <label for="username">Логин</label>
        <input id="username" name="username" required autofocus placeholder="beam.ops" />
      </div>
      <div class="field">
        <label for="password">Пароль</label>
        <input id="password" name="password" type="password" required placeholder="••••••••••••" />
      </div>
      <button type="submit">Войти в панель</button>
      <div class="foot"><a href="https://assistix.org/">← На сайт ASSISTIX</a></div>
    </form>
  </div>
</body>
</html>
