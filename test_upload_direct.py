import requests

with open('TesteAppComissoes1.xlsx', 'rb') as f:
    files = {'file': f}
    r = requests.post('http://localhost:8001/api/upload', files=files, timeout=10)
    print(f'Status: {r.status_code}')
    print(f'Response: {r.text[:500]}')
