<?php
session_start();

// Simple admin auth (можно заменить на проверку БД)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    
    if ($username === 'admin' && $password === 'admin') {
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_username'] = $username;
        header('Location: /admin/index.php');
        exit;
    } else {
        $error = 'Invalid credentials';
    }
}

// If already logged in, redirect to dashboard
if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
    header('Location: /admin/index.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - ASSISTIX</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Gilroy', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .login-container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            border-radius: 30px;
            padding: 50px;
            width: 100%;
            max-width: 450px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .logo-icon {
            font-size: 64px;
            margin-bottom: 15px;
        }
        
        h1 {
            color: white;
            font-size: 32px;
            text-align: center;
            margin-bottom: 10px;
        }
        
        .subtitle {
            color: rgba(255, 255, 255, 0.7);
            text-align: center;
            font-size: 14px;
            margin-bottom: 40px;
        }
        
        .form-group {
            margin-bottom: 25px;
        }
        
        label {
            display: block;
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        input {
            width: 100%;
            padding: 15px 20px;
            background: rgba(255, 255, 255, 0.15);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 12px;
            color: white;
            font-size: 15px;
            transition: all 0.3s;
        }
        
        input::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }
        
        input:focus {
            outline: none;
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.5);
        }
        
        .login-btn {
            width: 100%;
            padding: 15px;
            background: white;
            color: #667eea;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            margin-top: 10px;
        }
        
        .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(255, 255, 255, 0.3);
        }
        
        .error {
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid rgba(239, 68, 68, 0.5);
            color: #fca5a5;
            padding: 12px 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 14px;
            text-align: center;
        }
        
        .info {
            background: rgba(59, 130, 246, 0.2);
            border: 1px solid rgba(59, 130, 246, 0.5);
            color: #93c5fd;
            padding: 15px 20px;
            border-radius: 10px;
            margin-top: 20px;
            font-size: 13px;
            text-align: center;
        }
        
        .back-link {
            text-align: center;
            margin-top: 25px;
        }
        
        .back-link a {
            color: rgba(255, 255, 255, 0.8);
            text-decoration: none;
            font-size: 14px;
            transition: color 0.3s;
        }
        
        .back-link a:hover {
            color: white;
        }
        
        @media (max-width: 480px) {
            .login-container {
                padding: 30px;
            }
            
            h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <div class="logo-icon">🔐</div>
            <h1>ASSISTIX Admin</h1>
            <div class="subtitle">Administration Panel</div>
        </div>
        
        <?php if (isset($error)): ?>
            <div class="error">❌ <?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        
        <form method="POST">
            <div class="form-group">
                <label for="username">👤 Username</label>
                <input type="text" id="username" name="username" placeholder="Enter username" required autofocus>
            </div>
            
            <div class="form-group">
                <label for="password">🔑 Password</label>
                <input type="password" id="password" name="password" placeholder="Enter password" required>
            </div>
            
            <button type="submit" class="login-btn">🚀 Login to Admin Panel</button>
        </form>
        
        <div class="info">
            💡 Default credentials:<br>
            Username: <strong>admin</strong><br>
            Password: <strong>admin</strong>
        </div>
        
        <div class="back-link">
            <a href="/chat_updated.php">← Back to Chat</a>
        </div>
    </div>
</body>
</html>
