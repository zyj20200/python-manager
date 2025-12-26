#!/usr/bin/env python
"""Easy startup script for Python Manager"""

import sys
import os

print("""
╔══════════════════════════════════════════════╗
║          Python Manager Launcher             ║
╚══════════════════════════════════════════════╝

Choose startup mode:
1. All-in-One Server (Recommended)
2. Separate API + Web servers
3. CLI Manager only
0. Exit
""")

choice = input("Enter your choice (1-3): ").strip()

if choice == '1':
    print("\nStarting All-in-One server...")
    os.system('python allin1.py')
    
elif choice == '2':
    print("\nStarting separate servers...")
    print("Run these commands in separate terminals:")
    print("  Terminal 1: python api_server.py")
    print("  Terminal 2: python web_server.py")
    print("\nPress Enter to continue...")
    input()
    
elif choice == '3':
    print("\nStarting CLI manager...")
    os.system('python manager.py')
    
elif choice == '0':
    print("Goodbye!")
    sys.exit(0)
    
else:
    print("Invalid choice!")