import requests
import json

# Upload test data
print("📤 Uploading test_data.csv...")
with open('test_data.csv', 'rb') as f:
    resp = requests.post('http://localhost:8001/api/upload', files={'file': f})

if resp.status_code != 200:
    print(f"❌ Upload failed: {resp.status_code}")
    print(resp.text)
    exit(1)

data = resp.json()
session_id = data['session_id']
print(f"✅ Session ID: {session_id}")

# Get insights
print("\n💡 Fetching insights...")
resp = requests.get(f'http://localhost:8001/api/charts/{session_id}/insights')

if resp.status_code != 200:
    print(f"❌ Insights request failed: {resp.status_code}")
    print(resp.text)
    exit(1)

insights = resp.json()
print(f"✅ Insights retrieved!")

print("\n📊 Data Quality Score:", insights['summary']['data_quality_score'])
print("📈 Total Issues:", insights['summary']['issue_count'])
print("📝 Recommendations:", len(insights['recommendations']))

print("\n🔍 Issues Found:")
for issue in insights['issues']:
    print(f"  - [{issue['severity'].upper()}] {issue['title']}")
    print(f"    → {issue['description']}")

print("\n💡 Recommendations:")
for rec in insights['recommendations']:
    print(f"  • {rec}")
