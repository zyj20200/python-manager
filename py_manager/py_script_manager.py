#!/usr/bin/env python
"""Script management functions for Python Manager"""

import os
import json
import uuid
from pathlib import Path

# Global variable for config path
vg_config_path = os.path.join(os.path.dirname(__file__), 'config.json')

def vf_load_config():
    """Load configuration from file"""
    try:
        with open(vg_config_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading config: {e}")
        return None

def vf_save_config(vf_config):
    """Save configuration to file"""
    try:
        with open(vg_config_path, 'w') as f:
            json.dump(vf_config, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

def vf_add_script(vf_script_path, vf_name=None, vf_args=None, vf_auto_restart=True):
    """Add a new script to the configuration"""
    # Load current config
    vf_config = vf_load_config()
    if not vf_config:
        return {"success": False, "error": "Failed to load configuration"}
    
    # Validate script path
    vf_abs_path = os.path.abspath(vf_script_path)
    if not os.path.exists(vf_abs_path):
        return {"success": False, "error": f"Script not found: {vf_abs_path}"}
    
    if not vf_abs_path.endswith('.py'):
        return {"success": False, "error": "Only Python (.py) files are supported"}
    
    # Generate script ID
    vf_script_id = f"script_{uuid.uuid4().hex[:8]}"
    
    # Use filename as name if not provided
    if not vf_name:
        vf_name = os.path.basename(vf_abs_path).replace('.py', '').replace('_', ' ').title()
    
    # Create script entry
    vf_new_script = {
        "id": vf_script_id,
        "name": vf_name,
        "path": vf_abs_path,  # Use absolute path
        "args": vf_args or [],
        "auto_restart": vf_auto_restart,
        "enabled": True,
        "max_memory_mb": 512,
        "log_file": f"{vf_script_id}.log"
    }
    
    # Add to config
    vf_config['scripts'].append(vf_new_script)
    
    # Save config
    if vf_save_config(vf_config):
        return {"success": True, "script": vf_new_script}
    else:
        return {"success": False, "error": "Failed to save configuration"}

def vf_remove_script(vf_script_id):
    """Remove a script from the configuration"""
    vf_config = vf_load_config()
    if not vf_config:
        return {"success": False, "error": "Failed to load configuration"}
    
    # Find and remove script
    vf_original_count = len(vf_config['scripts'])
    vf_config['scripts'] = [s for s in vf_config['scripts'] if s['id'] != vf_script_id]
    
    if len(vf_config['scripts']) == vf_original_count:
        return {"success": False, "error": "Script not found"}
    
    # Save config
    if vf_save_config(vf_config):
        return {"success": True}
    else:
        return {"success": False, "error": "Failed to save configuration"}

def vf_update_script(vf_script_id, vf_updates):
    """Update script configuration"""
    vf_config = vf_load_config()
    if not vf_config:
        return {"success": False, "error": "Failed to load configuration"}
    
    # Find script
    vf_script_found = False
    for vf_script in vf_config['scripts']:
        if vf_script['id'] == vf_script_id:
            # Update allowed fields
            if 'name' in vf_updates:
                vf_script['name'] = vf_updates['name']
            if 'args' in vf_updates:
                vf_script['args'] = vf_updates['args']
            if 'auto_restart' in vf_updates:
                vf_script['auto_restart'] = vf_updates['auto_restart']
            if 'enabled' in vf_updates:
                vf_script['enabled'] = vf_updates['enabled']
            if 'max_memory_mb' in vf_updates:
                vf_script['max_memory_mb'] = vf_updates['max_memory_mb']
            vf_script_found = True
            break
    
    if not vf_script_found:
        return {"success": False, "error": "Script not found"}
    
    # Save config
    if vf_save_config(vf_config):
        return {"success": True}
    else:
        return {"success": False, "error": "Failed to save configuration"}

def vf_list_python_files(vf_directory):
    """List all Python files in a directory recursively"""
    vf_python_files = []
    
    try:
        vf_path = Path(vf_directory)
        if not vf_path.exists():
            return {"success": False, "error": f"Directory not found: {vf_directory}"}
        
        if not vf_path.is_dir():
            return {"success": False, "error": f"Path is not a directory: {vf_directory}"}
        
        # Limit search depth to avoid very deep recursion
        vf_max_depth = 3
        
        # Find all .py files with limited depth
        for vf_file in vf_path.rglob("*.py"):
            # Skip __pycache__ directories and check depth
            if "__pycache__" not in str(vf_file):
                try:
                    # Calculate depth
                    vf_relative = vf_file.relative_to(vf_path)
                    vf_depth = len(vf_relative.parts) - 1
                    
                    if vf_depth <= vf_max_depth:
                        vf_python_files.append({
                            "path": str(vf_file),
                            "name": vf_file.name,
                            "relative": str(vf_relative)
                        })
                except Exception:
                    # Skip files that cause issues
                    pass
        
        # Sort by relative path for better display
        vf_python_files.sort(key=lambda x: x['relative'])
        
        return {"success": True, "files": vf_python_files}
    except PermissionError:
        return {"success": False, "error": f"Permission denied: Cannot access {vf_directory}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def vf_validate_script_path(vf_path):
    """Validate if a path is a valid Python script"""
    try:
        vf_abs_path = os.path.abspath(vf_path)
        
        # Check if file exists
        if not os.path.exists(vf_abs_path):
            return {"valid": False, "error": "File not found"}
        
        # Check if it's a Python file
        if not vf_abs_path.endswith('.py'):
            return {"valid": False, "error": "Not a Python file"}
        
        # Check if readable
        if not os.access(vf_abs_path, os.R_OK):
            return {"valid": False, "error": "File not readable"}
        
        return {
            "valid": True,
            "absolute_path": vf_abs_path,
            "filename": os.path.basename(vf_abs_path),
            "directory": os.path.dirname(vf_abs_path)
        }
    except Exception as e:
        return {"valid": False, "error": str(e)}
