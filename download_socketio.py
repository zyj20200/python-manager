#!/usr/bin/env python
"""
Download Socket.IO client library for offline use
"""

import urllib.request
import os
import sys

def vf_download_socketio():
    """Download Socket.IO from CDN"""
    # Updated to use the reliable cdnjs URL
    vg_url = "https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js"
    vg_target_dir = os.path.join(os.path.dirname(__file__), 'py_manager')
    vg_target_file = os.path.join(vg_target_dir, 'socket.io.min.js')
    
    print("Downloading Socket.IO client library...")
    print(f"From: {vg_url}")
    print(f"To: {vg_target_file}")
    
    try:
        # Create directory if it doesn't exist
        os.makedirs(vg_target_dir, exist_ok=True)
        
        # Download the file
        urllib.request.urlretrieve(vg_url, vg_target_file)
        
        # Check file size
        vg_size = os.path.getsize(vg_target_file)
        print(f"\n✓ Downloaded successfully! ({vg_size:,} bytes)")
        print("\nSocket.IO is now available for offline use.")
        print("\nNote: Socket.IO is MIT licensed and can be freely distributed.")
        
    except Exception as e:
        print(f"\n✗ Error downloading Socket.IO: {e}")
        print("\nYou can manually download it from:")
        print(vg_url)
        print(f"\nAnd save it as: {vg_target_file}")
        return False
    
    return True

if __name__ == "__main__":
    print("Python Manager - Socket.IO Downloader")
    print("="*40)
    print("\nThis will download Socket.IO for offline use.")
    print("The application will work without this, but WebSocket")
    print("connections will fall back to polling mode.\n")
    
    vf_confirm = input("Download Socket.IO? (y/n): ").lower()
    
    if vf_confirm == 'y':
        if vf_download_socketio():
            print("\nSetup complete!")
        else:
            sys.exit(1)
    else:
        print("\nSkipped. The application will use Socket.IO from CDN.")
