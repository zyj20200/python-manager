// Global variables - auto-detect based on current URL
var vg_base_url = window.location.origin;
var vg_api_base = vg_base_url + '/api';
var vg_socket = null;
var vg_connected = false;
var vg_scripts_status = {};
var vg_current_log_script = 'manager';
var vg_update_interval = null;
var vg_websocket_available = false;

// Global arrays
var ag_log_buffer = [];
var ag_scripts = [];

// Initialize on page load
window.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Python Manager Interface...');
    console.log('API Base:', vg_api_base);
    
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
    vf_init_splitter();
});

// WebSocket functions
function vf_init_websocket() {
    if (!vg_websocket_available) return;
    
    try {
        // Connect to same origin
        vg_socket = io(vg_base_url, {
            path: '/socket.io/',
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });
        
        vg_socket.on('connect', function() {
            vg_connected = true;
            vf_update_connection_status(true);
            console.log('Connected to WebSocket');
            vf_show_notification('已连接到服务器', 'success');
        });

        vg_socket.on('disconnect', function() {
            vg_connected = false;
            vf_update_connection_status(false);
            console.log('Disconnected from WebSocket');
            vf_show_notification('已断开与服务器的连接', 'error');
        });
        
        vg_socket.on('status_update', function(data) {
            vf_handle_status_update(data.status);
        });
        
        vg_socket.on('connect_error', function(error) {
            console.warn('WebSocket connection error:', error.message);
        });
    } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        vg_websocket_available = false;
    }
}

// Connection status
function vf_update_connection_status(vf_connected) {
    var vf_indicator = document.getElementById('connection-status');
    var vf_text = document.getElementById('connection-text');
    
    if (vf_connected) {
        vf_indicator.classList.add('connected');
        vf_text.textContent = '已连接';
    } else {
        vf_indicator.classList.remove('connected');
        vf_text.textContent = '未连接';
    }
}

// Fetch initial data
function vf_fetch_initial_data() {
    // Fetch scripts configuration
    return fetch(vg_api_base + '/scripts')
        .then(vf_response => vf_response.json())
        .then(vf_data => {
            if (vf_data.success) {
                ag_scripts = vf_data.data.scripts;
                vf_update_log_selector();
                return true;
            }
            return false;
        })
        .catch(vf_error => {
            console.error('Error fetching scripts:', vf_error);
            return false;
        })
        .then(() => {
            // Fetch initial status after scripts are loaded
            vf_fetch_status();
        });
}

// Fetch status from API
function vf_fetch_status() {
    fetch(vg_api_base + '/scripts/status')
        .then(vf_response => vf_response.json())
        .then(vf_data => {
            if (vf_data.success) {
                vf_handle_status_update(vf_data.data.status);
            }
        })
        .catch(vf_error => console.error('Error fetching status:', vf_error));
}

// Handle status updates
function vf_handle_status_update(af_status) {
    vg_scripts_status = {};
    af_status.forEach(vf_script => {
        vg_scripts_status[vf_script.id] = vf_script;
    });
    
    vf_render_scripts_grid();
    vf_update_last_update_time();
}

// Render scripts grid with groups
function vf_render_scripts_grid() {
    var vf_grid = document.getElementById('scripts-grid');
    vf_grid.innerHTML = '';

    // Group scripts by their group field
    var vf_groups = {};
    for (var vf_script_id in vg_scripts_status) {
        var vf_script = vg_scripts_status[vf_script_id];
        var vf_group_name = vf_script.group || 'Default';

        if (!vf_groups[vf_group_name]) {
            vf_groups[vf_group_name] = [];
        }
        vf_groups[vf_group_name].push(vf_script);
    }

    // Sort group names alphabetically
    var vf_group_names = Object.keys(vf_groups).sort();

    // Create a group panel for each group
    vf_group_names.forEach(function(vf_group_name) {
        var vf_group_scripts = vf_groups[vf_group_name];

        // Calculate group statistics
        var vf_running_count = 0;
        var vf_stopped_count = 0;
        var vf_total_cpu = 0;
        var vf_total_memory = 0;

        vf_group_scripts.forEach(function(vf_script) {
            if (vf_script.status === 'running') {
                vf_running_count++;
                vf_total_cpu += vf_script.cpu_percent || 0;
                vf_total_memory += vf_script.memory_mb || 0;
            } else {
                vf_stopped_count++;
            }
        });

        // Create group container
        var vf_group_container = document.createElement('div');
        vf_group_container.className = 'script-group';
        vf_group_container.id = 'group-' + vf_group_name.replace(/\s+/g, '-');

        // Create group header
        var vf_group_header = document.createElement('div');
        vf_group_header.className = 'script-group-header';
        vf_group_header.onclick = function() { vf_toggle_group(vf_group_name); };

        vf_group_header.innerHTML = `
            <div class="group-title-row">
                <span class="group-toggle-icon" id="toggle-${vf_group_name.replace(/\s+/g, '-')}">▼</span>
                <span class="group-name">${vf_group_name}</span>
                <span class="group-count" style="color: var(--text-secondary); font-size: 0.85rem; margin-left: 0.5rem;">(${vf_group_scripts.length})</span>
            </div>
        `;

        // Create group content (scripts container)
        var vf_group_content = document.createElement('div');
        vf_group_content.className = 'script-group-content expanded';
        vf_group_content.id = 'content-' + vf_group_name.replace(/\s+/g, '-');

        // Add all scripts in this group
        vf_group_scripts.forEach(function(vf_script) {
            var vf_card = vf_create_script_card(vf_script);
            vf_group_content.appendChild(vf_card);
        });

        // Assemble group
        vf_group_container.appendChild(vf_group_header);
        vf_group_container.appendChild(vf_group_content);
        vf_grid.appendChild(vf_group_container);
    });

    // Update overall statistics
    vf_update_overall_stats();
}

// Toggle group expand/collapse
function vf_toggle_group(vf_group_name) {
    var vf_group_id = vf_group_name.replace(/\s+/g, '-');
    var vf_content = document.getElementById('content-' + vf_group_id);
    var vf_toggle_icon = document.getElementById('toggle-' + vf_group_id);

    if (vf_content.classList.contains('expanded')) {
        vf_content.classList.remove('expanded');
        vf_content.classList.add('collapsed');
        vf_toggle_icon.textContent = '▶';
    } else {
        vf_content.classList.remove('collapsed');
        vf_content.classList.add('expanded');
        vf_toggle_icon.textContent = '▼';
    }
}

// Update overall statistics
function vf_update_overall_stats() {
    var vf_total = 0;
    var vf_running = 0;
    var vf_stopped = 0;
    var vf_total_cpu = 0;
    var vf_total_memory = 0;

    for (var vf_script_id in vg_scripts_status) {
        var vf_script = vg_scripts_status[vf_script_id];
        vf_total++;

        if (vf_script.status === 'running') {
            vf_running++;
            vf_total_cpu += vf_script.cpu_percent || 0;
            vf_total_memory += vf_script.memory_mb || 0;
        } else {
            vf_stopped++;
        }
    }

    document.getElementById('stat-total').textContent = vf_total;
    document.getElementById('stat-running').textContent = vf_running;
    document.getElementById('stat-stopped').textContent = vf_stopped;
    document.getElementById('stat-cpu').textContent = vf_total_cpu.toFixed(1) + '%';
    document.getElementById('stat-memory').textContent = vf_total_memory.toFixed(1) + ' MB';
}

// Create script card
function vf_create_script_card(vf_script) {
    var vf_card = document.createElement('div');
    vf_card.className = 'script-card';
    vf_card.id = 'script-' + vf_script.id;

    var vf_is_running = vf_script.status === 'running';
    var vf_status_text = vf_is_running ? '运行中' : '已停止';

    vf_card.innerHTML = `
        <div class="script-header">
            <div class="script-name" title="${vf_script.name}">${vf_script.name}</div>
            <div class="script-status ${vf_script.status}">
                <span class="status-dot"></span>
                ${vf_status_text}
            </div>
        </div>

        <div class="script-details-toggle" onclick="vf_toggle_script_details('${vf_script.id}')">
            <span id="details-icon-${vf_script.id}">▶</span>
            <span>详细信息</span>
        </div>

        <div class="script-details-content" id="details-content-${vf_script.id}">
            <div class="info-row">
                <span class="info-label">ID:</span>
                <span class="info-value" title="${vf_script.id}">${vf_script.id.substring(0, 8)}...</span>
            </div>
            ${vf_is_running ? `
                <div class="info-row">
                    <span class="info-label">PID:</span>
                    <span class="info-value">${vf_script.pid}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">CPU:</span>
                    <span class="info-value">${vf_script.cpu_percent.toFixed(1)}%</span>
                </div>
                <div class="info-row">
                    <span class="info-label">内存:</span>
                    <span class="info-value">${vf_script.memory_mb.toFixed(1)} MB</span>
                </div>
                <div class="info-row">
                    <span class="info-label">运行时长:</span>
                    <span class="info-value">${vf_calculate_uptime(vf_script.start_time)}</span>
                </div>
            ` : `
                <div class="info-row">
                    <span class="info-label">状态:</span>
                    <span class="info-value">未运行</span>
                </div>
                ${vf_script.restart_attempts > 0 ? `
                    <div class="info-row">
                        <span class="info-label">重启尝试:</span>
                        <span class="info-value">${vf_script.restart_attempts}</span>
                    </div>
                ` : ''}
            `}
        </div>

        <div class="script-actions">
            ${vf_is_running ? `
                <button class="btn btn-danger" onclick="vf_stop_script('${vf_script.id}')">停止</button>
                <button class="btn btn-warning" onclick="vf_restart_script('${vf_script.id}')">重启</button>
            ` : `
                <button class="btn btn-success" onclick="vf_start_script('${vf_script.id}')">启动</button>
            `}
            <button class="btn btn-secondary" onclick="vf_view_script_logs('${vf_script.id}')">日志</button>
        </div>
    `;

    return vf_card;
}

// Toggle script details
function vf_toggle_script_details(vf_script_id) {
    var vf_content = document.getElementById('details-content-' + vf_script_id);
    var vf_icon = document.getElementById('details-icon-' + vf_script_id);

    if (vf_content.classList.contains('expanded')) {
        vf_content.classList.remove('expanded');
        vf_icon.textContent = '▶';
        vf_icon.style.transform = 'rotate(0deg)';
    } else {
        vf_content.classList.add('expanded');
        vf_icon.textContent = '▼';
        vf_icon.style.transform = 'rotate(0deg)';
    }
}

// Update the fetch error handling to show user-friendly messages
function vf_start_script(vf_script_id) {
    vf_set_button_loading(vf_script_id, true);

    fetch(vg_api_base + '/scripts/' + vf_script_id + '/start', {
        method: 'POST'
    })
    .then(vf_response => {
        if (!vf_response.ok) {
            throw new Error('Network response was not ok');
        }
        return vf_response.json();
    })
    .then(vf_data => {
        if (vf_data.success) {
            vf_show_notification('脚本启动成功', 'success');
            vf_fetch_status();
        } else {
            vf_show_notification('启动脚本失败: ' + (vf_data.error || 'Unknown error'), 'error');
        }
    })
    .catch(vf_error => {
        vf_show_notification('启动脚本出错', 'error');
        console.error('Error:', vf_error);
    })
    .finally(() => {
        setTimeout(() => {
            vf_set_button_loading(vf_script_id, false);
        }, 500);
    });
}

function vf_stop_script(vf_script_id) {
    vf_confirm_action('停止脚本', '确定要停止此脚本吗？', function() {
        vf_set_button_loading(vf_script_id, true);

        fetch(vg_api_base + '/scripts/' + vf_script_id + '/stop', {
            method: 'POST'
        })
        .then(vf_response => vf_response.json())
        .then(vf_data => {
            if (vf_data.success) {
                vf_show_notification('脚本停止成功', 'success');
                vf_fetch_status();
            } else {
                vf_show_notification('停止脚本失败: ' + vf_data.error, 'error');
            }
        })
        .catch(vf_error => {
            vf_show_notification('停止脚本出错', 'error');
            console.error('Error:', vf_error);
        })
        .finally(() => {
            vf_set_button_loading(vf_script_id, false);
        });
    });
}

function vf_restart_script(vf_script_id) {
    vf_confirm_action('重启脚本', '确定要重启此脚本吗？', function() {
        vf_set_button_loading(vf_script_id, true);

        fetch(vg_api_base + '/scripts/' + vf_script_id + '/restart', {
            method: 'POST'
        })
        .then(vf_response => vf_response.json())
        .then(vf_data => {
            if (vf_data.success) {
                vf_show_notification('脚本重启成功', 'success');
                vf_fetch_status();
            } else {
                vf_show_notification('重启脚本失败: ' + vf_data.error, 'error');
            }
        })
        .catch(vf_error => {
            vf_show_notification('重启脚本出错', 'error');
            console.error('Error:', vf_error);
        })
        .finally(() => {
            vf_set_button_loading(vf_script_id, false);
        });
    });
}

// Log functions
function vf_view_script_logs(vf_script_id) {
    vg_current_log_script = vf_script_id;
    document.getElementById('log-selector').value = vf_script_id;
    vf_fetch_logs();
}

function vf_change_log_view() {
    vg_current_log_script = document.getElementById('log-selector').value;
    vf_fetch_logs();
}

function vf_fetch_logs() {
    var vf_endpoint = vg_current_log_script === 'manager'
        ? '/manager/logs'
        : '/scripts/' + vg_current_log_script + '/logs';

    fetch(vg_api_base + vf_endpoint + '?lines=100')
        .then(vf_response => vf_response.json())
        .then(vf_data => {
            if (vf_data.success) {
                vf_display_logs(vf_data.data.logs);
            }
        })
        .catch(vf_error => console.error('Error fetching logs:', vf_error));
}

function vf_display_logs(af_logs) {
    var vf_viewer = document.getElementById('log-viewer');

    if (af_logs.length === 0) {
        vf_viewer.innerHTML = '<div class="log-empty">暂无日志</div>';
        return;
    }

    vf_viewer.innerHTML = af_logs.map(vf_log => {
        return '<div class="log-entry">' + vf_ansi_to_html(vf_log) + '</div>';
    }).join('');

    // Scroll to bottom
    vf_viewer.scrollTop = vf_viewer.scrollHeight;
}

function vf_refresh_logs() {
    vf_fetch_logs();
    vf_show_notification('日志已刷新', 'success');
}

function vf_clear_log_view() {
    document.getElementById('log-viewer').innerHTML = '<div class="log-empty">日志视图已清空</div>';
}

// Configuration
function vf_reload_config() {
    fetch(vg_api_base + '/config/reload', {
        method: 'POST'
    })
    .then(vf_response => vf_response.json())
    .then(vf_data => {
        if (vf_data.success) {
            vf_show_notification('配置已重载', 'success');
            vf_fetch_initial_data();
        } else {
            vf_show_notification('重载配置失败', 'error');
        }
    })
    .catch(vf_error => {
        vf_show_notification('重载配置出错', 'error');
        console.error('Error:', vf_error);
    });
}

// Utility functions
function vf_calculate_uptime(vf_start_time) {
    var vf_start = new Date(vf_start_time);
    var vf_now = new Date();
    var vf_diff = vf_now - vf_start;

    var vf_seconds = Math.floor(vf_diff / 1000);
    var vf_minutes = Math.floor(vf_seconds / 60);
    var vf_hours = Math.floor(vf_minutes / 60);
    var vf_days = Math.floor(vf_hours / 24);

    if (vf_days > 0) {
        return vf_days + '天 ' + (vf_hours % 24) + '小时';
    } else if (vf_hours > 0) {
        return vf_hours + '小时 ' + (vf_minutes % 60) + '分钟';
    } else if (vf_minutes > 0) {
        return vf_minutes + '分钟 ' + (vf_seconds % 60) + '秒';
    } else {
        return vf_seconds + '秒';
    }
}

function vf_update_last_update_time() {
    var vf_element = document.getElementById('last-update');
    var vf_time = new Date().toLocaleTimeString();
    vf_element.textContent = '最后更新: ' + vf_time;
}

function vf_update_log_selector() {
    var vf_selector = document.getElementById('log-selector');

    // Keep manager option
    var vf_html = '<option value="manager">管理器日志</option>';

    // Add script options
    ag_scripts.forEach(vf_script => {
        vf_html += `<option value="${vf_script.id}">${vf_script.name} 日志</option>`;
    });

    vf_selector.innerHTML = vf_html;
}

function vf_escape_html(vf_text) {
    var vf_div = document.createElement('div');
    vf_div.textContent = vf_text;
    return vf_div.innerHTML;
}

function vf_ansi_to_html(vf_text) {
    // First escape HTML to prevent XSS
    vf_text = vf_escape_html(vf_text);
    
    // ANSI color codes mapping
    var vf_colors = {
        // Text colors
        30: 'black', 31: '#d00', 32: '#00a000', 33: '#a05000', 34: '#0000d0', 35: '#a000a0', 36: '#00a0a0', 37: 'gray',
        90: 'gray', 91: '#ff5050', 92: '#50ff50', 93: '#ffff50', 94: '#5050ff', 95: '#ff50ff', 96: '#50ffff', 97: 'white',
        // Background colors
        40: 'black', 41: '#d00', 42: '#00a000', 43: '#a05000', 44: '#0000d0', 45: '#a000a0', 46: '#00a0a0', 47: 'gray',
        100: 'gray', 101: '#ff5050', 102: '#50ff50', 103: '#ffff50', 104: '#5050ff', 105: '#ff50ff', 106: '#50ffff', 107: 'white'
    };

    var vf_open_tags = 0;
    
    // Replace ANSI escape sequences
    return vf_text.replace(/\x1B\[([0-9;]*)m/g, function(vf_match, vf_p1) {
        var vf_codes = vf_p1.split(';').map(function(c) { return parseInt(c) || 0; });
        var vf_result = '';
        
        for (var i = 0; i < vf_codes.length; i++) {
            var vf_code = vf_codes[i];
            if (vf_code === 0) {
                // Reset
                while (vf_open_tags > 0) {
                    vf_result += '</span>';
                    vf_open_tags--;
                }
            } else if (vf_colors[vf_code]) {
                // Color
                var vf_type = (vf_code >= 30 && vf_code <= 37) || (vf_code >= 90 && vf_code <= 97) ? 'color' : 'background-color';
                vf_result += '<span style="' + vf_type + ': ' + vf_colors[vf_code] + '">';
                vf_open_tags++;
            } else if (vf_code === 1) {
                // Bold
                vf_result += '<span style="font-weight: bold">';
                vf_open_tags++;
            }
        }
        return vf_result;
    }) + '</span>'.repeat(vf_open_tags);
}

function vf_set_button_loading(vf_script_id, vf_loading) {
    var vf_card = document.getElementById('script-' + vf_script_id);
    if (!vf_card) return;
    
    var af_buttons = vf_card.querySelectorAll('.btn');
    af_buttons.forEach(vf_button => {
        vf_button.disabled = vf_loading;
    });
}

// Modal functions
function vf_confirm_action(vf_title, vf_message, vf_callback) {
    var vf_modal = document.getElementById('modal');
    var vf_title_elem = document.getElementById('modal-title');
    var vf_message_elem = document.getElementById('modal-message');
    var vf_confirm_btn = document.getElementById('modal-confirm');
    
    vf_title_elem.textContent = vf_title;
    vf_message_elem.textContent = vf_message;
    
    // Remove old listener
    var vf_new_btn = vf_confirm_btn.cloneNode(true);
    vf_confirm_btn.parentNode.replaceChild(vf_new_btn, vf_confirm_btn);
    
    vf_new_btn.addEventListener('click', function() {
        vf_callback();
        vf_close_modal();
    });
    
    vf_modal.style.display = 'block';
}

function vf_close_modal() {
    document.getElementById('modal').style.display = 'none';
}

// Enhanced notification function
function vf_show_notification(vf_message, vf_type) {
    var vf_container = document.getElementById('toast-container');
    var vf_toast = document.createElement('div');
    vf_toast.className = 'toast ' + vf_type;
    
    // Choose icon based on type
    var vf_icon = '';
    switch(vf_type) {
        case 'success':
            vf_icon = '✓';
            break;
        case 'error':
            vf_icon = '✗';
            break;
        case 'info':
        default:
            vf_icon = 'ℹ';
            break;
    }
    
    vf_toast.innerHTML = `
        <span class="toast-icon">${vf_icon}</span>
        <span>${vf_message}</span>
    `;
    
    vf_container.appendChild(vf_toast);
    
    // Auto remove after 3 seconds
    setTimeout(function() {
        vf_toast.classList.add('removing');
        setTimeout(function() {
            vf_toast.remove();
        }, 300);
    }, 3000);
}

// Update polling to be more responsive when WebSocket is not available
function vf_start_polling() {
    // Poll every 3 seconds if WebSocket is not available or disconnected
    vg_update_interval = setInterval(function() {
        if (!vg_connected) {
            vf_fetch_status();
        }
    }, 3000);
}

// Close modal on outside click
window.onclick = function(event) {
    var vf_modal = document.getElementById('modal');
    var vf_script_modal = document.getElementById('script-manager-modal');
    
    if (event.target == vf_modal) {
        vf_close_modal();
    } else if (event.target == vf_script_modal) {
        vf_close_script_manager();
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Alt+R: Reload configuration
    if (e.altKey && e.key === 'r') {
        e.preventDefault();
        vf_reload_config();
    }
    
    // Alt+S: Refresh status
    if (e.altKey && e.key === 's') {
        e.preventDefault();
        vf_fetch_status();
        vf_show_notification('状态已刷新', 'info');
    }

    // Alt+L: Focus log selector
    if (e.altKey && e.key === 'l') {
        e.preventDefault();
        document.getElementById('log-selector').focus();
    }
});

// Add tooltips
window.addEventListener('load', function() {
    // Add title attributes for keyboard shortcuts
    var vf_reload_btn = document.querySelector('button[onclick="vf_reload_config()"]');
    if (vf_reload_btn) {
        vf_reload_btn.title = '重新加载配置 (Alt+R)';
    }
});

// Start all scripts
function vf_start_all_scripts() {
    vf_confirm_action(
        '启动所有脚本',
        '确定要启动所有已启用的脚本吗？',
        function() {
            vf_show_loading(true);
            var ag_promises = [];

            for (var vf_script_id in vg_scripts_status) {
                var vf_script = vg_scripts_status[vf_script_id];
                if (vf_script.status === 'stopped' && vf_script.enabled) {
                    ag_promises.push(
                        fetch(vg_api_base + '/scripts/' + vf_script_id + '/start', {
                            method: 'POST'
                        })
                    );
                }
            }

            Promise.all(ag_promises)
                .then(function() {
                    vf_show_notification('所有脚本已启动', 'success');
                    vf_fetch_status();
                })
                .catch(function(error) {
                    vf_show_notification('启动部分脚本出错', 'error');
                    console.error(error);
                })
                .finally(function() {
                    vf_show_loading(false);
                });
        }
    );
}

// Stop all scripts
function vf_stop_all_scripts() {
    vf_confirm_action(
        '停止所有脚本',
        '确定要停止所有运行中的脚本吗？',
        function() {
            vf_show_loading(true);
            var ag_promises = [];

            for (var vf_script_id in vg_scripts_status) {
                var vf_script = vg_scripts_status[vf_script_id];
                if (vf_script.status === 'running') {
                    ag_promises.push(
                        fetch(vg_api_base + '/scripts/' + vf_script_id + '/stop', {
                            method: 'POST'
                        })
                    );
                }
            }

            Promise.all(ag_promises)
                .then(function() {
                    vf_show_notification('所有脚本已停止', 'success');
                    vf_fetch_status();
                })
                .catch(function(error) {
                    vf_show_notification('停止部分脚本出错', 'error');
                    console.error(error);
                })
                .finally(function() {
                    vf_show_loading(false);
                });
        }
    );
}

// Update statistics
function vf_update_statistics() {
    var vf_total = 0;
    var vf_running = 0;
    var vf_stopped = 0;
    var vf_total_cpu = 0;
    var vf_total_memory = 0;
    
    for (var vf_script_id in vg_scripts_status) {
        var vf_script = vg_scripts_status[vf_script_id];
        vf_total++;
        
        if (vf_script.status === 'running') {
            vf_running++;
            vf_total_cpu += vf_script.cpu_percent || 0;
            vf_total_memory += vf_script.memory_mb || 0;
        } else {
            vf_stopped++;
        }
    }
    
    document.getElementById('stat-total').textContent = vf_total;
    document.getElementById('stat-running').textContent = vf_running;
    document.getElementById('stat-stopped').textContent = vf_stopped;
    document.getElementById('stat-cpu').textContent = vf_total_cpu.toFixed(1) + '%';
    document.getElementById('stat-memory').textContent = vf_total_memory.toFixed(1) + ' MB';
}

// Show loading overlay
function vf_show_loading(vf_show) {
    var vf_overlay = document.getElementById('loading-overlay');
    if (!vf_overlay) {
        vf_overlay = document.createElement('div');
        vf_overlay.id = 'loading-overlay';
        vf_overlay.className = 'loading-overlay';
        vf_overlay.innerHTML = '<div class="loading-spinner"></div>';
        document.body.appendChild(vf_overlay);
    }
    vf_overlay.style.display = vf_show ? 'flex' : 'none';
}

// Auto-refresh logs if viewing a running script
var vg_auto_refresh_logs = null;
function vf_start_auto_refresh_logs() {
    vf_stop_auto_refresh_logs();
    
    if (vg_current_log_script !== 'manager') {
        var vf_script = vg_scripts_status[vg_current_log_script];
        if (vf_script && vf_script.status === 'running') {
            vg_auto_refresh_logs = setInterval(function() {
                vf_fetch_logs();
            }, 2000);
            
            // Show indicator
            var vf_indicator = document.createElement('div');
            vf_indicator.className = 'auto-scroll-indicator';
            vf_indicator.textContent = '自动滚动';
            vf_indicator.onclick = vf_stop_auto_refresh_logs;
            document.querySelector('.log-viewer').appendChild(vf_indicator);
        }
    }
}

function vf_stop_auto_refresh_logs() {
    if (vg_auto_refresh_logs) {
        clearInterval(vg_auto_refresh_logs);
        vg_auto_refresh_logs = null;
        
        var vf_indicator = document.querySelector('.auto-scroll-indicator');
        if (vf_indicator) {
            vf_indicator.remove();
        }
    }
}

// Update the handle status update function
var original_vf_handle_status_update = vf_handle_status_update;
vf_handle_status_update = function(af_status) {
    original_vf_handle_status_update(af_status);
    vf_update_statistics();
};

// Update log viewer to start auto-refresh
var original_vf_change_log_view = vf_change_log_view;
vf_change_log_view = function() {
    original_vf_change_log_view();
    vf_start_auto_refresh_logs();
};

// Add smooth scroll to log viewer
var original_vf_display_logs = vf_display_logs;
vf_display_logs = function(af_logs) {
    original_vf_display_logs(af_logs);
    
    // Smooth scroll to bottom if auto-refreshing
    if (vg_auto_refresh_logs) {
        var vf_viewer = document.getElementById('log-viewer');
        vf_viewer.scrollTo({
            top: vf_viewer.scrollHeight,
            behavior: 'smooth'
        });
    }
};

// Add page visibility handling
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // Stop auto-refresh when page is hidden
        vf_stop_auto_refresh_logs();
    } else {
        // Resume when page is visible
        vf_fetch_status();
        if (vg_current_log_script !== 'manager') {
            vf_start_auto_refresh_logs();
        }
    }
});

// Add double-click to toggle script
document.addEventListener('dblclick', function(e) {
    var vf_card = e.target.closest('.script-card');
    if (vf_card) {
        var vf_script_id = vf_card.id.replace('script-', '');
        var vf_script = vg_scripts_status[vf_script_id];
        
        if (vf_script) {
            if (vf_script.status === 'running') {
                vf_stop_script(vf_script_id);
            } else {
                vf_start_script(vf_script_id);
            }
        }
    }
});

// Check if first time user
if (!localStorage.getItem('welcomeShown')) {
    window.addEventListener('load', function() {
        setTimeout(function() {
            vf_show_notification('欢迎使用 Python 脚本管理器！双击脚本卡片可快速切换状态。', 'info');
            localStorage.setItem('welcomeShown', 'true');
        }, 1000);
    });
}

// Script Manager Functions
function vf_show_script_manager() {
    // Populate current scripts
    vf_populate_script_list();

    // Show modal
    document.getElementById('script-manager-modal').style.display = 'block';
}

function vf_close_script_manager() {
    document.getElementById('script-manager-modal').style.display = 'none';
}

function vf_show_add_script_modal() {
    // Populate group suggestions from existing scripts
    vf_populate_group_suggestions('group-suggestions');
    document.getElementById('add-script-modal').style.display = 'block';
}

function vf_close_add_script_modal() {
    document.getElementById('add-script-modal').style.display = 'none';
}

function vf_populate_script_list() {
    var vf_list = document.getElementById('script-list');
    vf_list.innerHTML = '';

    ag_scripts.forEach(function(vf_script) {
        var vf_item = document.createElement('div');
        vf_item.className = 'script-item';
        vf_item.innerHTML = `
            <div class="script-item-info">
                <div class="script-item-name">${vf_script.name}</div>
                <div class="script-item-path">${vf_script.path}</div>
            </div>
            <div class="script-item-actions">
                <button class="btn btn-primary btn-sm" onclick="vf_show_edit_script_modal('${vf_script.id}')" style="margin-right: 5px;">
                    编辑
                </button>
                <button class="btn btn-danger btn-sm" onclick="vf_remove_script('${vf_script.id}')">
                    移除
                </button>
            </div>
        `;
        vf_list.appendChild(vf_item);
    });
}

function vf_show_edit_script_modal(vf_script_id) {
    var vf_script = ag_scripts.find(s => s.id === vf_script_id);
    if (!vf_script) {
        vf_show_notification('脚本未找到', 'error');
        return;
    }

    document.getElementById('edit-script-id').value = vf_script.id;
    document.getElementById('edit-script-path').value = vf_script.path;
    document.getElementById('edit-script-name').value = vf_script.name;
    document.getElementById('edit-script-group').value = vf_script.group || 'Default';
    document.getElementById('edit-script-args').value = Array.isArray(vf_script.args) ? vf_script.args.join(' ') : (vf_script.args || '');
    document.getElementById('edit-script-interpreter').value = vf_script.interpreter || '';
    document.getElementById('edit-script-memory').value = vf_script.max_memory_mb || 512;
    document.getElementById('edit-script-auto-restart').checked = vf_script.auto_restart !== false;
    document.getElementById('edit-script-enabled').checked = vf_script.enabled !== false;

    // Populate group suggestions from existing scripts
    vf_populate_group_suggestions('edit-group-suggestions');

    // Hide script manager modal if open
    document.getElementById('script-manager-modal').style.display = 'none';

    // Show edit modal
    document.getElementById('script-edit-modal').style.display = 'block';
}

function vf_close_edit_script_modal() {
    document.getElementById('script-edit-modal').style.display = 'none';
    // Re-open script manager modal
    document.getElementById('script-manager-modal').style.display = 'block';
}

function vf_save_script_changes() {
    var vf_script_id = document.getElementById('edit-script-id').value;
    var vf_name = document.getElementById('edit-script-name').value.trim();
    var vf_group = document.getElementById('edit-script-group').value.trim();
    var vf_args = document.getElementById('edit-script-args').value.trim();
    var vf_interpreter = document.getElementById('edit-script-interpreter').value.trim();
    var vf_memory = parseInt(document.getElementById('edit-script-memory').value) || 512;
    var vf_auto_restart = document.getElementById('edit-script-auto-restart').checked;
    var vf_enabled = document.getElementById('edit-script-enabled').checked;

    var vf_data = {
        name: vf_name,
        group: vf_group || 'Default',
        args: vf_args ? vf_args.split(' ') : [],
        interpreter: vf_interpreter || null,
        max_memory_mb: vf_memory,
        auto_restart: vf_auto_restart,
        enabled: vf_enabled
    };

    fetch(vg_api_base + '/scripts/' + vf_script_id + '/update', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(vf_data)
    })
    .then(vf_response => vf_response.json())
    .then(vf_data => {
        if (vf_data.success) {
            vf_show_notification('脚本更新成功', 'success');
            vf_close_edit_script_modal();

            // Refresh data
            vf_fetch_initial_data().then(function() {
                // After data is refreshed, update the script list
                vf_populate_script_list();
            });
        } else {
            vf_show_notification('更新脚本失败: ' + (vf_data.error || 'Unknown error'), 'error');
        }
    })
    .catch(vf_error => {
        console.error('Error updating script:', vf_error);
        vf_show_notification('更新脚本出错', 'error');
    });
}

function vf_add_script() {
    var vf_path = document.getElementById('new-script-path').value.trim();
    var vf_name = document.getElementById('new-script-name').value.trim();
    var vf_group = document.getElementById('new-script-group').value.trim();
    var vf_args = document.getElementById('new-script-args').value.trim();
    var vf_interpreter = document.getElementById('new-script-interpreter').value.trim();
    var vf_auto_restart = document.getElementById('new-script-auto-restart').checked;

    if (!vf_path) {
        vf_show_notification('请输入脚本路径', 'error');
        return;
    }

    // Check if it's a full path (contains directory separators)
    if (!vf_path.includes('\\') && !vf_path.includes('/')) {
        vf_show_notification('请输入包含目录的完整路径 (例如: D:\\path\\to\\' + vf_path + ')', 'error');
        document.getElementById('new-script-path').focus();
        return;
    }

    // Check if it ends with .py
    if (!vf_path.endsWith('.py')) {
        vf_show_notification('脚本路径必须以 .py 结尾', 'error');
        return;
    }

    var vf_data = {
        path: vf_path,
        name: vf_name || null,
        group: vf_group || 'Default',
        args: vf_args ? vf_args.split(' ') : [],
        interpreter: vf_interpreter || null,
        auto_restart: vf_auto_restart
    };

    fetch(vg_api_base + '/scripts/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(vf_data)
    })
    .then(vf_response => vf_response.json())
    .then(vf_data => {
        if (vf_data.success) {
            vf_show_notification('脚本添加成功', 'success');
            // Clear form
            document.getElementById('new-script-path').value = '';
            document.getElementById('new-script-name').value = '';
            document.getElementById('new-script-group').value = '';
            document.getElementById('new-script-args').value = '';
            document.getElementById('new-script-interpreter').value = '';
            document.getElementById('new-script-auto-restart').checked = true;
            // Refresh data
            vf_fetch_initial_data().then(function() {
                // After data is refreshed, update the script list
                vf_populate_script_list();
                vf_close_add_script_modal();
            });
        } else {
            vf_show_notification('添加脚本失败: ' + vf_data.error, 'error');
        }
    })
    .catch(vf_error => {
        vf_show_notification('添加脚本出错', 'error');
        console.error('Error:', vf_error);
    });
}

function vf_remove_script(vf_script_id) {
    vf_confirm_action(
        '移除脚本',
        '确定要移除此脚本吗？此操作无法撤销。',
        function() {
            fetch(vg_api_base + '/scripts/' + vf_script_id + '/remove', {
                method: 'DELETE'
            })
            .then(vf_response => vf_response.json())
            .then(vf_data => {
                if (vf_data.success) {
                    vf_show_notification('脚本移除成功', 'success');
                    vf_fetch_initial_data().then(function() {
                        // After data is refreshed, update the script list
                        vf_populate_script_list();
                    });
                } else {
                    vf_show_notification('移除脚本失败: ' + vf_data.error, 'error');
                }
            })
            .catch(vf_error => {
                vf_show_notification('移除脚本出错', 'error');
                console.error('Error:', vf_error);
            });
        }
    );
}

// Handle native file browser selection
function vf_handle_file_select(event) {
    var vf_file = event.target.files[0];
    if (!vf_file) return;

    // Check if it's a Python file
    if (!vf_file.name.endsWith('.py')) {
        vf_show_notification('请选择 Python (.py) 文件', 'error');
        event.target.value = '';
        return;
    }

    // Get filename
    var vf_filename = vf_file.name;

    // Auto-fill the display name if empty
    if (!document.getElementById('new-script-name').value) {
        var vf_name = vf_filename.replace('.py', '').replace(/_/g, ' ');
        vf_name = vf_name.charAt(0).toUpperCase() + vf_name.slice(1);
        document.getElementById('new-script-name').value = vf_name;
    }

    // Automatically add the common scripts directory path
    document.getElementById('new-script-path').value = 'D:\\xampp\\htdocs\\mpy0\\scripts\\' + vf_filename;

    // Show success notification
    vf_show_notification('文件路径已自动补全: D:\\xampp\\htdocs\\mpy0\\scripts\\' + vf_filename, 'success');

    // Reset file input for future use
    event.target.value = '';
}



function vf_escape_quotes(vf_str) {
    return vf_str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// Dark mode toggle
function vf_toggle_dark_mode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// Load dark mode preference
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

// Populate group suggestions from existing scripts
function vf_populate_group_suggestions(vf_datalist_id) {
    var vf_datalist = document.getElementById(vf_datalist_id);
    if (!vf_datalist) return;

    // Clear existing options
    vf_datalist.innerHTML = '';

    // Collect unique group names from existing scripts
    var vf_groups = new Set();
    ag_scripts.forEach(function(vf_script) {
        if (vf_script.group) {
            vf_groups.add(vf_script.group);
        }
    });

    // Add Default if not present
    vf_groups.add('默认');

    // Create options for each group
    vf_groups.forEach(function(vf_group) {
        var vf_option = document.createElement('option');
        vf_option.value = vf_group;
        vf_datalist.appendChild(vf_option);
    });
}

// Splitter functionality
function vf_init_splitter() {
    var vf_splitter = document.getElementById('splitter');
    var vf_scripts_section = document.getElementById('scripts-section');
    var vf_container = document.querySelector('.main-content');

    if (!vf_splitter || !vf_scripts_section || !vf_container) return;

    // Load saved width
    var vf_saved_width = localStorage.getItem('scriptsSectionWidth');
    if (vf_saved_width) {
        // Ensure it's not too small or too large
        var vf_width = parseInt(vf_saved_width);
        var vf_container_width = vf_container.clientWidth;
        if (vf_width > 200 && vf_width < vf_container_width - 100) {
            vf_scripts_section.style.width = vf_width + 'px';
        }
    }

    var vf_is_dragging = false;

    vf_splitter.addEventListener('mousedown', function(e) {
        vf_is_dragging = true;
        vf_splitter.classList.add('active');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // Disable text selection while dragging
    });

    document.addEventListener('mousemove', function(e) {
        if (!vf_is_dragging) return;

        // Calculate new width relative to container
        var vf_container_rect = vf_container.getBoundingClientRect();
        var vf_new_width = e.clientX - vf_container_rect.left;

        // Min width constraints
        if (vf_new_width < 200) vf_new_width = 200;

        // Max width constraints (leave space for logs)
        var vf_max_width = vf_container_rect.width - 100; // Leave 100px for logs
        if (vf_new_width > vf_max_width) vf_new_width = vf_max_width;

        vf_scripts_section.style.width = vf_new_width + 'px';
    });

    document.addEventListener('mouseup', function() {
        if (vf_is_dragging) {
            vf_is_dragging = false;
            vf_splitter.classList.remove('active');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // Save width preference
            localStorage.setItem('scriptsSectionWidth', vf_scripts_section.style.width);
        }
    });
}
