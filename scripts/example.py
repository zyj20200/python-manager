import time
import sys
import os

print(f"Example script started in: {os.getcwd()}", flush=True)
print(f"Python executable: {sys.executable}", flush=True)

vg_counter = 0
while True:
    print(f"tick {vg_counter}", flush=True)
    vg_counter += 1
    time.sleep(5)