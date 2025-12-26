from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import json
import os
import threading
import time
from datetime import datetime

# Import our modules
import py_process
import py_logger
import py_script_manager

# Global variables
vg_app = Flask(__name__)
vg_socketio = None
vg_config = None
vg_update_thread = None
vg_running = True

def vf_load_api_config():
    """Load API configuration"""
    global vg_config
    vf_config_path = os.path.join(os.path.dirname(__file__), 'api_config.json')
    
    try:
        with open(vf_config_path, 'r') as vf_file:
            vg_config = json.load(vf_file)
            return True
    except Exception as vf_error:
        print(f"Error loading API config: {vf_error}")
        return False

@vg_app.route('/api/scripts/start-all', methods=['POST'])
def route_start_all_scripts():
    """Start all enabled scripts"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    ag_results = []
    for vf_script in py_process.vg_config['scripts']:
        if vf_script['enabled'] and vf_script['id'] not in py_process.vg_processes:
            vf_result = py_process.vf_start_script(vf_script['id'])
            ag_results.append({
                'script_id': vf_script['id'],
                'result': vf_result
            })
    
    py_logger.vf_write_manager_log('API', f'Start all scripts via API: {len(ag_results)} scripts')
    
    return vf_api_response(True, {'results': ag_results})

@vg_app.route('/api/scripts/stop-all', methods=['POST'])
def route_stop_all_scripts():
    """Stop all running scripts"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    ag_results = []
    for vf_script_id in list(py_process.vg_processes.keys()):
        vf_result = py_process.vf_stop_script(vf_script_id)
        ag_results.append({
            'script_id': vf_script_id,
            'result': vf_result
        })
    
    py_logger.vf_write_manager_log('API', f'Stop all scripts via API: {len(ag_results)} scripts')
    
    return vf_api_response(True, {'results': ag_results})

# Load configurations
vf_load_api_config()
py_process.vf_load_config()

# Configure Flask app
vg_app.config['SECRET_KEY'] = vg_config['api_settings']['secret_key']

# Initialize CORS
CORS(vg_app, origins=vg_config['api_settings']['cors_origins'])

# Initialize SocketIO
"""
vg_socketio = SocketIO(
    vg_app, 
    cors_allowed_origins=vg_config['api_settings']['cors_origins'],
    ping_timeout=vg_config['websocket_settings']['ping_timeout'],
    ping_interval=vg_config['websocket_settings']['ping_interval']
)
"""
# Initialize SocketIO with explicit CORS settings
vg_socketio = SocketIO(
    vg_app, 
    cors_allowed_origins="*",  # Allow all origins for now
    async_mode='threading'
)

# Middleware for optional authentication
def vf_check_auth():
    """Check authentication if enabled"""
    if not vg_config['api_settings']['auth_enabled']:
        return True
    
    vf_token = request.headers.get('Authorization')
    if vf_token and vf_token.replace('Bearer ', '') == vg_config['api_settings']['auth_token']:
        return True
    
    return False

def vf_api_response(vf_success, vf_data=None, vf_error=None, vf_status_code=200):
    """Standardized API response format"""
    vf_response = {
        'success': vf_success,
        'timestamp': datetime.now().isoformat()
    }
    
    if vf_data is not None:
        vf_response['data'] = vf_data
    
    if vf_error is not None:
        vf_response['error'] = vf_error
    
    return jsonify(vf_response), vf_status_code

# REST API Routes

@vg_app.route('/api/health', methods=['GET'])
def route_health():
    """Health check endpoint"""
    return vf_api_response(True, {'status': 'healthy', 'version': '1.0.0'})

@vg_app.route('/api/scripts', methods=['GET'])
def route_get_scripts():
    """Get all configured scripts"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    ag_scripts = py_process.vg_config['scripts']
    return vf_api_response(True, {'scripts': ag_scripts})

@vg_app.route('/api/scripts/status', methods=['GET'])
def route_get_all_status():
    """Get status of all scripts"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    ag_status = py_process.vf_get_all_status()
    return vf_api_response(True, {'status': ag_status})

@vg_app.route('/api/scripts/<script_id>/status', methods=['GET'])
def route_get_script_status(script_id):
    """Get status of specific script"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    ag_all_status = py_process.vf_get_all_status()
    vf_script_status = None
    
    for vf_status in ag_all_status:
        if vf_status['id'] == script_id:
            vf_script_status = vf_status
            break
    
    if vf_script_status:
        return vf_api_response(True, {'status': vf_script_status})
    else:
        return vf_api_response(False, error='Script not found', vf_status_code=404)

@vg_app.route('/api/scripts/<script_id>/start', methods=['POST'])
def route_start_script(script_id):
    """Start a script"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    vf_result = py_process.vf_start_script(script_id)
    
    # Log the action
    py_logger.vf_write_manager_log('API', f'Start script via API: {vf_result}', script_id)
    
    # Emit update via WebSocket (safely)
    vf_safe_emit_update()
    
    if vf_result['success']:
        return vf_api_response(True, vf_result)
    else:
        return vf_api_response(False, error=vf_result.get('error'), vf_status_code=400)

@vg_app.route('/api/scripts/<script_id>/stop', methods=['POST'])
def route_stop_script(script_id):
    """Stop a script"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    vf_result = py_process.vf_stop_script(script_id)
    
    # Log the action
    py_logger.vf_write_manager_log('API', f'Stop script via API: {vf_result}', script_id)
    
    # Emit update via WebSocket
    vf_safe_emit_update()
    
    if vf_result['success']:
        return vf_api_response(True, vf_result)
    else:
        return vf_api_response(False, error=vf_result.get('error'), vf_status_code=400)

@vg_app.route('/api/scripts/<script_id>/restart', methods=['POST'])
def route_restart_script(script_id):
    """Restart a script"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    vf_result = py_process.vf_restart_script(script_id)
    
    # Log the action
    py_logger.vf_write_manager_log('API', f'Restart script via API: {vf_result}', script_id)
    
    # Emit update via WebSocket
    vf_safe_emit_update()
    
    if vf_result['success']:
        return vf_api_response(True, vf_result)
    else:
        return vf_api_response(False, error=vf_result.get('error'), vf_status_code=400)

@vg_app.route('/api/scripts/<script_id>/logs', methods=['GET'])
def route_get_script_logs(script_id):
    """Get logs for a script"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    vf_lines = request.args.get('lines', 100, type=int)
    ag_logs = py_logger.vf_read_recent_logs(script_id, vf_lines)
    
    return vf_api_response(True, {'logs': ag_logs, 'script_id': script_id})

@vg_app.route('/api/manager/logs', methods=['GET'])
def route_get_manager_logs():
    """Get manager logs"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    vf_lines = request.args.get('lines', 100, type=int)
    ag_logs = py_logger.vf_read_recent_logs(None, vf_lines)
    
    return vf_api_response(True, {'logs': ag_logs})

@vg_app.route('/api/config/reload', methods=['POST'])
def route_reload_config():
    """Reload configuration"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    vf_success = py_process.vf_load_config()
    
    if vf_success:
        py_logger.vf_write_manager_log('API', 'Configuration reloaded via API')
        vf_safe_emit_update()
        return vf_api_response(True, {'message': 'Configuration reloaded'})
    else:
        return vf_api_response(False, error='Failed to reload configuration', vf_status_code=500)

# Script Management Routes

@vg_app.route('/api/scripts/add', methods=['POST'])
def route_add_script():
    """Add a new script"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    vf_data = request.get_json()
    if not vf_data or 'path' not in vf_data:
        return vf_api_response(False, error='Script path is required', vf_status_code=400)
    
    # Validate script path
    vf_validation = py_script_manager.vf_validate_script_path(vf_data['path'])
    if not vf_validation['valid']:
        return vf_api_response(False, error=vf_validation['error'], vf_status_code=400)
    
    # Add script
    vf_result = py_script_manager.vf_add_script(
        vf_script_path=vf_data['path'],
        vf_name=vf_data.get('name'),
        vf_args=vf_data.get('args', []),
        vf_auto_restart=vf_data.get('auto_restart', True)
    )
    
    if vf_result['success']:
        # Reload config in process manager
        py_process.vf_load_config()
        vf_safe_emit_update()
        py_logger.vf_write_manager_log('API', f'Added new script: {vf_result["script"]["name"]}')
        return vf_api_response(True, vf_result)
    else:
        return vf_api_response(False, error=vf_result['error'], vf_status_code=400)

@vg_app.route('/api/scripts/<script_id>/remove', methods=['DELETE'])
def route_remove_script(script_id):
    """Remove a script"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    # Stop script if running
    if script_id in py_process.vg_processes:
        py_process.vf_stop_script(script_id)
    
    # Remove from config
    vf_result = py_script_manager.vf_remove_script(script_id)
    
    if vf_result['success']:
        # Reload config
        py_process.vf_load_config()
        vf_safe_emit_update()
        py_logger.vf_write_manager_log('API', f'Removed script: {script_id}')
        return vf_api_response(True, {'message': 'Script removed'})
    else:
        return vf_api_response(False, error=vf_result['error'], vf_status_code=400)

@vg_app.route('/api/scripts/<script_id>/update', methods=['PUT'])
def route_update_script(script_id):
    """Update script configuration"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    vf_data = request.get_json()
    if not vf_data:
        return vf_api_response(False, error='No update data provided', vf_status_code=400)
    
    vf_result = py_script_manager.vf_update_script(script_id, vf_data)
    
    if vf_result['success']:
        # Reload config
        py_process.vf_load_config()
        vf_safe_emit_update()
        py_logger.vf_write_manager_log('API', f'Updated script: {script_id}')
        return vf_api_response(True, {'message': 'Script updated'})
    else:
        return vf_api_response(False, error=vf_result['error'], vf_status_code=400)

@vg_app.route('/api/browse/directory', methods=['POST'])
def route_browse_directory():
    """Browse directory for Python files"""
    if not vf_check_auth():
        return vf_api_response(False, error='Unauthorized', vf_status_code=401)
    
    vf_data = request.get_json()
    if not vf_data or 'directory' not in vf_data:
        return vf_api_response(False, error='Directory path is required', vf_status_code=400)
    
    vf_result = py_script_manager.vf_list_python_files(vf_data['directory'])
    
    if vf_result['success']:
        # Return the files directly in the data field for cleaner API response
        return vf_api_response(True, {'files': vf_result['files']})
    else:
        return vf_api_response(False, error=vf_result['error'], vf_status_code=400)

# WebSocket Events

@vg_socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to Python Manager'})
    
    # Send initial status
    ag_status = py_process.vf_get_all_status()
    emit('status_update', {'status': ag_status})

@vg_socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f"Client disconnected: {request.sid}")

@vg_socketio.on('request_status')
def handle_status_request():
    """Handle status request from client"""
    ag_status = py_process.vf_get_all_status()
    emit('status_update', {'status': ag_status})

@vg_socketio.on('subscribe_logs')
def handle_subscribe_logs(data):
    """Subscribe to log updates for a specific script"""
    vf_script_id = data.get('script_id')
    # Implementation for log streaming would go here
    emit('log_subscription', {'subscribed': vf_script_id})

def vf_emit_status_update():
    """Emit status update to all connected clients"""
    try:
        ag_status = py_process.vf_get_all_status()
        vg_socketio.emit('status_update', {'status': ag_status}, broadcast=True)
    except Exception as vf_error:
        # Silently fail if not in request context
        pass

def vf_safe_emit_update():
    """Safely emit update, handling context issues"""
    try:
        # Try to emit directly
        vf_emit_status_update()
    except RuntimeError:
        # If we're outside request context, schedule it
        vg_socketio.start_background_task(vf_emit_status_update)

def vf_status_update_loop():
    """Background thread to emit periodic status updates"""
    global vg_running
    
    while vg_running:
        try:
            vf_emit_status_update()
            time.sleep(vg_config['websocket_settings']['update_interval'])
        except Exception as vf_error:
            print(f"Error in status update loop: {vf_error}")
            time.sleep(5)

def vf_start_api():
    """Start the API server"""
    global vg_update_thread
    
    # Start the monitor thread
    vf_monitor_thread = threading.Thread(target=py_process.vf_monitor_processes)
    vf_monitor_thread.daemon = True
    vf_monitor_thread.start()
    
    # Start status update thread
    vg_update_thread = threading.Thread(target=vf_status_update_loop)
    vg_update_thread.daemon = True
    vg_update_thread.start()
    
    # Log API startup
    py_logger.vf_write_manager_log('API', 'API server started')
    
    # Run the Flask app with SocketIO
    vg_socketio.run(
        vg_app,
        host=vg_config['api_settings']['host'],
        port=vg_config['api_settings']['port'],
        debug=vg_config['api_settings']['debug']
    )

if __name__ == '__main__':
    vf_start_api()