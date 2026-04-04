import pandas as pd
import re
import sys
import os

file1 = sys.argv[1]
file2 = sys.argv[2]


def read_file(file):
    try:
        return pd.read_excel(file, engine="openpyxl")
    except:
        try:
            return pd.read_csv(file, encoding="latin1")
        except:
            raise Exception("Unsupported file format")


def extract_serials(df):
    data = []
    current_agent = ""

    for val in df.values.flatten():
        if pd.isna(val):
            continue

        val = str(val).strip()

        # CLEAN AGENT NAME
        clean_name = re.sub(r'[^A-Za-z\s]', '', val).strip()
        clean_name = re.sub(r'\b(lines?|line)\b', '', clean_name, flags=re.IGNORECASE).strip()

        if not re.search(r'\d{5,}', val) and len(clean_name) > 2:
            current_agent = clean_name
            continue

        # SERIALS
        serials = re.findall(r'\d{10,}', val)

        # VAN PLATE (Kenya format)
        van_match = re.search(r'\bK[A-Z]{2}\s?\d{3}[A-Z]?\b', val.upper())
        van_plate = van_match.group(0) if van_match else ""

        for s in serials:
            data.append({
                "agent name": current_agent,
                "serial number": s,
                "van plate": van_plate
            })

    return pd.DataFrame(data)


# PROCESS FILES
df1 = extract_serials(read_file(file1))
df2 = extract_serials(read_file(file2))

df1 = df1.drop_duplicates()
df2 = df2.drop_duplicates()

# MERGE
merged = pd.merge(
    df1,
    df2,
    on="serial number",
    how="outer",
    suffixes=("_file1", "_file2"),
    indicator=True
)

# STATUS
merged["status"] = merged["_merge"].map({
    "left_only": "ONLY IN FILE 1",
    "right_only": "ONLY IN FILE 2",
    "both": "MATCHED"
})

merged.drop(columns=["_merge"], inplace=True)

# COMBINE AGENT + VAN
merged["agent name"] = merged["agent name_file1"].fillna("") + merged["agent name_file2"].fillna("")
merged["van plate"] = merged["van plate_file1"].fillna("") + merged["van plate_file2"].fillna("")

merged.drop(columns=[
    "agent name_file1", "agent name_file2",
    "van plate_file1", "van plate_file2"
], inplace=True)

# DUPLICATES
merged["duplicate_per_agent"] = merged.duplicated(
    subset=["agent name", "serial number"], keep=False
)

# ORDER
merged = merged[[
    "agent name",
    "serial number",
    "van plate",
    "status",
    "duplicate_per_agent"
]]

# SUMMARY
summary = merged.groupby("agent name").agg(
    total_serials=("serial number", "count"),
    duplicates=("duplicate_per_agent", "sum")
).reset_index()

# SAVE EXCEL WITH FORMATTING
os.makedirs("output", exist_ok=True)

with pd.ExcelWriter("output/result.xlsx", engine="openpyxl") as writer:
    merged.to_excel(writer, index=False, sheet_name="Results")
    summary.to_excel(writer, index=False, sheet_name="Summary")

print("Processing complete. Download ready.")
