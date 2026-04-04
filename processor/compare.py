import pandas as pd
import re
import sys
import os
from openpyxl import load_workbook
from openpyxl.styles import PatternFill

file1 = sys.argv[1]
file2 = sys.argv[2]


def read_file(file):
    try:
        return pd.read_excel(file, engine="openpyxl")
    except:
        return pd.read_csv(file, encoding="latin1")


def extract_serials(df):
    data = []
    current_agent = ""

    for val in df.values.flatten():
        if pd.isna(val):
            continue

        val = str(val).strip()

        clean_name = re.sub(r'[^A-Za-z\s]', '', val).strip()
        clean_name = re.sub(r'\b(lines?|line)\b', '', clean_name, flags=re.IGNORECASE).strip()

        if not re.search(r'\d{5,}', val) and len(clean_name) > 2:
            current_agent = clean_name
            continue

        serials = re.findall(r'\d{10,}', val)

        van_match = re.search(r'\bK[A-Z]{2}\s?\d{3}[A-Z]?\b', val.upper())
        van_plate = van_match.group(0) if van_match else ""

        for s in serials:
            data.append({
                "agent name": current_agent,
                "serial number": s,
                "van plate": van_plate
            })

    return pd.DataFrame(data)


# PROCESS
df1 = extract_serials(read_file(file1))
df2 = extract_serials(read_file(file2))

df1 = df1.drop_duplicates()
df2 = df2.drop_duplicates()

merged = pd.merge(
    df1,
    df2,
    on="serial number",
    how="outer",
    suffixes=("_file1", "_file2"),
    indicator=True
)

merged["status"] = merged["_merge"].map({
    "left_only": "ONLY IN FILE 1",
    "right_only": "ONLY IN FILE 2",
    "both": "MATCHED"
})

merged["agent name"] = merged["agent name_file1"].fillna("") + merged["agent name_file2"].fillna("")
merged["van plate"] = merged["van plate_file1"].fillna("") + merged["van plate_file2"].fillna("")

merged.drop(columns=[
    "agent name_file1", "agent name_file2",
    "van plate_file1", "van plate_file2",
    "_merge"
], inplace=True)

merged["duplicate_per_agent"] = merged.duplicated(
    subset=["agent name", "serial number"], keep=False
)

merged = merged[[
    "agent name",
    "serial number",
    "van plate",
    "status",
    "duplicate_per_agent"
]]

# 📊 SUMMARY
summary = merged.groupby("agent name").agg(
    total_lines=("serial number", "count"),
    duplicates=("duplicate_per_agent", "sum")
).reset_index()

summary["performance_rank"] = summary["total_lines"].rank(ascending=False, method="dense")

# SAVE
os.makedirs("output", exist_ok=True)
file_path = "output/result.xlsx"

with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
    merged.to_excel(writer, index=False, sheet_name="Results")
    summary.to_excel(writer, index=False, sheet_name="Dashboard")

# 🎨 APPLY COLORS
wb = load_workbook(file_path)
ws = wb["Results"]

green = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
red = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
yellow = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")

for row in ws.iter_rows(min_row=2):
    status = row[3].value
    duplicate = row[4].value

    if status == "MATCHED":
        for cell in row:
            cell.fill = green

    if duplicate:
        for cell in row:
            cell.fill = red

    if "ONLY" in str(status):
        for cell in row:
            cell.fill = yellow

wb.save(file_path)

print("Professional report generated successfully ✅")
