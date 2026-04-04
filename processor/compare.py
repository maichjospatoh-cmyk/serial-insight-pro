import pandas as pd
import sys
import re
import os

file1 = sys.argv[1]
file2 = sys.argv[2]

def extract(file):
    df = pd.read_excel(file, header=None)
    data = []
    agent = ""
    current_date = ""

    for val in df.values.flatten():
        if pd.isna(val):
            continue

        val = str(val).strip()

        # DATE DETECTION
        parsed = pd.to_datetime(val, errors='coerce')
        if pd.notna(parsed):
            current_date = parsed.date()
            continue

        # CLEAN AGENT NAME
        clean = re.sub(r'[^A-Za-z\s]', '', val)
        clean = re.sub(r'\b(lines?|line)\b', '', clean, flags=re.IGNORECASE).strip()

        if not re.search(r'\d', val) and len(clean) > 2:
            agent = clean
            continue

        # SERIAL EXTRACTION (KEY LOGIC)
        matches = re.findall(r'89254021\d+', val)

        for m in matches:
            serial = m[m.find("89254021"):]

            data.append({
                "agent name": agent,
                "serial number": serial,
                "date": str(current_date)
            })

    return pd.DataFrame(data)

# PROCESS
df1 = extract(file1)
df2 = extract(file2)

# MERGE
merged = pd.merge(df1, df2, on="serial number", how="outer", suffixes=("_1","_2"))

merged["agent name"] = merged["agent name_1"].combine_first(merged["agent name_2"])
merged["date"] = merged["date_1"].combine_first(merged["date_2"])

# STATUS
merged["status"] = merged.apply(
    lambda x: "MATCHED" if pd.notna(x["agent name_1"]) and pd.notna(x["agent name_2"])
    else ("ONLY IN FILE 1" if pd.notna(x["agent name_1"]) else "ONLY IN FILE 2"),
    axis=1
)

# DUPLICATES
merged["duplicate_per_agent"] = merged.duplicated(
    subset=["agent name", "serial number"],
    keep=False
)

final = merged[[
    "agent name",
    "serial number",
    "date",
    "status",
    "duplicate_per_agent"
]]

# 📊 DASHBOARD CALCULATION
dashboard = final.groupby("agent name").agg(
    total_lines=("serial number", "count"),
    duplicates=("duplicate_per_agent", "sum")
).reset_index()

# RANKING
dashboard["performance_rank"] = dashboard["total_lines"].rank(
    ascending=False,
    method="dense"
).astype(int)

# 📁 SAVE EXCEL WITH FORMATTING
os.makedirs("output", exist_ok=True)

with pd.ExcelWriter("output/result.xlsx", engine="openpyxl") as writer:
    final.to_excel(writer, index=False, sheet_name="Results")
    dashboard.to_excel(writer, index=False, sheet_name="Dashboard")

    workbook = writer.book
    worksheet = writer.sheets["Results"]

    # 🎨 HIGHLIGHT DUPLICATES IN RED
    from openpyxl.styles import PatternFill

    red_fill = PatternFill(start_color="FF0000", end_color="FF0000", fill_type="solid")

    for row in range(2, len(final) + 2):
        if worksheet.cell(row=row, column=5).value:  # duplicate column
            for col in range(1, 6):
                worksheet.cell(row=row, column=col).fill = red_fill

print("DONE")
