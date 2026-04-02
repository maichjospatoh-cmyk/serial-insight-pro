def clean_dataframe(df):
    # If only 1 column → split it
    if len(df.columns) == 1:
        col = df.columns[0]

        df[['agent name', 'serial number', 'date']] = df[col].str.extract(
            r'([A-Za-z\s]+)\s+(\d{10,})\s+([\d\-\/]+)'
        )

    return df

import pandas as pd
import sys
import os
from docx import Document

file1 = sys.argv[1]
file2 = sys.argv[2]

def read_file(file):
    ext = os.path.splitext(file)[1].lower()

    try:
        if ext == ".csv":
            return pd.read_csv(file)

        elif ext in [".xlsx", ".xls"]:
            return pd.read_excel(file, engine="openpyxl")

        elif ext == ".docx":
            doc = Document(file)
            data = []

            for table in doc.tables:
                for row in table.rows:
                    data.append([cell.text.strip() for cell in row.cells])

            if len(data) > 1:
                return pd.DataFrame(data[1:], columns=data[0])

            # fallback if no table
            text_data = [p.text.strip().split() for p in doc.paragraphs if p.text.strip()]
            return pd.DataFrame(text_data)

        else:
            try:
                return pd.read_excel(file, engine="openpyxl")
            except:
                return pd.read_csv(file)

    except Exception as e:
        raise Exception(f"File processing failed: {str(e)}")


df1 = clean_dataframe(read_file(file1))
df2 = clean_dataframe(read_file(file2))

df1.columns = df1.columns.str.lower()
df2.columns = df2.columns.str.lower()

def find_serial_column(df):
    for col in df.columns:
        col_lower = col.lower()
        if 'serial' in col_lower:
            return col
    raise Exception("No serial column found")

serial_col1 = find_serial_column(df1)
serial_col2 = find_serial_column(df2)

df1 = df1.rename(columns={serial_col1: 'serial number'})
df2 = df2.rename(columns={serial_col2: 'serial number'})

merged = pd.merge(df1, df2, on='serial number', how='outer')

def find_agent_column(df):
    for col in df.columns:
        col_lower = col.lower()
        if 'agent' in col_lower or 'name' in col_lower:
            return col
    return None

agent_col1 = find_agent_column(df1)
agent_col2 = find_agent_column(df2)

if agent_col1:
    df1 = df1.rename(columns={agent_col1: 'agent name'})
if agent_col2:
    df2 = df2.rename(columns={agent_col2: 'agent name'})

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
merged.head(20).to_html("preview.html", index=False)
