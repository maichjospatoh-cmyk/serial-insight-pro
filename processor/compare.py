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

        # CLEAN NAME
        clean = re.sub(r'[^A-Za-z\s]', '', val)
        clean = re.sub(r'\b(lines?|line)\b', '', clean, flags=re.IGNORECASE).strip()

        if not re.search(r'\d{5,}', val) and len(clean) > 2:
            agent = clean
            continue

        # SERIAL
        serials = re.findall(r'\d{10,}', val)

        for s in serials:
            data.append({
                "agent name": agent,
                "serial number": s,
                "date": str(current_date)
            })

    return pd.DataFrame(data)

df1 = extract(file1)
df2 = extract(file2)

merged = pd.merge(df1, df2, on="serial number", how="outer", suffixes=("_1","_2"))

merged["agent name"] = merged["agent name_1"].combine_first(merged["agent name_2"])

merged["status"] = merged.apply(
    lambda x: "MATCHED" if pd.notna(x["agent name_1"]) and pd.notna(x["agent name_2"])
    else ("ONLY IN FILE 1" if pd.notna(x["agent name_1"]) else "ONLY IN FILE 2"),
    axis=1
)

merged["duplicate_per_agent"] = merged.duplicated(
    subset=["agent name", "serial number"],
    keep=False
)

merged["date"] = merged["date_1"].combine_first(merged["date_2"])

final = merged[[
    "agent name",
    "serial number",
    "date",
    "status",
    "duplicate_per_agent"
]]

os.makedirs("output", exist_ok=True)
final.to_excel("output/result.xlsx", index=False)

print("DONE")
