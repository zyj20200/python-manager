#!/usr/bin/env python
"""
Python Manager Setup Script
Easily deploy Python Manager to your project
"""

import os
import sys
import shutil
import json
import subprocess

def vf_print_header():
    """Print setup header"""
    print("""
╔══════════════════════════════════════════════╗
║       Python Manager Setup & Deployment      ║
╚══════════════════════════════════════════════╝
    """)

def vf_check_requirements():
    """Check if required packages are installed"""
    vg_required = ['flask', 'flask-socketio', 'flask-cors', 'psutil']
    vg_missing = []
    
    for vf_package in vg_required:
        try:
            __import__(vf_package.replace('-', '_'))
        except ImportError:
            vg_missing.append(vf_package)
    
    if vg_missing:
        print(f"Missing required packages: {', '.join(vg_missing)}")
        vf_install = input("Install missing packages? (y/n): ").lower()
        if vf_install == 'y':
            subprocess.check_call([sys.executable, '-m', 'pip', 'install'] + vg_missing)
        else:
            print("Setup cancelled. Please install required packages manually.")
            sys.exit(1)
    
    print("✓ All requirements satisfied")

def vf_get_deployment_path():
    """Get the deployment path from user"""
    print("\nWhere would you like to install Python Manager?")
    print("1. Current directory")
    print("2. Custom path")
    
    vf_choice = input("\nChoice (1-2): ").strip()
    
    if vf_choice == '1':
        return os.getcwd()
    elif vf_choice == '2':
        vf_path = input("Enter path: ").strip()
        if not os.path.exists(vf_path):
            vf_create = input(f"Path '{vf_path}' doesn't exist. Create it? (y/n): ").lower()
            if vf_create == 'y':
                os.makedirs(vf_path, exist_ok=True)
            else:
                print("Setup cancelled.")
                sys.exit(1)
        return vf_path
    else:
        print("Invalid choice.")
        sys.exit(1)

def vf_copy_files(vf_source_dir, vf_target_dir):
    """Copy Python Manager files to target directory"""
    print(f"\nCopying files to {vf_target_dir}...")
    
    # Create py_manager directory
    vf_py_manager_target = os.path.join(vf_target_dir, 'py_manager')
    os.makedirs(vf_py_manager_target, exist_ok=True)
    
    # Files to copy
    vg_root_files = [
        'start_manager.py',
        'allin1.py',
        'api_server.py',
        'web_server.py',
        'manager.py',
        'requirements.txt'
    ]
    
    vg_py_manager_files = [
        'py_api.py',
        'py_process.py',
        'py_logger.py',
        'py_manager.py',
        'py_script_manager.py',
        'py_manager.html',
        'py_interface.js',
        'py_manager.css',
        'api_config.json',
        '__init__.py'
    ]
    
    # Note: socket.io.min.js is loaded from CDN in HTML
    
    # Copy root files
    for vf_file in vg_root_files:
        vf_source = os.path.join(vf_source_dir, vf_file)
        vf_dest = os.path.join(vf_target_dir, vf_file)
        if os.path.exists(vf_source):
            shutil.copy2(vf_source, vf_dest)
            print(f"  ✓ {vf_file}")
    
    # Copy py_manager files
    for vf_file in vg_py_manager_files:
        vf_source = os.path.join(vf_source_dir, 'py_manager', vf_file)
        vf_dest = os.path.join(vf_py_manager_target, vf_file)
        if os.path.exists(vf_source):
            shutil.copy2(vf_source, vf_dest)
            print(f"  ✓ py_manager/{vf_file}")
    
    # Create necessary directories
    os.makedirs(os.path.join(vf_target_dir, 'scripts'), exist_ok=True)
    os.makedirs(os.path.join(vf_target_dir, 'logs'), exist_ok=True)
    os.makedirs(os.path.join(vf_py_manager_target, 'logs'), exist_ok=True)
    
    print("\n✓ Files copied successfully")

def vf_create_initial_config(vf_target_dir):
    """Create initial configuration"""
    print("\nCreating initial configuration...")
    
    vf_config_path = os.path.join(vf_target_dir, 'py_manager', 'config.json')
    
    vg_initial_config = {
        "manager_settings": {
            "port": 8080,
            "log_retention_days": 7,
            "check_interval_seconds": 5,
            "auto_restart_max_attempts": 3,
            "auto_restart_delay_seconds": 10
        },
        "scripts": []
    }
    
    # Ask if user wants to add scripts now
    vf_add_scripts = input("\nWould you like to add Python scripts now? (y/n): ").lower()
    
    if vf_add_scripts == 'y':
        while True:
            print("\nAdd a Python script (leave path empty to finish):")
            vf_path = input("Script path: ").strip()
            
            if not vf_path:
                break
            
            if not os.path.exists(vf_path):
                print(f"Warning: Script not found at {vf_path}")
                vf_continue = input("Add anyway? (y/n): ").lower()
                if vf_continue != 'y':
                    continue
            
            vf_name = input("Display name (optional): ").strip()
            if not vf_name:
                vf_name = os.path.basename(vf_path).replace('.py', '').replace('_', ' ').title()
            
            vf_script_id = f"script_{len(vg_initial_config['scripts']) + 1}"
            
            vg_initial_config['scripts'].append({
                "id": vf_script_id,
                "name": vf_name,
                "path": os.path.abspath(vf_path),
                "args": [],
                "auto_restart": True,
                "enabled": True,
                "max_memory_mb": 512,
                "log_file": f"{vf_script_id}.log"
            })
            
            print(f"✓ Added: {vf_name}")
    
    # Save config
    with open(vf_config_path, 'w') as f:
        json.dump(vg_initial_config, f, indent=2)
    
    print("\n✓ Configuration created")

def vf_create_shortcuts(vf_target_dir):
    """Create convenient shortcuts"""
    print("\nCreating shortcuts...")
    
    # Create a simple batch file for Windows
    if sys.platform == 'win32':
        vf_batch_content = f"""@echo off
cd /d "{vf_target_dir}"
python start_manager.py
pause
"""
        vf_batch_path = os.path.join(vf_target_dir, 'Start_Python_Manager.bat')
        with open(vf_batch_path, 'w') as f:
            f.write(vf_batch_content)
        print(f"  ✓ Created: Start_Python_Manager.bat")
    
    # Create a shell script for Unix-like systems
    else:
        vf_shell_content = f"""#!/bin/bash
cd "{vf_target_dir}"
python3 start_manager.py
"""
        vf_shell_path = os.path.join(vf_target_dir, 'start_python_manager.sh')
        with open(vf_shell_path, 'w') as f:
            f.write(vf_shell_content)
        os.chmod(vf_shell_path, 0o755)
        print(f"  ✓ Created: start_python_manager.sh")

def vf_print_instructions(vf_target_dir):
    """Print usage instructions"""
    print(f"""
╔══════════════════════════════════════════════╗
║            Setup Complete! ✓                 ║
╚══════════════════════════════════════════════╝

Python Manager has been installed to:
{vf_target_dir}

To start Python Manager:
""")
    
    if sys.platform == 'win32':
        print(f"  1. Double-click: Start_Python_Manager.bat")
        print(f"  2. Or run: python {os.path.join(vf_target_dir, 'start_manager.py')}")
    else:
        print(f"  1. Run: ./start_python_manager.sh")
        print(f"  2. Or run: python3 {os.path.join(vf_target_dir, 'start_manager.py')}")
    
    print("""
Once started, access the web interface at:
http://localhost:5000

Features:
✓ Add scripts from anywhere on your system
✓ Monitor CPU and memory usage
✓ View centralized logs
✓ Auto-restart on failure
✓ REST API for automation

Managing Scripts:
1. Click "Manage Scripts" in the web interface
2. Browse or enter paths to Python scripts
3. Scripts can be from ANY folder on your system
4. Configure auto-restart and arguments as needed

Happy managing!
""")

def vf_main():
    """Main setup function"""
    vf_print_header()
    
    # Get source directory (where this script is)
    vg_source_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Check requirements
    vf_check_requirements()
    
    # Get deployment path
    vg_target_dir = vf_get_deployment_path()
    
    # Copy files
    vf_copy_files(vg_source_dir, vg_target_dir)
    
    # Create initial config
    vf_create_initial_config(vg_target_dir)
    
    # Create shortcuts
    vf_create_shortcuts(vg_target_dir)
    
    # Print instructions
    vf_print_instructions(vg_target_dir)
    
    # Ask if user wants to start now
    vf_start_now = input("\nStart Python Manager now? (y/n): ").lower()
    if vf_start_now == 'y':
        os.chdir(vg_target_dir)
        subprocess.run([sys.executable, 'start_manager.py'])

if __name__ == '__main__':
    vf_main()
