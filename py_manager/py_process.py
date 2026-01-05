import subprocess
import psutil
import json
import os
import sys
import time
import signal
from datetime import datetime
import threading
import re

# Global variables
vg_processes = {}  # Dictionary to store running processes
vg_config = None   # Configuration data
vg_restart_attempts = {}  # Track restart attempts
vg_log_callback = None # Callback for log updates

# Fix path for script execution
vg_base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def vf_set_log_callback(callback):
    """Set callback for log updates"""
    global vg_log_callback
    vg_log_callback = callback

def vf_strip_ansi(text):
    """Remove ANSI escape sequences from text"""
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text)

def vf_log_worker(pipe, log_file, script_id):
    """Read from pipe and write to log file"""
    try:
        for line in pipe:
            # clean_line = vf_strip_ansi(line)
            log_file.write(line)
            log_file.flush()
            
            # Emit log update if callback is set
            if vg_log_callback:
                try:
                    vg_log_callback(script_id, line)
                except Exception:
                    pass
                    
    except ValueError:
        pass  # File likely closed
    except Exception as e:
        print(f"Log worker error: {e}")

def vf_load_config():
    """Load configuration from config.json"""
    global vg_config
    vf_config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    
    try:
        with open(vf_config_path, 'r') as vf_file:
            vg_config = json.load(vf_file)
            return True
    except Exception as vf_error:
        print(f"Error loading config: {vf_error}")
        return False

def vf_start_script(vf_script_id):
    """Start a Python script by its ID"""
    global vg_processes
    
    # Find script configuration
    vf_script_config = None
    for vf_script in vg_config['scripts']:
        if vf_script['id'] == vf_script_id:
            vf_script_config = vf_script
            break
    
    if not vf_script_config:
        return {"success": False, "error": "Script ID not found"}
    
    if not vf_script_config['enabled']:
        return {"success": False, "error": "Script is disabled"}
    
    # Check if already running
    if vf_script_id in vg_processes and vf_is_process_running(vf_script_id):
        return {"success": False, "error": "Script already running"}
    
    # Prepare command with proper path handling
    vf_script_path = vf_script_config['path']
    
    # Check if it's an absolute path
    if not os.path.isabs(vf_script_path):
        # If relative, join with base path
        vf_script_path = os.path.join(vg_base_path, vf_script_path)
    
    # Check if script exists
    if not os.path.exists(vf_script_path):
        return {"success": False, "error": f"Script not found: {vf_script_path}"}
    
    # Determine python executable
    vf_python_executable = sys.executable
    if vf_script_config.get('interpreter'):
        vf_python_executable = vf_script_config['interpreter']
    
    vf_cmd = [vf_python_executable, vf_script_path]
    if vf_script_config.get('args'):
        vf_cmd.extend(vf_script_config['args'])
    
    # Prepare log file
    vf_log_dir = os.path.join(os.path.dirname(__file__), 'logs')
    os.makedirs(vf_log_dir, exist_ok=True)
    
    vf_log_path = os.path.join(vf_log_dir, vf_script_config['log_file'])
    vf_log_file = open(vf_log_path, 'a', encoding='utf-8')
    
    try:
        # Start process with proper working directory
        # Use script's directory as working directory for absolute paths
        vf_working_dir = os.path.dirname(vf_script_path) if os.path.isabs(vf_script_config['path']) else vg_base_path
        
        # Prepare environment variables to force color output
        vf_env = os.environ.copy()
        vf_env['PYTHONUNBUFFERED'] = '1'
        vf_env['FORCE_COLOR'] = '1'
        vf_env['LOGURU_COLORIZE'] = 'true'
        vf_env['TERM'] = 'xterm-256color'

        vf_process = subprocess.Popen(
            vf_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=vf_working_dir,  # Set working directory based on path type
            env=vf_env,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1
        )
        
        # Start log processing thread
        vf_log_thread = threading.Thread(
            target=vf_log_worker,
            args=(vf_process.stdout, vf_log_file, vf_script_id),
            daemon=True
        )
        vf_log_thread.start()
        
        # Store process info
        vg_processes[vf_script_id] = {
            'process': vf_process,
            'pid': vf_process.pid,
            'start_time': datetime.now().isoformat(),
            'log_file': vf_log_file,
            'config': vf_script_config
        }
        
        # Reset restart attempts
        vg_restart_attempts[vf_script_id] = 0
        
        return {
            "success": True, 
            "pid": vf_process.pid,
            "message": f"Script {vf_script_id} started successfully"
        }
        
    except Exception as vf_error:
        vf_log_file.close()
        return {"success": False, "error": str(vf_error)}

def vf_stop_script(vf_script_id, vf_timeout=10):
    """Stop a running Python script"""
    global vg_processes
    
    if vf_script_id not in vg_processes:
        return {"success": False, "error": "Script not in process list"}
    
    vf_process_info = vg_processes[vf_script_id]
    vf_process = vf_process_info['process']
    
    try:
        # Try graceful termination first
        vf_process.terminate()
        
        # Wait for process to terminate
        try:
            vf_process.wait(timeout=vf_timeout)
        except subprocess.TimeoutExpired:
            # Force kill if timeout
            vf_process.kill()
            vf_process.wait()
        
        # Close log file
        vf_process_info['log_file'].close()
        
        # Remove from process list
        del vg_processes[vf_script_id]
        
        return {"success": True, "message": f"Script {vf_script_id} stopped"}
        
    except Exception as vf_error:
        return {"success": False, "error": str(vf_error)}

def vf_restart_script(vf_script_id):
    """Restart a Python script"""
    vf_stop_result = vf_stop_script(vf_script_id)
    
    if vf_stop_result['success'] or 'not in process list' in str(vf_stop_result.get('error', '')):
        time.sleep(1)  # Brief pause before restart
        return vf_start_script(vf_script_id)
    
    return vf_stop_result

def vf_is_process_running(vf_script_id):
    """Check if a process is still running"""
    if vf_script_id not in vg_processes:
        return False
    
    vf_process = vg_processes[vf_script_id]['process']
    return vf_process.poll() is None

def vf_get_process_info(vf_script_id):
    """Get detailed information about a running process"""
    if vf_script_id not in vg_processes:
        return None
    
    if not vf_is_process_running(vf_script_id):
        return None
    
    vf_process_info = vg_processes[vf_script_id]
    vf_pid = vf_process_info['pid']
    
    try:
        vf_psutil_process = psutil.Process(vf_pid)
        
        return {
            'pid': vf_pid,
            'status': 'running',
            'start_time': vf_process_info['start_time'],
            'cpu_percent': vf_psutil_process.cpu_percent(interval=0.1),
            'memory_mb': vf_psutil_process.memory_info().rss / 1024 / 1024,
            'num_threads': vf_psutil_process.num_threads()
        }
    except psutil.NoSuchProcess:
        return None

def vf_monitor_processes():
    """Monitor all processes and handle auto-restarts"""
    global vg_restart_attempts
    
    ag_dead_processes = []
    
    # Check each process
    for vf_script_id in list(vg_processes.keys()):
        if not vf_is_process_running(vf_script_id):
            ag_dead_processes.append(vf_script_id)
    
    # Handle dead processes
    for vf_script_id in ag_dead_processes:
        vf_config = vg_processes[vf_script_id]['config']
        
        # Clean up dead process entry
        vg_processes[vf_script_id]['log_file'].close()
        del vg_processes[vf_script_id]
        
        # Check if auto-restart is enabled
        if vf_config.get('auto_restart', False):
            vf_max_attempts = vg_config['manager_settings']['auto_restart_max_attempts']
            vf_current_attempts = vg_restart_attempts.get(vf_script_id, 0)
            
            if vf_current_attempts < vf_max_attempts:
                print(f"Auto-restarting {vf_script_id} (attempt {vf_current_attempts + 1})")
                vg_restart_attempts[vf_script_id] = vf_current_attempts + 1
                
                # Wait before restart
                time.sleep(vg_config['manager_settings']['auto_restart_delay_seconds'])
                vf_start_script(vf_script_id)
            else:
                print(f"Max restart attempts reached for {vf_script_id}")

def vf_get_all_status():
    """Get status of all configured scripts"""
    ag_status = []

    for vf_script in vg_config['scripts']:
        vf_script_id = vf_script['id']
        vf_status = {
            'id': vf_script_id,
            'name': vf_script['name'],
            'enabled': vf_script['enabled'],
            'path': vf_script['path'],
            'group': vf_script.get('group', 'Default')
        }

        if vf_is_process_running(vf_script_id):
            vf_process_info = vf_get_process_info(vf_script_id)
            vf_status.update(vf_process_info)
        else:
            vf_status['status'] = 'stopped'
            vf_status['restart_attempts'] = vg_restart_attempts.get(vf_script_id, 0)

        ag_status.append(vf_status)

    return ag_status

def vf_cleanup():
    """Clean up all processes before exit"""
    print("Cleaning up processes...")
    
    for vf_script_id in list(vg_processes.keys()):
        vf_stop_script(vf_script_id)

# Signal handler for clean shutdown
def vf_signal_handler(vf_signum, vf_frame):
    vf_cleanup()
    exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, vf_signal_handler)
signal.signal(signal.SIGTERM, vf_signal_handler)

# Initialize configuration on module load
vf_load_config()