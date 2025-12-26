import time
import random
from datetime import datetime

print("Web Monitor started", flush=True)

ag_websites = [
    'example.com',
    'test-site.org', 
    'monitor-this.net'
]

vg_check_count = 0

while True:
    for vf_site in ag_websites:
        vg_check_count += 1
        vf_status = random.choice(['UP', 'UP', 'UP', 'DOWN'])  # 75% up
        vf_response_time = random.randint(50, 500) if vf_status == 'UP' else 0
        
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Check #{vg_check_count}: {vf_site} - {vf_status} ({vf_response_time}ms)", flush=True)
        
        time.sleep(1)
    
    # Wait 10 seconds before next round
    time.sleep(10)