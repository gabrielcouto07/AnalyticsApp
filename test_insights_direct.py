#!/usr/bin/env python
import sys
import requests
import json

sys.path.insert(0, ".")

# Use the old sessionId from the browser  
session_id = "f4ca2f37-7119-495b-afef-0c6939f7b7d7"

print(f"Testing sessionId: {session_id}")
print()

# Test direct backend call
try:
    url = f"http://localhost:8001/api/charts/{session_id}/insights"
    print(f"Calling: {url}")
    
    response = requests.get(url, timeout=10)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("✓ Success!")
        print(f"Issues: {data['summary']['issue_count']}")
        print(f"Quality Score: {data['summary']['data_quality_score']}")
    else:
        print(f"❌ Error: {response.text}")
        
except Exception as e:
    print(f"❌ Exception: {e}")
