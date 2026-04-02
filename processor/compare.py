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


df1 = read_file(file1)
df2 = read_file(file2)

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
merged.head(20).to_html("preview.html", index=False)
