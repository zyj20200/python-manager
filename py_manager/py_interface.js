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
            vf_show_notification('Connected to server', 'success');
        });
        
        vg_socket.on('disconnect', function() {
            vg_connected = false;
            vf_update_connection_status(false);
            console.log('Disconnected from WebSocket');
            vf_show_notification('Disconnected from server', 'error');
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
        vf_text.textContent = 'Connected';
    } else {
        vf_indicator.classList.remove('connected');
        vf_text.textContent = 'Disconnected';
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

// Render scripts grid
function vf_render_scripts_grid() {
    var vf_grid = document.getElementById('scripts-grid');
    vf_grid.innerHTML = '';
    
    for (var vf_script_id in vg_scripts_status) {
        var vf_script = vg_scripts_status[vf_script_id];
        var vf_card = vf_create_script_card(vf_script);
        vf_grid.appendChild(vf_card);
    }
}

// Create script card
function vf_create_script_card(vf_script) {
    var vf_card = document.createElement('div');
    vf_card.className = 'script-card';
    vf_card.id = 'script-' + vf_script.id;
    
    var vf_is_running = vf_script.status === 'running';
    
    vf_card.innerHTML = `
        <div class="script-header">
            <div class="script-name">${vf_script.name}</div>
            <div class="script-status ${vf_script.status}">
                <span class="status-dot"></span>
                ${vf_script.status.toUpperCase()}
            </div>
        </div>
        
        <div class="script-info">
            <div class="info-row">
                <span class="info-label">ID:</span>
                <span class="info-value">${vf_script.id}</span>
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
                    <span class="info-label">Memory:</span>
                    <span class="info-value">${vf_script.memory_mb.toFixed(1)} MB</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Uptime:</span>
                    <span class="info-value">${vf_calculate_uptime(vf_script.start_time)}</span>
                </div>
            ` : `
                <div class="info-row">
                    <span class="info-label">Status:</span>
                    <span class="info-value">Not running</span>
                </div>
                ${vf_script.restart_attempts > 0 ? `
                    <div class="info-row">
                        <span class="info-label">Restart attempts:</span>
                        <span class="info-value">${vf_script.restart_attempts}</span>
                    </div>
                ` : ''}
            `}
        </div>
        
        <div class="script-actions">
            ${vf_is_running ? `
                <button class="btn btn-danger" onclick="vf_stop_script('${vf_script.id}')">Stop</button>
                <button class="btn btn-warning" onclick="vf_restart_script('${vf_script.id}')">Restart</button>
            ` : `
                <button class="btn btn-success" onclick="vf_start_script('${vf_script.id}')">Start</button>
            `}
            <button class="btn btn-secondary" onclick="vf_view_script_logs('${vf_script.id}')">View Logs</button>
        </div>
    `;
    
    return vf_card;
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
            vf_show_notification('Script started successfully', 'success');
            vf_fetch_status();
        } else {
            vf_show_notification('Failed to start script: ' + (vf_data.error || 'Unknown error'), 'error');
        }
    })
    .catch(vf_error => {
        vf_show_notification('Error starting script', 'error');
        console.error('Error:', vf_error);
    })
    .finally(() => {
        setTimeout(() => {
            vf_set_button_loading(vf_script_id, false);
        }, 500);
    });
}

function vf_stop_script(vf_script_id) {
    vf_confirm_action('Stop Script', 'Are you sure you want to stop this script?', function() {
        vf_set_button_loading(vf_script_id, true);
        
        fetch(vg_api_base + '/scripts/' + vf_script_id + '/stop', {
            method: 'POST'
        })
        .then(vf_response => vf_response.json())
        .then(vf_data => {
            if (vf_data.success) {
                vf_show_notification('Script stopped successfully', 'success');
                vf_fetch_status();
            } else {
                vf_show_notification('Failed to stop script: ' + vf_data.error, 'error');
            }
        })
        .catch(vf_error => {
            vf_show_notification('Error stopping script', 'error');
            console.error('Error:', vf_error);
        })
        .finally(() => {
            vf_set_button_loading(vf_script_id, false);
        });
    });
}

function vf_restart_script(vf_script_id) {
    vf_confirm_action('Restart Script', 'Are you sure you want to restart this script?', function() {
        vf_set_button_loading(vf_script_id, true);
        
        fetch(vg_api_base + '/scripts/' + vf_script_id + '/restart', {
            method: 'POST'
        })
        .then(vf_response => vf_response.json())
        .then(vf_data => {
            if (vf_data.success) {
                vf_show_notification('Script restarted successfully', 'success');
                vf_fetch_status();
            } else {
                vf_show_notification('Failed to restart script: ' + vf_data.error, 'error');
            }
        })
        .catch(vf_error => {
            vf_show_notification('Error restarting script', 'error');
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
        vf_viewer.innerHTML = '<div class="log-empty">No logs available</div>';
        return;
    }
    
    vf_viewer.innerHTML = af_logs.map(vf_log => {
        return '<div class="log-entry">' + vf_escape_html(vf_log) + '</div>';
    }).join('');
    
    // Scroll to bottom
    vf_viewer.scrollTop = vf_viewer.scrollHeight;
}

function vf_refresh_logs() {
    vf_fetch_logs();
    vf_show_notification('Logs refreshed', 'success');
}

function vf_clear_log_view() {
    document.getElementById('log-viewer').innerHTML = '<div class="log-empty">Log view cleared</div>';
}

// Configuration
function vf_reload_config() {
    fetch(vg_api_base + '/config/reload', {
        method: 'POST'
    })
    .then(vf_response => vf_response.json())
    .then(vf_data => {
        if (vf_data.success) {
            vf_show_notification('Configuration reloaded', 'success');
            vf_fetch_initial_data();
        } else {
            vf_show_notification('Failed to reload configuration', 'error');
        }
    })
    .catch(vf_error => {
        vf_show_notification('Error reloading configuration', 'error');
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
        return vf_days + 'd ' + (vf_hours % 24) + 'h';
    } else if (vf_hours > 0) {
        return vf_hours + 'h ' + (vf_minutes % 60) + 'm';
    } else if (vf_minutes > 0) {
        return vf_minutes + 'm ' + (vf_seconds % 60) + 's';
    } else {
        return vf_seconds + 's';
    }
}

function vf_update_last_update_time() {
    var vf_element = document.getElementById('last-update');
    var vf_time = new Date().toLocaleTimeString();
    vf_element.textContent = 'Last update: ' + vf_time;
}

function vf_update_log_selector() {
    var vf_selector = document.getElementById('log-selector');
    
    // Keep manager option
    var vf_html = '<option value="manager">Manager Logs</option>';
    
    // Add script options
    ag_scripts.forEach(vf_script => {
        vf_html += `<option value="${vf_script.id}">${vf_script.name} Logs</option>`;
    });
    
    vf_selector.innerHTML = vf_html;
}

function vf_escape_html(vf_text) {
    var vf_div = document.createElement('div');
    vf_div.textContent = vf_text;
    return vf_div.innerHTML;
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
        vf_show_notification('Status refreshed', 'info');
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
        vf_reload_btn.title = 'Reload Configuration (Alt+R)';
    }
});

// Start all scripts
function vf_start_all_scripts() {
    vf_confirm_action(
        'Start All Scripts', 
        'Are you sure you want to start all enabled scripts?',
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
                    vf_show_notification('All scripts started', 'success');
                    vf_fetch_status();
                })
                .catch(function(error) {
                    vf_show_notification('Error starting some scripts', 'error');
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
        'Stop All Scripts',
        'Are you sure you want to stop all running scripts?',
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
                    vf_show_notification('All scripts stopped', 'success');
                    vf_fetch_status();
                })
                .catch(function(error) {
                    vf_show_notification('Error stopping some scripts', 'error');
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
            vf_indicator.textContent = 'Auto-scrolling';
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
            vf_show_notification('Welcome to Python Manager! Double-click any script card to toggle it.', 'info');
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
                <button class="btn btn-danger btn-sm" onclick="vf_remove_script('${vf_script.id}')">
                    Remove
                </button>
            </div>
        `;
        vf_list.appendChild(vf_item);
    });
}

function vf_add_script() {
    var vf_path = document.getElementById('new-script-path').value.trim();
    var vf_name = document.getElementById('new-script-name').value.trim();
    var vf_args = document.getElementById('new-script-args').value.trim();
    var vf_auto_restart = document.getElementById('new-script-auto-restart').checked;
    
    if (!vf_path) {
        vf_show_notification('Please enter a script path', 'error');
        return;
    }
    
    // Check if it's a full path (contains directory separators)
    if (!vf_path.includes('\\') && !vf_path.includes('/')) {
        vf_show_notification('Please enter the full path including directory (e.g., D:\\path\\to\\' + vf_path + ')', 'error');
        document.getElementById('new-script-path').focus();
        return;
    }
    
    // Check if it ends with .py
    if (!vf_path.endsWith('.py')) {
        vf_show_notification('Script path must end with .py', 'error');
        return;
    }
    
    var vf_data = {
        path: vf_path,
        name: vf_name || null,
        args: vf_args ? vf_args.split(' ') : [],
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
            vf_show_notification('Script added successfully', 'success');
            // Clear form
            document.getElementById('new-script-path').value = '';
            document.getElementById('new-script-name').value = '';
            document.getElementById('new-script-args').value = '';
            document.getElementById('new-script-auto-restart').checked = true;
            // Refresh data
            vf_fetch_initial_data().then(function() {
                // After data is refreshed, update the script list
                vf_populate_script_list();
            });
        } else {
            vf_show_notification('Failed to add script: ' + vf_data.error, 'error');
        }
    })
    .catch(vf_error => {
        vf_show_notification('Error adding script', 'error');
        console.error('Error:', vf_error);
    });
}

function vf_remove_script(vf_script_id) {
    vf_confirm_action(
        'Remove Script',
        'Are you sure you want to remove this script? This action cannot be undone.',
        function() {
            fetch(vg_api_base + '/scripts/' + vf_script_id + '/remove', {
                method: 'DELETE'
            })
            .then(vf_response => vf_response.json())
            .then(vf_data => {
                if (vf_data.success) {
                    vf_show_notification('Script removed successfully', 'success');
                    vf_fetch_initial_data().then(function() {
                        // After data is refreshed, update the script list
                        vf_populate_script_list();
                    });
                } else {
                    vf_show_notification('Failed to remove script: ' + vf_data.error, 'error');
                }
            })
            .catch(vf_error => {
                vf_show_notification('Error removing script', 'error');
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
        vf_show_notification('Please select a Python (.py) file', 'error');
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
    vf_show_notification('File path auto-completed: D:\\xampp\\htdocs\\mpy0\\scripts\\' + vf_filename, 'success');
    
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