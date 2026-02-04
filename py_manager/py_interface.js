// Global variables
var vg_base_url = window.location.origin;
var vg_api_base = vg_base_url + '/api';
var vg_socket = null;
var vg_connected = false;
var vg_scripts_status = {};
var vg_current_log_script = 'manager';
var vg_websocket_available = false;
var vg_current_view = 'scripts';
var vg_current_group = 'All';
var vg_sort_column = 'name';
var vg_sort_direction = 'asc'; // 'asc' or 'desc'

// Global arrays
var ag_scripts = [];

// Initialize on page load
window.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Python Manager Interface...');
    
    // Check if Socket.IO is available
    if (typeof io !== 'undefined') {
        vg_websocket_available = true;
        vf_init_websocket();
    } else {
        console.warn('Socket.IO not available, using polling mode only');
        vf_update_connection_status(false);
    }
    
    vf_fetch_initial_data();
    vf_start_polling();
    
    // Initialize view
    vf_switch_view('scripts');
});

// View Switching
function vf_switch_view(viewName) {
    vg_current_view = viewName;
    
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    var navItem = document.getElementById('nav-' + viewName);
    if (navItem) navItem.classList.add('active');
    
    // Show/Hide script actions in top bar
    var scriptActions = document.getElementById('script-actions');
    if (scriptActions) {
        scriptActions.style.display = viewName === 'scripts' ? 'flex' : 'none';
    }
    
    // Update Main Content
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    var viewSection = document.getElementById('view-' + viewName);
    if (viewSection) {
        viewSection.style.display = viewName === 'scripts' ? 'flex' : 'block';
        if (viewName === 'logs') viewSection.style.display = 'block'; // Logs view handles its own layout
    }
    
    // Update Title
    var titles = {
        'scripts': '脚本管理',
        'logs': '日志管理',
        'settings': '系统设置'
    };
    document.getElementById('page-title').textContent = titles[viewName] || 'Python Manager';
    
    // Specific view initialization
    if (viewName === 'logs') {
        vf_update_log_file_list();
    }
}

// WebSocket functions
function vf_init_websocket() {
    if (!vg_websocket_available) return;
    
    try {
        vg_socket = io(vg_base_url, {
            path: '/socket.io/',
            transports: ['polling', 'websocket'],
            reconnection: true
        });
        
        vg_socket.on('connect', function() {
            vg_connected = true;
            vf_update_connection_status(true, 'ws');
            vf_show_toast('已连接到服务器', 'success');
        });

        vg_socket.on('disconnect', function() {
            vg_connected = false;
            // Don't immediately show disconnected, wait for polling to fail or succeed
            // vf_update_connection_status(false); 
            vf_show_toast('已断开与服务器的连接', 'error');
        });
        
        vg_socket.on('status_update', function(data) {
            vf_handle_status_update(data.status);
        });
        
        vg_socket.on('log_update', function(data) {
            if (vg_current_view === 'logs' && 
                (data.script_id === vg_current_log_script || 
                 (data.script_id === 'manager' && vg_current_log_script === 'manager'))) {
                vf_append_log(data.message);
            }
        });
        
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        vg_websocket_available = false;
    }
}

function vf_update_connection_status(connected, type) {
    var indicator = document.getElementById('connection-status');
    var text = document.getElementById('connection-text');
    
    if (connected) {
        indicator.classList.add('connected');
        text.textContent = type === 'ws' ? '已连接 (WS)' : '已连接 (HTTP)';
        // If WS connected, green. If HTTP only, maybe yellow? 
        // For now, let's keep it green for both, but text differs.
        if (type === 'http') {
             indicator.style.backgroundColor = '#faad14'; // Yellow for HTTP polling
        } else {
             indicator.style.backgroundColor = '#52c41a'; // Green for WS
        }
    } else {
        indicator.classList.remove('connected');
        indicator.style.backgroundColor = '#ff4d4f'; // Red
        text.textContent = '未连接';
    }
}

// Data Fetching
function vf_fetch_initial_data() {
    return fetch(vg_api_base + '/scripts')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                ag_scripts = data.data.scripts;
                return true;
            }
            return false;
        })
        .then(() => vf_fetch_status());
}

function vf_fetch_status() {
    fetch(vg_api_base + '/scripts/status')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                vf_handle_status_update(data.data.status);
                // If not connected via WS, show HTTP connection status
                if (!vg_connected) {
                    vf_update_connection_status(true, 'http');
                }
            }
        })
        .catch(err => {
            console.error('Status fetch failed:', err);
            if (!vg_connected) {
                vf_update_connection_status(false);
            }
        });
}

function vf_start_polling() {
    setInterval(vf_fetch_status, 2000);
}

function vf_handle_status_update(statusList) {
    vg_scripts_status = {};
    statusList.forEach(script => {
        vg_scripts_status[script.id] = script;
    });
    
    if (vg_current_view === 'scripts') {
        vf_render_scripts_table();
    }
}

// Group Management
function vf_render_group_tabs() {
    var groups = new Set(['All']);
    Object.values(vg_scripts_status).forEach(script => {
        if (script.group) {
            groups.add(script.group);
        } else {
            groups.add('Default');
        }
    });
    
    var container = document.getElementById('script-groups');
    var html = '';
    
    Array.from(groups).sort().forEach(group => {
        var activeClass = vg_current_group === group ? 'active' : '';
        // Move 'All' to front if sorted elsewhere, but Set iteration order is insertion order usually for 'All' first
        if (group === 'All') {
             html = `<div class="group-tab ${activeClass}" onclick="vf_select_group('${group}')">全部</div>` + html;
        } else {
             html += `<div class="group-tab ${activeClass}" onclick="vf_select_group('${group}')">${group}</div>`;
        }
    });
    
    container.innerHTML = html;
}

function vf_select_group(group) {
    vg_current_group = group;
    vf_render_scripts_table();
}

function vf_sort_scripts(column) {
    if (vg_sort_column === column) {
        // Toggle direction
        vg_sort_direction = vg_sort_direction === 'asc' ? 'desc' : 'asc';
    } else {
        vg_sort_column = column;
        vg_sort_direction = 'asc';
    }
    vf_render_scripts_table();
}

function vf_update_sort_icons() {
    // Reset all icons
    document.querySelectorAll('.sort-icon').forEach(el => el.textContent = '');
    
    // Set current icon
    var icon = document.getElementById('sort-' + vg_sort_column);
    if (icon) {
        icon.textContent = vg_sort_direction === 'asc' ? '↑' : '↓';
    }
}

// Rendering
function vf_render_scripts_table() {
    vf_render_group_tabs(); // Update tabs
    vf_update_sort_icons(); // Update sort icons
    
    var tbody = document.getElementById('scripts-table-body');
    var emptyState = document.getElementById('empty-state');
    var filterText = document.querySelector('.search-box input').value.toLowerCase();
    
    // Filter scripts
    var scriptsToShow = Object.values(vg_scripts_status).filter(script => {
        // Filter by text
        var textMatch = script.name.toLowerCase().includes(filterText) || 
                        script.id.toLowerCase().includes(filterText);
        
        // Filter by group
        var groupMatch = vg_current_group === 'All' || 
                         (script.group === vg_current_group) ||
                         (!script.group && vg_current_group === 'Default');
                         
        return textMatch && groupMatch;
    });
    
    if (scriptsToShow.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Sort scripts
    scriptsToShow.sort((a, b) => {
        var valA = a[vg_sort_column];
        var valB = b[vg_sort_column];
        
        // Handle null/undefined
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';
        
        // Handle numeric values
        if (typeof valA === 'number' && typeof valB === 'number') {
            return vg_sort_direction === 'asc' ? valA - valB : valB - valA;
        }
        
        // Handle strings
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
        
        if (valA < valB) return vg_sort_direction === 'asc' ? -1 : 1;
        if (valA > valB) return vg_sort_direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    var html = '';
    scriptsToShow.forEach(script => {
        html += vf_create_script_row(script);
    });
    
    tbody.innerHTML = html;
}

function vf_create_script_row(script) {
    var isRunning = script.status === 'running';
    var statusClass = isRunning ? 'running' : 'stopped';
    var statusText = isRunning ? 'Running' : 'Stopped';
    
    var uptime = isRunning ? vf_calculate_uptime(script.start_time) : '-';
    var cpu = isRunning ? script.cpu_percent.toFixed(1) + '%' : '-';
    var memory = isRunning ? script.memory_mb.toFixed(1) + ' MB' : '-';
    var pid = isRunning ? script.pid : '-';
    
    return `
        <tr>
            <td><input type="checkbox" value="${script.id}"></td>
            <td>
                <div style="font-weight: 600;">${script.name}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${script.id}</div>
            </td>
            <td>
                <div style="font-family: monospace; font-size: 12px; max-width: 240px; overflow: hidden; text-overflow: ellipsis;" title="${script.path}">
                    ${script.path}
                </div>
            </td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td style="font-family: monospace;">${pid}</td>
            <td style="font-family: monospace;">${cpu}</td>
            <td style="font-family: monospace;">${memory}</td>
            <td>${uptime}</td>
            <td>
                <div class="action-buttons">
                    ${isRunning ? 
                        `<button class="action-btn action-stop" onclick="vf_stop_script('${script.id}')" title="Stop"><span class="action-icon">&#9632;</span></button>` : 
                        `<button class="action-btn action-start" onclick="vf_start_script('${script.id}')" title="Start"><span class="action-icon">&#9658;</span></button>`
                    }
                    <button class="action-btn action-restart" onclick="vf_restart_script('${script.id}')" title="Restart"><span class="action-icon">&#10227;</span></button>
                    <button class="action-btn action-edit" onclick="vf_show_edit_script_modal('${script.id}')" title="Edit"><span class="action-icon">&#9998;</span></button>
                    <button class="action-btn action-log" onclick="vf_view_log('${script.id}')" title="Logs"><span class="action-icon">&#128221;</span></button>
                    <button class="action-btn action-delete" onclick="vf_delete_script('${script.id}')" title="Delete"><span class="action-icon">&#128465;</span></button>
                </div>
            </td>
        </tr>
    `;
}

function vf_calculate_uptime(startTimeStr) {
    if (!startTimeStr) return '-';
    var start = new Date(startTimeStr);
    var now = new Date();
    var diff = Math.floor((now - start) / 1000);
    
    if (diff < 60) return diff + '秒';
    if (diff < 3600) return Math.floor(diff / 60) + '分';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时';
    return Math.floor(diff / 86400) + '天';
}

function vf_filter_scripts(text) {
    vf_render_scripts_table();
}

// Actions
function vf_start_script(id) {
    fetch(vg_api_base + '/scripts/' + id + '/start', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.success) vf_show_toast('启动成功', 'success');
            else vf_show_toast('启动失败: ' + data.error, 'error');
            vf_fetch_status();
        });
}

function vf_stop_script(id) {
    fetch(vg_api_base + '/scripts/' + id + '/stop', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.success) vf_show_toast('停止成功', 'success');
            else vf_show_toast('停止失败: ' + data.error, 'error');
            vf_fetch_status();
        });
}

function vf_restart_script(id) {
    fetch(vg_api_base + '/scripts/' + id + '/restart', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.success) vf_show_toast('重启指令已发送', 'success');
            else vf_show_toast('重启失败: ' + data.error, 'error');
            vf_fetch_status();
        });
}

function vf_delete_script(id) {
    if (!confirm('确定要删除这个脚本吗？')) return;
    
    fetch(vg_api_base + '/scripts/' + id + '/remove', { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                vf_show_toast('删除成功', 'success');
                vf_fetch_initial_data(); // Reload list
            } else {
                vf_show_toast('删除失败: ' + data.error, 'error');
            }
        });
}

// Logs
function vf_view_log(scriptId) {
    vf_switch_view('logs');
    vf_select_log(scriptId);
}

function vf_update_log_file_list() {
    var list = document.getElementById('log-file-list');
    var html = `<li class="log-file-item ${vg_current_log_script === 'manager' ? 'active' : ''}" onclick="vf_select_log('manager')">管理器日志</li>`;
    
    Object.values(vg_scripts_status).sort((a, b) => a.name.localeCompare(b.name)).forEach(script => {
        var active = vg_current_log_script === script.id ? 'active' : '';
        html += `<li class="log-file-item ${active}" onclick="vf_select_log('${script.id}')">${script.name}</li>`;
    });
    
    list.innerHTML = html;
}

function vf_select_log(scriptId) {
    vg_current_log_script = scriptId;
    vf_update_log_file_list();
    
    var name = scriptId === 'manager' ? '管理器日志' : (vg_scripts_status[scriptId]?.name || scriptId);
    document.getElementById('current-log-name').textContent = name;
    
    vf_refresh_logs();
}

function vf_refresh_logs() {
    var viewer = document.getElementById('log-viewer');
    viewer.innerHTML = '加载中...';
    
    var url = vg_current_log_script === 'manager' 
        ? vg_api_base + '/logs/manager'
        : vg_api_base + '/scripts/' + vg_current_log_script + '/logs';
        
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Convert ANSI to HTML
                var htmlLogs = data.data.logs.map(line => vf_ansi_to_html(line)).join('');
                viewer.innerHTML = htmlLogs;
                viewer.scrollTop = viewer.scrollHeight;
            } else {
                viewer.textContent = '无法加载日志: ' + data.error;
            }
        });
}

function vf_append_log(message) {
    var viewer = document.getElementById('log-viewer');
    // Check if scrolled to bottom
    var isScrolledToBottom = viewer.scrollHeight - viewer.clientHeight <= viewer.scrollTop + 1;
    
    var span = document.createElement('span');
    span.innerHTML = vf_ansi_to_html(message);
    viewer.appendChild(span);
    
    if (isScrolledToBottom) {
        viewer.scrollTop = viewer.scrollHeight;
    }
}

function vf_ansi_to_html(text) {
    if (!text) return '';
    
    // Remove trailing newline if present to avoid double spacing with <br>
    text = text.replace(/\n$/, '');
    
    // Escape HTML first
    text = text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');

    // ANSI regex for colors
    const ansi_regex = /\x1b\[([0-9;]*)m/g;
    
    const colors = {
        '30': 'black', '31': '#ff4d4f', '32': '#52c41a', '33': '#faad14', 
        '34': '#1890ff', '35': '#eb2f96', '36': '#13c2c2', '37': '#d9d9d9',
        '90': 'gray', '91': '#ff7875', '92': '#95de64', '93': '#ffc53d',
        '94': '#69c0ff', '95': '#ff85c0', '96': '#5cdbd3', '97': '#ffffff'
    };

    let html = text.replace(ansi_regex, (match, codes) => {
        if (!codes || codes === '0') return '</span>';
        
        let style = '';
        const codeArray = codes.split(';');
        
        codeArray.forEach(code => {
            if (code === '1') style += 'font-weight:bold;';
            else if (colors[code]) style += `color:${colors[code]};`;
        });
        
        return style ? `<span style="${style}">` : '';
    });
    
    return html + '<br>'; // Add line break
}

function vf_clear_log_view() {
    document.getElementById('log-viewer').innerHTML = '';
}

function vf_filter_logs(text) {
    var items = document.querySelectorAll('.log-file-item');
    text = text.toLowerCase();
    items.forEach(item => {
        if (item.textContent.toLowerCase().includes(text)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

// Modals
function vf_show_add_script_modal() {
    document.getElementById('add-script-modal').style.display = 'flex';
}

function vf_close_add_script_modal() {
    document.getElementById('add-script-modal').style.display = 'none';
}

function vf_add_script() {
    var data = {
        name: document.getElementById('new-script-name').value,
        path: document.getElementById('new-script-path').value,
        args: document.getElementById('new-script-args').value,
        interpreter: document.getElementById('new-script-interpreter').value,
        group: document.getElementById('new-script-group').value,
        auto_restart: document.getElementById('new-script-auto-restart').checked
    };
    
    if (!data.path) {
        vf_show_toast('脚本路径不能为空', 'error');
        return;
    }
    
    fetch(vg_api_base + '/scripts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            vf_show_toast('添加成功', 'success');
            vf_close_add_script_modal();
            vf_fetch_initial_data();
        } else {
            vf_show_toast('添加失败: ' + data.error, 'error');
        }
    });
}

function vf_show_edit_script_modal(id) {
    var script = vg_scripts_status[id];
    if (!script) return;
    
    document.getElementById('edit-script-id').value = script.id;
    document.getElementById('edit-script-name').value = script.name;
    document.getElementById('edit-script-path').value = script.path;
    
    // Handle args display
    let args = script.args;
    if (Array.isArray(args)) {
        args = args.join(' ');
    }
    document.getElementById('edit-script-args').value = args || '';
    
    document.getElementById('edit-script-interpreter').value = script.interpreter || '';
    document.getElementById('edit-script-group').value = script.group || '';
    document.getElementById('edit-script-auto-restart').checked = script.auto_restart;
    
    document.getElementById('script-edit-modal').style.display = 'flex';
}

function vf_close_edit_script_modal() {
    document.getElementById('script-edit-modal').style.display = 'none';
}

function vf_save_script_changes() {
    var id = document.getElementById('edit-script-id').value;
    var data = {
        name: document.getElementById('edit-script-name').value,
        args: document.getElementById('edit-script-args').value,
        interpreter: document.getElementById('edit-script-interpreter').value,
        group: document.getElementById('edit-script-group').value,
        auto_restart: document.getElementById('edit-script-auto-restart').checked
    };
    
    fetch(vg_api_base + '/scripts/' + id + '/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            vf_show_toast('保存成功', 'success');
            vf_close_edit_script_modal();
            vf_fetch_initial_data();
        } else {
            vf_show_toast('保存失败: ' + data.error, 'error');
        }
    });
}

function vf_handle_file_select(event) {
    var file = event.target.files[0];
    if (file) {
        // Note: Browser security prevents getting full path. 
        // This is just a helper for the name, user still needs to input path usually unless local server.
        // But since this is a local manager, we might not get the full path easily in browser.
        // We'll just use the name for now or try to guess.
        // Actually, for a local tool, users often copy-paste paths.
        document.getElementById('new-script-path').value = file.name; 
        vf_show_toast('注意：浏览器安全限制无法获取完整路径，请手动补全路径', 'warning');
    }
}

// Utilities
function vf_show_toast(message, type) {
    var container = document.getElementById('toast-container');
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => container.removeChild(toast), 300);
    }, 3000);
}

function vf_toggle_dark_mode() {
    document.body.classList.toggle('dark-mode');
}

function vf_close_modal() {
    document.getElementById('modal').style.display = 'none';
}
