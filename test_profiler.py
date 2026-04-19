import pandas as pd
from backend.services.data_profiler import profile_dataset

df = pd.DataFrame({
    'col_a': [1, 2, 3, 4, 5],
    'col_b': ['a', 'b', 'c', 'd', 'e'],
    'col_c': [1.1, 2.2, 3.3, None, 5.5]
})

try:
    result = profile_dataset(df)
    print('Success!')
    print('Keys:', list(result.keys()))
except Exception as e:
    print('Error:', e)
    import traceback
    traceback.print_exc()
