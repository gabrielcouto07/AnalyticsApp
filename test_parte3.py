"""
Tests for PARTE 3 - Ranking and Explorer endpoints
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8000"
UPLOAD_URL = f"{BASE_URL}/api/upload"
RANKING_URL = f"{BASE_URL}/api/charts"
EXPLORER_URL = f"{BASE_URL}/api/charts"

def upload_test_file():
    """Upload test file and get session_id"""
    print("📤 Uploading test file...")
    with open("test_data.csv", "rb") as f:
        files = {"file": f}
        resp = requests.post(UPLOAD_URL, files=files)
    
    if resp.status_code != 200:
        print(f"❌ Upload failed: {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    session_id = data["session_id"]
    print(f"✅ Uploaded. Session: {session_id}")
    return session_id, data

def test_ranking(session_id, column, top_n=5):
    """Test ranking endpoint"""
    print(f"\n📊 Testing RANKING endpoint...")
    print(f"   Column: {column}, Top N: {top_n}")
    
    url = f"{RANKING_URL}/{session_id}/ranking/{column}?top_n={top_n}"
    try:
        resp = requests.post(url)
        if resp.status_code != 200:
            print(f"❌ Ranking failed: {resp.text}")
            return False
        
        data = resp.json()
        print(f"✅ Ranking Success!")
        print(f"   - Rankings: {len(data.get('rankings', []))} items")
        
        stats = data.get("statistics", {})
        print(f"   - Distinct Values: {stats.get('distinct_values')}")
        print(f"   - Most Frequent: {stats.get('most_frequent')}")
        print(f"   - Most Frequent %: {stats.get('most_frequent_percentage')}%")
        print(f"   - Total Records: {stats.get('total_records')}")
        print(f"   - Null Values: {stats.get('null_count')}")
        
        if data.get("rankings"):
            print(f"\n   Top 3 Rankings:")
            for rank in data["rankings"][:3]:
                print(f"      #{rank['rank']}: {rank['value']} ({rank['count']}, {rank['percentage']}%)")
        
        return True
    except Exception as e:
        print(f"❌ Ranking error: {e}")
        return False

def test_explorer(session_id, x_col, y_col):
    """Test explorer endpoint"""
    print(f"\n📈 Testing EXPLORER endpoint...")
    print(f"   X-Axis: {x_col}, Y-Axis: {y_col}")
    
    url = f"{EXPLORER_URL}/{session_id}/explorer"
    payload = {"x_column": x_col, "y_column": y_col}
    
    try:
        resp = requests.post(url, json=payload)
        if resp.status_code != 200:
            print(f"❌ Explorer failed: {resp.text}")
            return False
        
        data = resp.json()
        print(f"✅ Explorer Success!")
        
        stats = data.get("statistics", {})
        print(f"   - Correlation: {stats.get('correlation')}")
        print(f"   - R²: {stats.get('r_squared')}")
        print(f"   - Points: {stats.get('count')}")
        print(f"   - Outliers: {stats.get('outliers_count')}")
        
        trend = stats.get("trend", {})
        print(f"   - Trend: {trend.get('equation')}")
        
        scatter_data = data.get("scatter_data", [])
        print(f"   - Scatter Points: {len(scatter_data)}")
        
        if scatter_data:
            print(f"\n   First 3 Points:")
            for i, point in enumerate(scatter_data[:3]):
                print(f"      {i+1}. x={point['x']:.2f}, y={point['y']:.2f}")
        
        return True
    except Exception as e:
        print(f"❌ Explorer error: {e}")
        return False

def main():
    print("🧪 PARTE 3 TEST SUITE")
    print("=" * 50)
    
    # Upload test file
    session_id, upload_data = upload_test_file()
    
    # Column types from upload response
    print("\n📋 Using column types from upload...")
    col_types = upload_data.get("col_types", {})
    
    print(f"   Categorical: {col_types.get('categorical', [])}")
    print(f"   Numeric: {col_types.get('numeric', [])}")
    print(f"   Temporal: {col_types.get('temporal', [])}")
    
    # Test RANKING with categorical columns
    categorical_cols = col_types.get("categorical", [])
    numeric_cols = col_types.get("numeric", [])
    
    results = {"ranking": False, "explorer": False}
    
    if categorical_cols:
        for col in categorical_cols:
            success = test_ranking(session_id, col, top_n=10)
            if success:
                results["ranking"] = True
    else:
        print("\n⚠️ No categorical columns found for ranking test")
    
    # Test EXPLORER with numeric columns
    if len(numeric_cols) >= 2:
        success = test_explorer(session_id, numeric_cols[0], numeric_cols[1])
        if success:
            results["explorer"] = True
    else:
        print(f"\n⚠️ Need at least 2 numeric columns for explorer test (found {len(numeric_cols)})")
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    print(f"Ranking: {'✅ PASS' if results['ranking'] else '❌ FAIL'}")
    print(f"Explorer: {'✅ PASS' if results['explorer'] else '❌ FAIL'}")
    
    all_pass = all(results.values())
    print(f"\nOverall: {'✅ ALL TESTS PASSED' if all_pass else '❌ SOME TESTS FAILED'}")
    
    return 0 if all_pass else 1

if __name__ == "__main__":
    sys.exit(main())
