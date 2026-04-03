import pandas as pd
import sys
import re

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
    current_date = ""
    current_plate = ""

    for val in df.values.flatten():
        if pd.isna(val):
            continue

        val = str(val).strip()

        # detect agent name (text without long numbers)
        if not re.search(r'\d{5,}', val) and len(val) > 3:
            current_agent = val
            continue

        # extract serial numbers (long numbers)
        serials = re.findall(r'\d{10,}', val)

        for s in serials:
            data.append({
                "agent name": current_agent,
                "serial number": s,
                "date": current_date,
                "van": current_plate
            })

    return pd.DataFrame(data)


# READ FILES
df1 = extract_serials(read_file(file1))
df2 = extract_serials(read_file(file2))

# REMOVE DUPLICATE COLUMNS ISSUE
df1 = df1.loc[:, ~df1.columns.duplicated()]
df2 = df2.loc[:, ~df2.columns.duplicated()]

# MERGE
merged = pd.merge(df1, df2, on="serial number", how="outer", suffixes=("_file1", "_file2"))

# STATUS COLUMN
merged["status"] = merged.apply(
    lambda row: "MATCH"
    if pd.notna(row["agent name_file1"]) and pd.notna(row["agent name_file2"])
    else "ONLY IN FILE 1"
    if pd.notna(row["agent name_file1"])
    else "ONLY IN FILE 2",
    axis=1
)

# CLEAN AGENT NAME COLUMN
merged["agent name"] = merged["agent name_file1"].combine_first(merged["agent name_file2"])

# DUPLICATE PER AGENT
merged["duplicate_per_agent"] = merged.duplicated(
    subset=["serial number", "agent name"],
    keep=False
)

# FINAL OUTPUT
final = merged[[
    "agent name",
    "serial number",
    "date_file1",
    "status",
    "duplicate_per_agent"
]]

# RENAME DATE COLUMN
final.rename(columns={"date_file1": "date"}, inplace=True)

# SAVE OUTPUT
final.to_excel("output.xlsx", index=False)

print("Processing complete")
