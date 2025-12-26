import os
import json
import datetime
from pathlib import Path

# Global variables
vg_log_dir = os.path.join(os.path.dirname(__file__), 'logs')
vg_max_log_size = 10 * 1024 * 1024  # 10MB
vg_log_retention_days = 7

def vf_ensure_log_dir():
    """Ensure log directory exists"""
    os.makedirs(vg_log_dir, exist_ok=True)
    
    # Create subdirectories for organization
    vf_today = datetime.date.today().strftime('%Y-%m-%d')
    vf_date_dir = os.path.join(vg_log_dir, vf_today)
    os.makedirs(vf_date_dir, exist_ok=True)
    
    return vf_date_dir

def vf_write_manager_log(vf_level, vf_message, vf_script_id=None):
    """Write to manager log file"""
    vf_ensure_log_dir()
    
    vf_timestamp = datetime.datetime.now().isoformat()
    vf_log_entry = {
        'timestamp': vf_timestamp,
        'level': vf_level,
        'message': vf_message
    }
    
    if vf_script_id:
        vf_log_entry['script_id'] = vf_script_id
    
    vf_log_file = os.path.join(vg_log_dir, 'manager.log')
    
    with open(vf_log_file, 'a') as vf_file:
        vf_file.write(json.dumps(vf_log_entry) + '\n')
    
    # Check if rotation needed
    vf_rotate_log_if_needed(vf_log_file)

def vf_rotate_log_if_needed(vf_log_path):
    """Rotate log file if it exceeds size limit"""
    if not os.path.exists(vf_log_path):
        return
    
    vf_size = os.path.getsize(vf_log_path)
    
    if vf_size > vg_max_log_size:
        vf_timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        vf_rotated_name = f"{vf_log_path}.{vf_timestamp}"
        os.rename(vf_log_path, vf_rotated_name)
        
        # Log rotation event
        vf_write_manager_log('INFO', f'Log rotated: {os.path.basename(vf_rotated_name)}')

def vf_cleanup_old_logs():
    """Remove logs older than retention period"""
    vf_cutoff_date = datetime.date.today() - datetime.timedelta(days=vg_log_retention_days)
    
    for vf_root, vf_dirs, vf_files in os.walk(vg_log_dir):
        # Check date directories
        for vf_dir in vf_dirs:
            try:
                vf_dir_date = datetime.datetime.strptime(vf_dir, '%Y-%m-%d').date()
                if vf_dir_date < vf_cutoff_date:
                    vf_dir_path = os.path.join(vf_root, vf_dir)
                    # Remove old directory and contents
                    for vf_file in os.listdir(vf_dir_path):
                        os.remove(os.path.join(vf_dir_path, vf_file))
                    os.rmdir(vf_dir_path)
                    vf_write_manager_log('INFO', f'Cleaned up old logs: {vf_dir}')
            except ValueError:
                # Not a date directory, skip
                pass

def vf_read_recent_logs(vf_script_id=None, vf_lines=100):
    """Read recent log entries"""
    ag_logs = []
    
    if vf_script_id:
        # Read specific script log
        vf_log_path = os.path.join(vg_log_dir, f"{vf_script_id}.log")
        if os.path.exists(vf_log_path):
            ag_logs = vf_read_last_lines(vf_log_path, vf_lines)
    else:
        # Read manager log
        vf_log_path = os.path.join(vg_log_dir, 'manager.log')
        if os.path.exists(vf_log_path):
            ag_logs = vf_read_last_lines(vf_log_path, vf_lines)
    
    return ag_logs

def vf_read_last_lines(vf_file_path, vf_num_lines):
    """Read last N lines from a file efficiently"""
    ag_lines = []
    
    with open(vf_file_path, 'rb') as vf_file:
        # Start from end of file
        vf_file.seek(0, 2)
        vf_file_size = vf_file.tell()
        
        vf_block_size = 1024
        vf_blocks = []
        
        while len(ag_lines) < vf_num_lines and vf_file_size > 0:
            vf_read_size = min(vf_block_size, vf_file_size)
            vf_file_size -= vf_read_size
            vf_file.seek(vf_file_size)
            
            vf_block = vf_file.read(vf_read_size)
            vf_blocks.insert(0, vf_block)
            
            ag_lines = b''.join(vf_blocks).decode('utf-8', errors='ignore').splitlines()
    
    return ag_lines[-vf_num_lines:]