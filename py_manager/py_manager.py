import os
import sys
import time
import threading

# Import from same package
import py_process
import py_logger

# Global variables
vg_running = True
vg_monitor_thread = None

def vf_monitor_loop():
    """Background thread for monitoring processes"""
    while vg_running:
        py_process.vf_monitor_processes()
        time.sleep(py_process.vg_config['manager_settings']['check_interval_seconds'])

def vf_print_status():
    """Print current status of all scripts"""
    print("\n" + "="*60)
    print("Python Script Manager - Status")
    print("="*60)
    
    ag_status = py_process.vf_get_all_status()
    
    for vf_script in ag_status:
        print(f"\nScript: {vf_script['name']} (ID: {vf_script['id']})")
        print(f"  Status: {vf_script['status']}")
        print(f"  Enabled: {vf_script['enabled']}")
        
        if vf_script['status'] == 'running':
            print(f"  PID: {vf_script['pid']}")
            print(f"  CPU: {vf_script['cpu_percent']:.1f}%")
            print(f"  Memory: {vf_script['memory_mb']:.1f} MB")
            print(f"  Start Time: {vf_script['start_time']}")
        elif vf_script.get('restart_attempts', 0) > 0:
            print(f"  Restart Attempts: {vf_script['restart_attempts']}")
    
    print("\n" + "="*60)

def vf_show_menu():
    """Display interactive menu"""
    print("\nCommands:")
    print("  1. Start script")
    print("  2. Stop script")
    print("  3. Restart script")
    print("  4. Show status")
    print("  5. View logs")
    print("  6. Reload config")
    print("  0. Exit")
    print("")

def vf_select_script():
    """Let user select a script from list"""
    ag_scripts = py_process.vg_config['scripts']
    
    print("\nAvailable scripts:")
    for vf_idx, vf_script in enumerate(ag_scripts):
        print(f"  {vf_idx + 1}. {vf_script['name']} ({vf_script['id']})")
    
    try:
        vf_choice = int(input("\nSelect script number: ")) - 1
        if 0 <= vf_choice < len(ag_scripts):
            return ag_scripts[vf_choice]['id']
    except ValueError:
        pass
    
    print("Invalid selection")
    return None

def vf_main():
    """Main interactive loop"""
    global vg_running, vg_monitor_thread
    
    print("Python Script Manager Starting...")
    
    # Load configuration
    if not py_process.vf_load_config():
        print("Failed to load configuration!")
        return
    
    # Start monitor thread
    vg_monitor_thread = threading.Thread(target=vf_monitor_loop)
    vg_monitor_thread.daemon = True
    vg_monitor_thread.start()
    
    # Log startup
    py_logger.vf_write_manager_log('INFO', 'Manager started')
    
    # Initial status
    vf_print_status()
    
    # Interactive loop
    while vg_running:
        vf_show_menu()
        
        try:
            vf_choice = input("Enter command: ").strip()
            
            if vf_choice == '0':
                vg_running = False
                break
                
            elif vf_choice == '1':  # Start
                vf_script_id = vf_select_script()
                if vf_script_id:
                    vf_result = py_process.vf_start_script(vf_script_id)
                    print(f"Result: {vf_result}")
                    py_logger.vf_write_manager_log('INFO', f"Start command: {vf_result}", vf_script_id)
                    
            elif vf_choice == '2':  # Stop
                vf_script_id = vf_select_script()
                if vf_script_id:
                    vf_result = py_process.vf_stop_script(vf_script_id)
                    print(f"Result: {vf_result}")
                    py_logger.vf_write_manager_log('INFO', f"Stop command: {vf_result}", vf_script_id)
                    
            elif vf_choice == '3':  # Restart
                vf_script_id = vf_select_script()
                if vf_script_id:
                    vf_result = py_process.vf_restart_script(vf_script_id)
                    print(f"Result: {vf_result}")
                    py_logger.vf_write_manager_log('INFO', f"Restart command: {vf_result}", vf_script_id)
                    
            elif vf_choice == '4':  # Status
                vf_print_status()
                
            elif vf_choice == '5':  # View logs
                print("\nLog options:")
                print("  1. Manager logs")
                print("  2. Script logs")
                
                vf_log_choice = input("Select: ").strip()
                
                if vf_log_choice == '1':
                    ag_logs = py_logger.vf_read_recent_logs(None, 20)
                    print("\nRecent Manager Logs:")
                    for vf_line in ag_logs:
                        print(f"  {vf_line}")
                        
                elif vf_log_choice == '2':
                    vf_script_id = vf_select_script()
                    if vf_script_id:
                        ag_logs = py_logger.vf_read_recent_logs(vf_script_id, 20)
                        print(f"\nRecent logs for {vf_script_id}:")
                        for vf_line in ag_logs:
                            print(f"  {vf_line}")
                            
            elif vf_choice == '6':  # Reload config
                if py_process.vf_load_config():
                    print("Configuration reloaded successfully")
                else:
                    print("Failed to reload configuration")
                    
            else:
                print("Invalid command")
                
        except KeyboardInterrupt:
            print("\nUse '0' to exit properly")
        except Exception as vf_error:
            print(f"Error: {vf_error}")
            py_logger.vf_write_manager_log('ERROR', str(vf_error))
    
    # Cleanup
    print("\nShutting down...")
    py_process.vf_cleanup()
    py_logger.vf_write_manager_log('INFO', 'Manager stopped')

if __name__ == "__main__":
    vf_main()