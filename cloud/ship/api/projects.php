<?php
declare(strict_types=1);

require_once __DIR__ . '/_boot.php';
require_once dirname(__DIR__) . '/lib/projects.php';
require_once dirname(__DIR__) . '/lib/cloud_workspace.php';

$logged = acx_logged_user();
if ($logged === null) {
    acx_json_out(['success' => false, 'error' => 'auth_required'], 401);
}

$uid = (int) $logged['internal_id'];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $data = acx_projects_load($uid);
    acx_json_out(['success' => true, 'projects' => $data['projects']]);
}

if ($method !== 'POST') {
    acx_json_out(['success' => false, 'error' => 'method_not_allowed'], 405);
}

$raw = file_get_contents('php://input');
$in = json_decode((string) $raw, true);
if (!is_array($in)) {
    acx_json_out(['success' => false, 'error' => 'invalid_json'], 400);
}

$action = (string) ($in['action'] ?? '');
$data = acx_projects_load($uid);
$projects = $data['projects'];

switch ($action) {
    case 'create':
        $name = trim((string) ($in['name'] ?? ''));
        if ($name === '') {
            $name = 'Project';
        }
        $name = mb_substr($name, 0, 80);
        $id = acx_project_new_id();
        $proj = [
            'id' => $id,
            'name' => $name,
            'created_at' => time(),
            'updated_at' => time(),
            'session_ids' => [],
            'workspace_key' => acx_cloud_ws_key($id),
        ];
        // Ensure durable cloud workspace exists for this project.
        acx_cloud_workspace_bind($uid, $id, 0);
        $projects[] = $proj;
        acx_projects_save($uid, ['projects' => $projects]);
        acx_json_out(['success' => true, 'project' => $proj]);

    case 'rename':
        $id = (string) ($in['id'] ?? '');
        $name = trim((string) ($in['name'] ?? ''));
        if ($id === '' || $name === '') {
            acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
        }
        $found = false;
        foreach ($projects as &$p) {
            if ($p['id'] === $id) {
                $p['name'] = mb_substr($name, 0, 80);
                $p['updated_at'] = time();
                $found = true;
                break;
            }
        }
        unset($p);
        if (!$found) {
            acx_json_out(['success' => false, 'error' => 'not_found'], 404);
        }
        acx_projects_save($uid, ['projects' => $projects]);
        acx_json_out(['success' => true]);

    case 'delete':
        $id = (string) ($in['id'] ?? '');
        if ($id === '') {
            acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
        }
        $projects = array_values(array_filter($projects, static fn ($p) => ($p['id'] ?? '') !== $id));
        acx_projects_save($uid, ['projects' => $projects]);
        acx_json_out(['success' => true]);

    case 'attach_session':
        $id = (string) ($in['id'] ?? '');
        $sid = (int) ($in['session_id'] ?? 0);
        if ($id === '' || $sid <= 0) {
            acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
        }
        $found = false;
        foreach ($projects as &$p) {
            if ($p['id'] === $id) {
                if (!in_array($sid, $p['session_ids'], true)) {
                    $p['session_ids'][] = $sid;
                }
                $p['updated_at'] = time();
                $found = true;
                break;
            }
        }
        unset($p);
        if (!$found) {
            acx_json_out(['success' => false, 'error' => 'not_found'], 404);
        }
        acx_projects_save($uid, ['projects' => $projects]);
        acx_json_out(['success' => true]);

    case 'detach_session':
        $id = (string) ($in['id'] ?? '');
        $sid = (int) ($in['session_id'] ?? 0);
        if ($id === '' || $sid <= 0) {
            acx_json_out(['success' => false, 'error' => 'bad_fields'], 400);
        }
        foreach ($projects as &$p) {
            if ($p['id'] === $id) {
                $p['session_ids'] = array_values(array_filter($p['session_ids'], static fn ($x) => (int) $x !== $sid));
                $p['updated_at'] = time();
                break;
            }
        }
        unset($p);
        acx_projects_save($uid, ['projects' => $projects]);
        acx_json_out(['success' => true]);

    default:
        acx_json_out(['success' => false, 'error' => 'unknown_action'], 400);
}
