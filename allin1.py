#!/usr/bin/env python
"""All-in-one server for Python Manager - serves web interface and API together"""

import os
import sys
import threading
import time
from flask import Flask, send_from_directory, jsonify, send_file

# Add py_manager to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'py_manager'))

# Import our modules
import py_process
import py_logger
from py_api import vg_app, vg_socketio, vf_status_update_loop

# Get the absolute path to py_manager directory
vg_py_manager_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'py_manager')

# Configure static file serving - BEFORE the API routes
@vg_app.route('/')
def serve_index():
    """Serve the main interface"""
    return send_file(os.path.join(vg_py_manager_path, 'py_manager.html'))

@vg_app.route('/py_manager.css')
def serve_css():
    """Serve CSS file"""
    return send_file(os.path.join(vg_py_manager_path, 'py_manager.css'))

@vg_app.route('/py_interface.js')
def serve_js():
    """Serve JavaScript file"""
    return send_file(os.path.join(vg_py_manager_path, 'py_interface.js'))

@vg_app.route('/socket.io.min.js')
def serve_socketio():
    """Serve Socket.IO if available locally"""
    vf_socketio_path = os.path.join(vg_py_manager_path, 'socket.io.min.js')
    if os.path.exists(vf_socketio_path):
        return send_file(vf_socketio_path)
    else:
        # Return empty script if not found
        return "// Socket.IO not found locally", 404

# Health check for the all-in-one server
@vg_app.route('/health')
def health_check():
    """Combined health check"""
    return jsonify({
        'status': 'healthy',
        'version': '1.0.0',
        'mode': 'all-in-one',
        'api': 'available',
        'interface': 'available',
        'py_manager_path': vg_py_manager_path
    })

@vg_app.route('/<path:filename>')
def serve_any_static(filename):
    """Catch-all for any static files"""
    vf_file_path = os.path.join(vg_py_manager_path, filename)
    if os.path.exists(vf_file_path):
        return send_file(vf_file_path)
    else:
        # Try without ./ prefix
        if filename.startswith('./'):
            vf_file_path = os.path.join(vg_py_manager_path, filename[2:])
            if os.path.exists(vf_file_path):
                return send_file(vf_file_path)
        return f"File not found: {filename}", 404

@vg_app.route('/debug')
def debug_info():
    """Debug endpoint to check paths"""
    import json
    return json.dumps({
        'py_manager_path': vg_py_manager_path,
        'files': os.listdir(vg_py_manager_path),
        'routes': [str(rule) for rule in vg_app.url_map.iter_rules()],
        'current_dir': os.getcwd()
    }, indent=2)

def vf_start_all_in_one():
    """Start the all-in-one server"""
    
    print("="*60)
    print("Python Manager - All-in-One Server")
    print("="*60)
    
    # Check if py_manager directory exists
    if not os.path.exists(vg_py_manager_path):
        print(f"ERROR: py_manager directory not found at: {vg_py_manager_path}")
        return
    
    # Check if required files exist
    required_files = ['py_manager.html', 'py_manager.css', 'py_interface.js']
    for file in required_files:
        file_path = os.path.join(vg_py_manager_path, file)
        if not os.path.exists(file_path):
            print(f"ERROR: Required file not found: {file_path}")
        else:
            print(f"✓ Found: {file}")
    
    # Load configurations
    if not py_process.vf_load_config():
        print("Failed to load process configuration!")
        return
    
    print("✓ Configuration loaded")
    
    # Start the process monitor thread
    vf_monitor_thread = threading.Thread(target=py_process.vf_monitor_processes)
    vf_monitor_thread.daemon = True
    vf_monitor_thread.start()
    print("✓ Process monitor started")
    
    # Start status update thread for WebSocket
    vf_update_thread = threading.Thread(target=vf_status_update_loop)
    vf_update_thread.daemon = True
    vf_update_thread.start()
    print("✓ WebSocket updater started")
    
    # Log startup
    py_logger.vf_write_manager_log('INFO', 'All-in-one server started')
    
    # List all routes for debugging
    print("\nRegistered routes:")
    for rule in vg_app.url_map.iter_rules():
        print(f"  {rule.rule}")
    
    print("\n" + "="*60)
    print("Server is ready!")
    print("="*60)
    print(f"\n→ Web Interface: http://localhost:5000/")
    print(f"→ API Endpoint:  http://localhost:5000/api/")
    print(f"→ Health Check:  http://localhost:5000/health")
    print(f"\nPress Ctrl+C to stop the server")
    print("="*60 + "\n")
    
    # Run the Flask app with SocketIO
    try:
        vg_socketio.run(
            vg_app,
            host='0.0.0.0',
            port=55000,
            debug=False,
            use_reloader=False,  # Disable reloader to prevent double startup
            log_output=True,      # Enable logging to see requests
            allow_unsafe_werkzeug=True # Allow unsafe werkzeug for PM2
        )
    except KeyboardInterrupt:
        print("\n\nShutting down...")
        py_process.vf_cleanup()
        py_logger.vf_write_manager_log('INFO', 'All-in-one server stopped')
        print("Server stopped gracefully")

if __name__ == '__main__':
    vf_start_all_in_one()
