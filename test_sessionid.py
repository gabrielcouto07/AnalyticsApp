import requests

sessionId = '1328ce03-c176-41b5-9744-85f15bac6205'
url = f'http://localhost:8001/api/charts/{sessionId}/insights'

try:
    r = requests.get(url, timeout=5)
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        data = r.json()
        print(f'Issues: {len(data.get("issues", []))}')
    else:
        print(f'Error: {r.text}')
except Exception as e:
    print(f'Exception: {e}')
