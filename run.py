#!/usr/bin/env python3
"""
SafeRoute - Quick Start
Run this file to start everything!
"""

import os
import subprocess
import webbrowser
import time
import sys

def main():
    print("\n" + "="*60)
    print("🚀 SafeRoute - Starting Application")
    print("="*60)
    
    # Check if we're in the right directory
    if not os.path.exists('backend'):
        print("❌ Error: Run this from the main saferoute-hackathon folder")
        print("📁 Make sure you're in: saferoute-hackathon/")
        return
    
    # Install dependencies
    print("\n📦 Installing dependencies...")
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'])
    
    # Start backend
    print("\n🔄 Starting backend server...")
    backend = subprocess.Popen(
        [sys.executable, 'backend/app.py'],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    
    # Wait for backend to start
    time.sleep(3)
    
    # Open frontend
    print("\n🌍 Opening application in browser...")
    frontend_path = os.path.abspath('frontend/index.html')
    webbrowser.open(f'file://{frontend_path}')
    
    print("\n✅ SafeRoute is running!")
    print("📍 Backend API: http://localhost:5000")
    print("📱 Frontend: Opening in browser...")
    print("\n⚠️  Press Ctrl+C to stop the server")
    
    try:
        backend.wait()
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping server...")
        backend.terminate()
        print("✅ Goodbye!")

if __name__ == '__main__':
    main()