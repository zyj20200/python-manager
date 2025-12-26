import time
import random
from datetime import datetime

print("Log Analyzer started", flush=True)

ag_log_types = ['INFO', 'WARNING', 'ERROR', 'DEBUG']
ag_services = ['auth', 'api', 'database', 'cache']

vg_analyzed = 0

while True:
    vg_analyzed += 1
    
    # Simulate log analysis
    vf_log_type = random.choice(ag_log_types)
    vf_service = random.choice(ag_services)
    vf_count = random.randint(1, 100)
    
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Analyzed batch #{vg_analyzed}: Found {vf_count} {vf_log_type} logs from {vf_service} service", flush=True)
    
    # Process every 3 seconds
    time.sleep(3)