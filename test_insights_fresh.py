import requests

sessionId = 'c807e35c-8785-4f66-b6c4-57b5cef873ac'
url = f'http://localhost:8001/api/charts/{sessionId}/insights'

try:
    r = requests.get(url, timeout=10)
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        data = r.json()
        print(f'Issues: {len(data.get("issues", []))}')
        print(f'Quality Score: {data.get("summary", {}).get("data_quality_score")}')
    else:
        print(f'Error: {r.text}')
except Exception as e:
    print(f'Exception: {e}')
