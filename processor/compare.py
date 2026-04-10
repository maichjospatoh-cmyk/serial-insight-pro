import pandas as pd
import sys
import re
from openpyxl import load_workbook
from openpyxl.styles import PatternFill

file1 = sys.argv[1]
file2 = sys.argv[2]

# 🔥 SERIAL EXTRACTION (START FROM 89254021)
def extract_serial(text):
    if pd.isna(text):
        return None
    text = str(text)
    match = re.search(r'89254021\d+', text)
    return match.group(0) if match else None

def read_file(file):
    try:
        return pd.read_excel(file)
    except:
        return pd.read_csv(file, encoding='latin1')

df1 = read_file(file1)
df2 = read_file(file2)

# 🔥 EXTRACT SERIALS
df1["serial"] = df1.astype(str).apply(lambda row: extract_serial(" ".join(row)), axis=1)
df2["serial"] = df2.astype(str).apply(lambda row: extract_serial(" ".join(row)), axis=1)

df1 = df1.dropna(subset=["serial"])
df2 = df2.dropna(subset=["serial"])

# 🔥 MERGE
merged = pd.merge(df1, df2, on="serial", how="outer")

# 🔥 AGENT NAME
if "agent name" not in merged.columns:
    merged["agent name"] = "Unknown"

# 🔥 DUPLICATES
merged["duplicate_per_agent"] = merged.duplicated(subset=["agent name", "serial"], keep=False)

# 🔥 OUTPUT FILE
output_file = "output/result.xlsx"
merged.to_excel(output_file, index=False)

# 🔥 FORMAT EXCEL
wb = load_workbook(output_file)
ws = wb.active

red_fill = PatternFill(start_color="FF0000", end_color="FF0000", fill_type="solid")

# FIND COLUMN INDEX
headers = [cell.value for cell in ws[1]]
dup_index = headers.index("duplicate_per_agent") + 1

# 🔴 COLOR DUPLICATES
for row in ws.iter_rows(min_row=2):
    if row[dup_index - 1].value == True:
        for cell in row:
            cell.fill = red_fill

# 🔥 DASHBOARD SHEET
summary = {}

for row in ws.iter_rows(min_row=2, values_only=True):
    agent = row[headers.index("agent name")]
    duplicate = row[dup_index - 1]

    if agent not in summary:
        summary[agent] = {"total": 0, "dup": 0}

    summary[agent]["total"] += 1
    if duplicate:
        summary[agent]["dup"] += 1

ws2 = wb.create_sheet("Dashboard")

ws2.append(["Agent", "Total", "Duplicates", "Quality %"])

ranking = []

for agent, val in summary.items():
    total = val["total"]
    dup = val["dup"]
    quality = ((total - dup) / total * 100) if total else 0
    ranking.append((agent, total, dup, round(quality, 1)))

# SORT BEST → WORST
ranking.sort(key=lambda x: x[3], reverse=True)

for row in ranking:
    ws2.append(row)

wb.save(output_file)

print("DONE")
