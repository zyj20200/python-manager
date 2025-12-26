#!/usr/bin/env python
"""
Create a portable package of Python Manager
"""

import os
import sys
import zipfile
import json
from datetime import datetime

def vf_create_package():
    """Create a portable zip package"""
    print("Creating portable Python Manager package...")
    
    # Get source directory
    vg_source_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Create package name with timestamp
    vg_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    vg_package_name = f"python_manager_portable_{vg_timestamp}.zip"
    vg_package_path = os.path.join(vg_source_dir, 'deploy', vg_package_name)
    
    # Files to include
    vg_files_to_include = {
        # Root files
        'start_manager.py': 'start_manager.py',
        'allin1.py': 'allin1.py',
        'api_server.py': 'api_server.py',
        'web_server.py': 'web_server.py',
        'manager.py': 'manager.py',
        'requirements.txt': 'requirements.txt',
        'readme.md': 'README.md',
        
        # py_manager files
        'py_manager/py_api.py': 'py_manager/py_api.py',
        'py_manager/py_process.py': 'py_manager/py_process.py',
        'py_manager/py_logger.py': 'py_manager/py_logger.py',
        'py_manager/py_manager.py': 'py_manager/py_manager.py',
        'py_manager/py_script_manager.py': 'py_manager/py_script_manager.py',
        'py_manager/py_manager.html': 'py_manager/py_manager.html',
        'py_manager/py_interface.js': 'py_manager/py_interface.js',
        'py_manager/py_manager.css': 'py_manager/py_manager.css',
        'py_manager/api_config.json': 'py_manager/api_config.json',
        'py_manager/__init__.py': 'py_manager/__init__.py',
        
        # Deployment scripts
        'deploy/setup.py': 'setup.py'
    }
    
    # Create zip file
    with zipfile.ZipFile(vg_package_path, 'w', zipfile.ZIP_DEFLATED) as vf_zip:
        # Add files
        for vf_source, vf_dest in vg_files_to_include.items():
            vf_full_source = os.path.join(vg_source_dir, vf_source)
            if os.path.exists(vf_full_source):
                vf_zip.write(vf_full_source, vf_dest)
                print(f"  ✓ Added: {vf_dest}")
        
        # Create empty config.json
        vg_empty_config = {
            "manager_settings": {
                "port": 8080,
                "log_retention_days": 7,
                "check_interval_seconds": 5,
                "auto_restart_max_attempts": 3,
                "auto_restart_delay_seconds": 10
            },
            "scripts": []
        }
        vf_zip.writestr('py_manager/config.json', json.dumps(vg_empty_config, indent=2))
        print("  ✓ Added: py_manager/config.json (empty)")
        
        # Create directory placeholders
        vf_zip.writestr('scripts/.placeholder', '')
        vf_zip.writestr('logs/.placeholder', '')
        vf_zip.writestr('py_manager/logs/.placeholder', '')
        print("  ✓ Added: directory placeholders")
        
        # Add quick start guide
        vg_quickstart = """Python Manager - Quick Start Guide
=================================

1. Extract this archive to your desired location
2. Install requirements: pip install -r requirements.txt
3. Run: python start_manager.py
4. Open browser to: http://localhost:5000

Or use the setup script for guided installation:
python setup.py

Features:
- Add Python scripts from ANY folder on your system
- Monitor and control multiple scripts from one interface
- View centralized logs
- Auto-restart on failure
- REST API for automation

For more information, see README.md
"""
        vf_zip.writestr('QUICKSTART.txt', vg_quickstart)
        print("  ✓ Added: QUICKSTART.txt")
    
    print(f"\n✓ Package created: {vg_package_name}")
    print(f"  Size: {os.path.getsize(vg_package_path) / 1024:.1f} KB")
    print(f"  Location: {vg_package_path}")
    
    return vg_package_path

def vf_create_installer_script():
    """Create a simple installer script to include in the package"""
    vg_installer_content = '''#!/usr/bin/env python
"""
Quick installer for Python Manager
"""

import subprocess
import sys
import os

print("Python Manager Quick Installer")
print("="*30)

# Install requirements
print("\\nInstalling requirements...")
subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])

print("\\n✓ Installation complete!")
print("\\nTo start Python Manager, run:")
print("  python start_manager.py")
print("\\nThen open: http://localhost:5000")
'''
    
    vg_installer_path = os.path.join(os.path.dirname(__file__), 'quick_install.py')
    with open(vg_installer_path, 'w') as f:
        f.write(vg_installer_content)
    
    return vg_installer_path

if __name__ == '__main__':
    # Create installer first
    vf_installer = vf_create_installer_script()
    
    # Create package
    vf_package = vf_create_package()
    
    # Clean up installer
    if os.path.exists(vf_installer):
        os.remove(vf_installer)
    
    print("\nPackage ready for distribution!")
