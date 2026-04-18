#!/usr/bin/env python
import sys
import os
import requests
import json

sys.path.insert(0, ".")

# Step 1: Upload file
print("Step 1: Uploading file...")
upload_url = "http://localhost:8001/api/upload"

filepath = r"c:\Users\GABRIEL.CARDOSO\Desktop\Dashboards_Project\sdfbg\AnalyticsApp\TesteAppComissoes1.xlsx"
with open(filepath, "rb") as f:
    files = {"file": f}
    upload_response = requests.post(upload_url, files=files, timeout=30)
    
print(f"Upload Status: {upload_response.status_code}")
upload_data = upload_response.json()
session_id = upload_data.get("session_id")
print(f"New sessionId: {session_id}")
print()

# Step 2: Test insights with new sessionId
print(f"Step 2: Testing insights with new sessionId...")
insights_url = f"http://localhost:8001/api/charts/{session_id}/insights"
print(f"Calling: {insights_url}")

response = requests.get(insights_url, timeout=10)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print("✓ Success!")
    print(f"Issues: {data['summary']['issue_count']}")
    print(f"Quality Score: {data['summary']['data_quality_score']}")
    print(f"Total Rows: {data['summary']['total_rows']}")
    print(f"Total Columns: {data['summary']['total_columns']}")
else:
    print(f"❌ Error: {response.text}")
