<?php
session_start();
require 'auth_check.php';
require '../db.php';

// Create logs table if not exists
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS system_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            level VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            context TEXT,
            ip_address VARCHAR(45),
            user_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_level (level),
            INDEX idx_created (created_at)
        )
    ");
} catch (Exception $e) {
    // Table might already exist
}

// Add sample log if empty
try {
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM system_logs");
    if ($stmt->fetch()['total'] == 0) {
        $pdo->exec("
            INSERT INTO system_logs (level, message, context, ip_address) VALUES
            ('INFO', 'System started', 'Admin panel initialized', '127.0.0.1'),
            ('WARNING', 'High memory usage detected', 'Memory: 85%', '127.0.0.1'),
            ('ERROR', 'Failed API request', 'IO.NET timeout after 30s', '192.168.1.100'),
            ('INFO', 'User login successful', 'user_id: 1', '192.168.1.50'),
            ('DEBUG', 'Database query executed', 'SELECT * FROM users', '127.0.0.1')
        ");
    }
} catch (Exception $e) {
    // Ignore
}

// Get logs
try {
    $level = $_GET['level'] ?? 'all';
    $search = $_GET['search'] ?? '';
    $limit = intval($_GET['limit'] ?? 100);
    
    $query = "SELECT * FROM system_logs WHERE 1=1";
    
    if ($level !== 'all') {
        $query .= " AND level = :level";
    }
    
    if ($search) {
        $query .= " AND message LIKE :search";
    }
    
    $query .= " ORDER BY created_at DESC LIMIT :limit";
    
    $stmt = $pdo->prepare($query);
    
    if ($level !== 'all') {
        $stmt->bindValue(':level', $level);
    }
    if ($search) {
        $stmt->bindValue(':search', "%$search%");
    }
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    
    $stmt->execute();
    $logs = $stmt->fetchAll();
    
    // Stats
    $stmt = $pdo->query("SELECT level, COUNT(*) as count FROM system_logs GROUP BY level");
    $stats = [];
    while ($row = $stmt->fetch()) {
        $stats[$row['level']] = $row['count'];
    }
    
} catch (Exception $e) {
    $logs = [];
    $stats = [];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Logs - ASSISTIX</title>
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
        }
        
        .header h1 {
            color: white;
            font-size: 32px;
            margin-bottom: 20px;
        }
        
        .nav-links {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .nav-link {
            padding: 10px 20px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            color: white;
            text-decoration: none;
            transition: all 0.3s;
            font-size: 14px;
        }
        
        .nav-link:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .nav-link.active {
            background: white;
            color: #667eea;
        }
        
        .stats-bar {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        .stat-pill {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 12px 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 13px;
        }
        
        .stat-pill strong {
            font-size: 18px;
            display: inline-block;
            margin-right: 5px;
        }
        
        .controls {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 20px;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .search-box {
            flex: 1;
            min-width: 250px;
            padding: 12px 20px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 12px;
            color: white;
            font-size: 14px;
        }
        
        .search-box::placeholder {
            color: rgba(255, 255, 255, 0.6);
        }
        
        .filter-btn {
            padding: 12px 20px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 12px;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
        }
        
        .filter-btn:hover,
        .filter-btn.active {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .logs-container {
            background: rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            font-family: 'Courier New', monospace;
            max-height: 700px;
            overflow-y: auto;
        }
        
        .log-entry {
            padding: 12px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 3px solid;
            transition: all 0.3s;
        }
        
        .log-entry:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        
        .log-entry.ERROR {
            border-color: #ef4444;
            background: rgba(239, 68, 68, 0.1);
        }
        
        .log-entry.WARNING {
            border-color: #f59e0b;
            background: rgba(245, 158, 11, 0.1);
        }
        
        .log-entry.INFO {
            border-color: #3b82f6;
            background: rgba(59, 130, 246, 0.1);
        }
        
        .log-entry.DEBUG {
            border-color: #8b5cf6;
            background: rgba(139, 92, 246, 0.1);
        }
        
        .log-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .log-level {
            padding: 3px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: bold;
        }
        
        .log-level.ERROR {
            background: rgba(239, 68, 68, 0.3);
            color: #fca5a5;
        }
        
        .log-level.WARNING {
            background: rgba(245, 158, 11, 0.3);
            color: #fcd34d;
        }
        
        .log-level.INFO {
            background: rgba(59, 130, 246, 0.3);
            color: #93c5fd;
        }
        
        .log-level.DEBUG {
            background: rgba(139, 92, 246, 0.3);
            color: #c4b5fd;
        }
        
        .log-time {
            color: rgba(255, 255, 255, 0.5);
            font-size: 11px;
        }
        
        .log-message {
            color: rgba(255, 255, 255, 0.9);
            font-size: 13px;
            margin-bottom: 5px;
        }
        
        .log-context {
            color: rgba(255, 255, 255, 0.6);
            font-size: 11px;
        }
        
        .log-meta {
            color: rgba(255, 255, 255, 0.4);
            font-size: 11px;
            margin-top: 5px;
        }
        
        ::-webkit-scrollbar {
            width: 8px;
        }
        
        ::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📜 System Logs</h1>
            <div class="nav-links">
                <a href="/admin/index.php" class="nav-link">🏠 Home</a>
                <a href="/admin/dashboard.php" class="nav-link">📊 Dashboard</a>
                <a href="/admin/logs.php" class="nav-link active">📜 Logs</a>
                <a href="/admin/security.php" class="nav-link">🛡️ Security</a>
            </div>
        </div>
        
        <div class="stats-bar">
            <div class="stat-pill">
                <strong><?php echo $stats['ERROR'] ?? 0; ?></strong> Errors
            </div>
            <div class="stat-pill">
                <strong><?php echo $stats['WARNING'] ?? 0; ?></strong> Warnings
            </div>
            <div class="stat-pill">
                <strong><?php echo $stats['INFO'] ?? 0; ?></strong> Info
            </div>
            <div class="stat-pill">
                <strong><?php echo $stats['DEBUG'] ?? 0; ?></strong> Debug
            </div>
        </div>
        
        <div class="controls">
            <input type="text" class="search-box" id="searchBox" placeholder="🔍 Search logs..." 
                   value="<?php echo htmlspecialchars($search); ?>" onchange="handleSearch()">
            <a href="?level=all" class="filter-btn <?php echo $level === 'all' ? 'active' : ''; ?>">All</a>
            <a href="?level=ERROR" class="filter-btn <?php echo $level === 'ERROR' ? 'active' : ''; ?>">Errors</a>
            <a href="?level=WARNING" class="filter-btn <?php echo $level === 'WARNING' ? 'active' : ''; ?>">Warnings</a>
            <a href="?level=INFO" class="filter-btn <?php echo $level === 'INFO' ? 'active' : ''; ?>">Info</a>
            <a href="?level=DEBUG" class="filter-btn <?php echo $level === 'DEBUG' ? 'active' : ''; ?>">Debug</a>
        </div>
        
        <div class="logs-container">
            <?php foreach ($logs as $log): ?>
                <div class="log-entry <?php echo $log['level']; ?>">
                    <div class="log-header">
                        <span class="log-level <?php echo $log['level']; ?>"><?php echo $log['level']; ?></span>
                        <span class="log-time"><?php echo date('Y-m-d H:i:s', strtotime($log['created_at'])); ?></span>
                    </div>
                    <div class="log-message"><?php echo htmlspecialchars($log['message']); ?></div>
                    <?php if ($log['context']): ?>
                        <div class="log-context">📋 <?php echo htmlspecialchars($log['context']); ?></div>
                    <?php endif; ?>
                    <?php if ($log['ip_address']): ?>
                        <div class="log-meta">🌐 IP: <?php echo htmlspecialchars($log['ip_address']); ?></div>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
            
            <?php if (empty($logs)): ?>
                <div style="text-align: center; color: rgba(255,255,255,0.6); padding: 60px;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📜</div>
                    <p>No logs found</p>
                </div>
            <?php endif; ?>
        </div>
    </div>
    
    <script>
        function handleSearch() {
            const search = document.getElementById('searchBox').value;
            window.location.href = '?search=' + encodeURIComponent(search) + '&level=<?php echo $level; ?>';
        }
        
        // Auto-scroll to bottom
        const container = document.querySelector('.logs-container');
        if (container) {
            container.scrollTop = 0;
        }
    </script>
</body>
</html>
