<?php
session_start();
require 'auth_check.php';
require '../db.php';

// Get quick stats
try {
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM users");
    $totalUsers = $stmt->fetch()['total'];
    
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM conversations");
    $totalChats = $stmt->fetch()['total'];
    
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM messages");
    $totalMessages = $stmt->fetch()['total'];
} catch (Exception $e) {
    $totalUsers = $totalChats = $totalMessages = 0;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel - ASSISTIX</title>
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
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 30px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
        }
        
        .header-left h1 {
            color: white;
            font-size: 32px;
            margin-bottom: 5px;
        }
        
        .header-left p {
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
        }
        
        .header-right {
            display: flex;
            gap: 10px;
        }
        
        .logout-btn {
            padding: 10px 20px;
            background: rgba(239, 68, 68, 0.3);
            border: 1px solid rgba(239, 68, 68, 0.5);
            border-radius: 10px;
            color: white;
            text-decoration: none;
            transition: all 0.3s;
            font-size: 14px;
        }
        
        .logout-btn:hover {
            background: rgba(239, 68, 68, 0.5);
            transform: translateY(-2px);
        }
        
        .chat-btn {
            padding: 10px 20px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            color: white;
            text-decoration: none;
            transition: all 0.3s;
            font-size: 14px;
        }
        
        .chat-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
        
        .quick-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-box {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center;
        }
        
        .stat-icon {
            font-size: 32px;
            margin-bottom: 10px;
        }
        
        .stat-value {
            color: white;
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .stat-label {
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
        }
        
        .modules-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }
        
        .module-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s;
            cursor: pointer;
            text-decoration: none;
            display: block;
        }
        
        .module-card:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.15);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.3);
        }
        
        .module-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        
        .module-title {
            color: white;
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .module-desc {
            color: rgba(255, 255, 255, 0.7);
            font-size: 14px;
            line-height: 1.5;
        }
        
        .module-badge {
            display: inline-block;
            margin-top: 10px;
            padding: 4px 12px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 20px;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.9);
        }
        
        @media (max-width: 768px) {
            .header-left h1 {
                font-size: 24px;
            }
            
            .modules-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-left">
                <h1>💜 ASSISTIX Admin Panel</h1>
                <p>Welcome, <?php echo htmlspecialchars($_SESSION['admin_username']); ?>!</p>
            </div>
            <div class="header-right">
                <a href="/chat_updated.php" class="chat-btn">💬 Chat</a>
                <a href="/admin/logout.php" class="logout-btn">🚪 Logout</a>
            </div>
        </div>
        
        <div class="quick-stats">
            <div class="stat-box">
                <div class="stat-icon">👥</div>
                <div class="stat-value"><?php echo number_format($totalUsers); ?></div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-box">
                <div class="stat-icon">💬</div>
                <div class="stat-value"><?php echo number_format($totalChats); ?></div>
                <div class="stat-label">Conversations</div>
            </div>
            <div class="stat-box">
                <div class="stat-icon">💌</div>
                <div class="stat-value"><?php echo number_format($totalMessages); ?></div>
                <div class="stat-label">Messages</div>
            </div>
        </div>
        
        <div class="modules-grid">
            <a href="/admin/dashboard.php" class="module-card">
                <div class="module-icon">📊</div>
                <div class="module-title">Dashboard</div>
                <div class="module-desc">Real-time analytics, charts and platform metrics</div>
                <span class="module-badge">Analytics</span>
            </a>
            
            <a href="/admin/users.php" class="module-card">
                <div class="module-icon">👥</div>
                <div class="module-title">User Management</div>
                <div class="module-desc">Manage users, roles, permissions and bans</div>
                <span class="module-badge">Users</span>
            </a>
            
            <a href="/admin/chats.php" class="module-card">
                <div class="module-icon">💬</div>
                <div class="module-title">Chat Management</div>
                <div class="module-desc">View, edit and moderate all conversations</div>
                <span class="module-badge">Content</span>
            </a>
            
            <a href="/admin/api-monitor.php" class="module-card">
                <div class="module-icon">📡</div>
                <div class="module-title">API Monitor</div>
                <div class="module-desc">Real-time API usage and performance tracking</div>
                <span class="module-badge">Live</span>
            </a>
            
            <a href="/admin/logs.php" class="module-card">
                <div class="module-icon">📜</div>
                <div class="module-title">System Logs</div>
                <div class="module-desc">View all system logs, errors and activities</div>
                <span class="module-badge">Monitoring</span>
            </a>
            
            <a href="/admin/security.php" class="module-card">
                <div class="module-icon">🛡️</div>
                <div class="module-title">Security</div>
                <div class="module-desc">Login attempts, IP bans, security settings</div>
                <span class="module-badge">Security</span>
            </a>
            
            <a href="/admin/database.php" class="module-card">
                <div class="module-icon">🗄️</div>
                <div class="module-title">Database</div>
                <div class="module-desc">Database management, optimization and queries</div>
                <span class="module-badge">Database</span>
            </a>
            
            <a href="/admin/backups.php" class="module-card">
                <div class="module-icon">💾</div>
                <div class="module-title">Backups</div>
                <div class="module-desc">Create, manage and restore database backups</div>
                <span class="module-badge">Backup</span>
            </a>
            
            <a href="/admin/settings.php" class="module-card">
                <div class="module-icon">⚙️</div>
                <div class="module-title">Settings</div>
                <div class="module-desc">Global platform settings and configuration</div>
                <span class="module-badge">Config</span>
            </a>
            
            <a href="/admin/reports.php" class="module-card">
                <div class="module-icon">📊</div>
                <div class="module-title">Reports</div>
                <div class="module-desc">User reports, complaints and moderation</div>
                <span class="module-badge">Moderation</span>
            </a>
            
            <a href="/admin/plugins.php" class="module-card">
                <div class="module-icon">🔌</div>
                <div class="module-title">Plugins</div>
                <div class="module-desc">Manage 300+ plugins and integrations</div>
                <span class="module-badge">Extensions</span>
            </a>
            
            <a href="/admin/emails.php" class="module-card">
                <div class="module-icon">📧</div>
                <div class="module-title">Email System</div>
                <div class="module-desc">Email logs, templates and notifications</div>
                <span class="module-badge">Communication</span>
            </a>
        </div>
    </div>
</body>
</html>
