import time
import random
import json
from datetime import datetime

print("Data Processor started", flush=True)

vg_processed_count = 0

while True:
    # Simulate data processing
    vf_data = {
        'timestamp': datetime.now().isoformat(),
        'value': random.randint(100, 1000),
        'status': 'processed'
    }
    
    vg_processed_count += 1
    
    print(f"Processed record #{vg_processed_count}: {json.dumps(vf_data)}", flush=True)
    
    # Random processing time between 2-5 seconds
    time.sleep(random.uniform(2, 5))