import requests
import json

# First, upload the file
print("Uploading TesteAppComissoes1.xlsx...")
with open('TesteAppComissoes1.xlsx', 'rb') as f:
    response = requests.post('http://localhost:8001/api/upload', files={'file': f})
    data = response.json()
    session_id = data.get('session_id')
    print(f"Session created: {session_id}")
    print(f"File: {data.get('filename')}, {data.get('rows')} rows, {data.get('columns')} columns\n")
    
    # Now get insights
    print("Fetching insights...")
    insights_response = requests.get(f'http://localhost:8001/api/charts/{session_id}/insights')
    if insights_response.status_code == 200:
        insights = insights_response.json()
        print(f"✓ Success!")
        print(f"Data Quality Score: {insights['summary']['data_quality_score']}")
        print(f"Total Issues: {insights['summary']['issue_count']}")
        print(f"\nIssues detected:")
        if insights['issues']:
            for i, issue in enumerate(insights['issues'][:5], 1):
                print(f"  {i}. [{issue['severity'].upper()}] {issue['title']}")
                print(f"     Column: {issue.get('column', 'N/A')}, Metric: {issue.get('metric', 'N/A')}")
        else:
            print("  No issues found")
        print(f"\nRecommendations:")
        for i, rec in enumerate(insights['recommendations'][:3], 1):
            print(f"  {i}. {rec}")
    else:
        print(f"Error: {insights_response.status_code}")
        print(insights_response.text)
