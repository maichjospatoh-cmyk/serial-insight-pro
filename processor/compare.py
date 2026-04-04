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

        # 📅 DATE DETECTION
        parsed = pd.to_datetime(val, errors='coerce')
        if pd.notna(parsed):
            current_date = parsed.date()
            continue

        # 👤 CLEAN AGENT NAME
        clean = re.sub(r'[^A-Za-z\s]', '', val)
        clean = re.sub(r'\b(lines?|line)\b', '', clean, flags=re.IGNORECASE).strip()

        # Detect agent
        if not re.search(r'\d', val) and len(clean) > 2:
            agent = clean
            continue

        # 🔢 SERIAL EXTRACTION (KEY FIX)
        matches = re.findall(r'89254021\d+', val)

        for m in matches:
            serial = m[m.find("89254021"):]  # extract from prefix

            data.append({
                "agent name": agent,
                "serial number": serial,
                "date": str(current_date)
            })

    return pd.DataFrame(data)

# 🔄 PROCESS BOTH FILES
df1 = extract(file1)
df2 = extract(file2)

# 🧩 MERGE
merged = pd.merge(df1, df2, on="serial number", how="outer", suffixes=("_1","_2"))

# 👤 FINAL AGENT NAME
merged["agent name"] = merged["agent name_1"].combine_first(merged["agent name_2"])

# 📅 FINAL DATE
merged["date"] = merged["date_1"].combine_first(merged["date_2"])

# 📊 STATUS
merged["status"] = merged.apply(
    lambda x: "MATCHED" if pd.notna(x["agent name_1"]) and pd.notna(x["agent name_2"])
    else ("ONLY IN FILE 1" if pd.notna(x["agent name_1"]) else "ONLY IN FILE 2"),
    axis=1
)

# 🔁 DUPLICATES PER AGENT
merged["duplicate_per_agent"] = merged.duplicated(
    subset=["agent name", "serial number"],
    keep=False
)

# 🧹 FINAL CLEAN
final = merged[[
    "agent name",
    "serial number",
    "date",
    "status",
    "duplicate_per_agent"
]]

# 📁 SAVE OUTPUT
os.makedirs("output", exist_ok=True)
final.to_excel("output/result.xlsx", index=False)

print("DONE")
