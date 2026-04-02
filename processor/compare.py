import pandas as pd
import sys

file1 = sys.argv[1]
file2 = sys.argv[2]

df1 = pd.read_excel(file1)
df2 = pd.read_excel(file2)

df1.columns = df1.columns.str.lower()
df2.columns = df2.columns.str.lower()

merged = pd.merge(df1, df2, on='serial number', how='outer')

merged['duplicate_per_agent'] = merged.duplicated(subset=['serial number', 'agent name'], keep=False)
merged['missing_agent'] = merged['agent name'].isna()

def classify(row):
    if row['missing_agent']:
        return 'Non-Quality - Missing Agent'
    elif row['duplicate_per_agent']:
        return 'Non-Quality - Duplicate'
    else:
        return 'Valid'

merged['status'] = merged.apply(classify, axis=1)

merged.to_excel("output.xlsx", index=False)
