<?php
session_start();
require 'auth_check.php';
require '../db.php';

// Create reports table if not exists
try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            report_type VARCHAR(50),
            subject VARCHAR(255),
            message TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP NULL,
            resolved_by VARCHAR(255),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_status (status)
        )
    ");
    
    // Add sample reports if empty
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM user_reports");
    if ($stmt->fetch()['total'] == 0) {
        $pdo->exec("
            INSERT INTO user_reports (user_id, report_type, subject, message, status) VALUES
            (1, 'bug', 'Chat not loading', 'When I try to open my chat history, the page freezes', 'pending'),
            (1, 'content', 'Inappropriate response', 'AI generated offensive content in conversation #123', 'resolved'),
            (1, 'feature', 'Voice input not working', 'Voice button does not respond on mobile', 'pending')
        ");
    }
} catch (Exception $e) {
    // Table might exist
}

// Handle report resolution
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    header('Content-Type: application/json');
    
    try {
        if ($_POST['action'] === 'resolve') {
            $reportId = intval($_POST['report_id']);
            $stmt = $pdo->prepare("UPDATE user_reports SET status = 'resolved', resolved_at = NOW(), resolved_by = ? WHERE id = ?");
            $stmt->execute([$_SESSION['admin_username'], $reportId]);
            echo json_encode(['success' => true, 'message' => 'Report resolved']);
        } elseif ($_POST['action'] === 'delete') {
            $reportId = intval($_POST['report_id']);
            $stmt = $pdo->prepare("DELETE FROM user_reports WHERE id = ?");
            $stmt->execute([$reportId]);
            echo json_encode(['success' => true, 'message' => 'Report deleted']);
        }
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

// Get reports
try {
    $status = $_GET['status'] ?? 'all';
    
    $query = "
        SELECT r.*, u.email
        FROM user_reports r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE 1=1
    ";
    
    if ($status !== 'all') {
        $query .= " AND r.status = :status";
    }
    
    $query .= " ORDER BY r.created_at DESC";
    
    $stmt = $pdo->prepare($query);
    if ($status !== 'all') {
        $stmt->bindValue(':status', $status);
    }
    $stmt->execute();
    $reports = $stmt->fetchAll();
    
    // Stats
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM user_reports WHERE status = 'pending'");
    $pendingCount = $stmt->fetch()['total'];
    
    $stmt = $pdo->query("SELECT COUNT(*) as total FROM user_reports WHERE status = 'resolved'");
    $resolvedCount = $stmt->fetch()['total'];
    
} catch (Exception $e) {
    $reports = [];
    $pendingCount = $resolvedCount = 0;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reports - ASSISTIX</title>
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
            gap: 20px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        .stat-pill {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 15px 25px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .stat-pill strong {
            color: white;
            font-size: 24px;
            display: block;
            margin-bottom: 5px;
        }
        
        .stat-pill span {
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
        }
        
        .filters {
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
        
        .filter-btn {
            padding: 10px 20px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            color: white;
            text-decoration: none;
            transition: all 0.3s;
            font-size: 14px;
        }
        
        .filter-btn:hover,
        .filter-btn.active {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .reports-container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .report-item {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 15px;
            border-left: 4px solid;
            transition: all 0.3s;
        }
        
        .report-item:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        
        .report-item.pending {
            border-color: #f59e0b;
        }
        
        .report-item.resolved {
            border-color: #10b981;
        }
        
        .report-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .report-type {
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .report-type.bug {
            background: rgba(239, 68, 68, 0.3);
            color: #fca5a5;
        }
        
        .report-type.content {
            background: rgba(245, 158, 11, 0.3);
            color: #fcd34d;
        }
        
        .report-type.feature {
            background: rgba(59, 130, 246, 0.3);
            color: #93c5fd;
        }
        
        .report-status {
            padding: 5px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .report-status.pending {
            background: rgba(245, 158, 11, 0.3);
            color: #fcd34d;
        }
        
        .report-status.resolved {
            background: rgba(16, 185, 129, 0.3);
            color: #6ee7b7;
        }
        
        .report-subject {
            color: white;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .report-message {
            color: rgba(255, 255, 255, 0.8);
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 15px;
        }
        
        .report-meta {
            display: flex;
            gap: 20px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px;
            margin-bottom: 15px;
        }
        
        .report-actions {
            display: flex;
            gap: 10px;
        }
        
        .btn-small {
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            color: white;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .btn-small:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .btn-small.success {
            background: rgba(16, 185, 129, 0.3);
            border-color: rgba(16, 185, 129, 0.5);
        }
        
        .btn-small.danger {
            background: rgba(239, 68, 68, 0.3);
            border-color: rgba(239, 68, 68, 0.5);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 User Reports</h1>
            <div class="nav-links">
                <a href="/admin/index.php" class="nav-link">🏠 Home</a>
                <a href="/admin/dashboard.php" class="nav-link">📊 Dashboard</a>
                <a href="/admin/reports.php" class="nav-link active">📋 Reports</a>
            </div>
        </div>
        
        <div class="stats-bar">
            <div class="stat-pill">
                <strong><?php echo $pendingCount; ?></strong>
                <span>Pending</span>
            </div>
            <div class="stat-pill">
                <strong><?php echo $resolvedCount; ?></strong>
                <span>Resolved</span>
            </div>
        </div>
        
        <div class="filters">
            <a href="?status=all" class="filter-btn <?php echo $status === 'all' ? 'active' : ''; ?>">All</a>
            <a href="?status=pending" class="filter-btn <?php echo $status === 'pending' ? 'active' : ''; ?>">Pending</a>
            <a href="?status=resolved" class="filter-btn <?php echo $status === 'resolved' ? 'active' : ''; ?>">Resolved</a>
        </div>
        
        <div class="reports-container">
            <?php foreach ($reports as $report): ?>
                <div class="report-item <?php echo $report['status']; ?>">
                    <div class="report-header">
                        <div>
                            <span class="report-type <?php echo $report['report_type']; ?>">
                                <?php echo $report['report_type']; ?>
                            </span>
                        </div>
                        <span class="report-status <?php echo $report['status']; ?>">
                            <?php echo strtoupper($report['status']); ?>
                        </span>
                    </div>
                    
                    <div class="report-subject"><?php echo htmlspecialchars($report['subject']); ?></div>
                    <div class="report-message"><?php echo nl2br(htmlspecialchars($report['message'])); ?></div>
                    
                    <div class="report-meta">
                        <span>👤 <?php echo htmlspecialchars($report['email'] ?? 'Unknown'); ?></span>
                        <span>📅 <?php echo date('M d, Y H:i', strtotime($report['created_at'])); ?></span>
                        <?php if ($report['resolved_at']): ?>
                            <span>✅ Resolved by <?php echo htmlspecialchars($report['resolved_by']); ?></span>
                        <?php endif; ?>
                    </div>
                    
                    <?php if ($report['status'] === 'pending'): ?>
                        <div class="report-actions">
                            <button class="btn-small success" onclick="resolveReport(<?php echo $report['id']; ?>)">
                                ✅ Mark as Resolved
                            </button>
                            <button class="btn-small danger" onclick="deleteReport(<?php echo $report['id']; ?>)">
                                🗑️ Delete
                            </button>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endforeach; ?>
            
            <?php if (empty($reports)): ?>
                <div style="text-align: center; padding: 60px; color: rgba(255,255,255,0.6);">
                    <div style="font-size: 64px; margin-bottom: 20px;">📋</div>
                    <p>No reports found</p>
                </div>
            <?php endif; ?>
        </div>
    </div>
    
    <script>
        async function resolveReport(reportId) {
            const formData = new FormData();
            formData.append('action', 'resolve');
            formData.append('report_id', reportId);
            
            try {
                const response = await fetch('/admin/reports.php', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (result.success) {
                    location.reload();
                } else {
                    alert('❌ ' + result.error);
                }
            } catch (error) {
                alert('❌ Error: ' + error.message);
            }
        }
        
        async function deleteReport(reportId) {
            if (!confirm('Delete this report?')) return;
            
            const formData = new FormData();
            formData.append('action', 'delete');
            formData.append('report_id', reportId);
            
            try {
                const response = await fetch('/admin/reports.php', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (result.success) {
                    location.reload();
                } else {
                    alert('❌ ' + result.error);
                }
            } catch (error) {
                alert('❌ Error: ' + error.message);
            }
        }
    </script>
</body>
</html>
