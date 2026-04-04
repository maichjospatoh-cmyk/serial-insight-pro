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

        clean_name = re.sub(r'[^A-Za-z\s]', '', val).strip()
        clean_name = re.sub(r'\b(lines?|line)\b', '', clean_name, flags=re.IGNORECASE).strip()

        if not re.search(r'\d{5,}', val) and len(clean_name) > 2:
            current_agent = clean_name
            continue

        serials = re.findall(r'\d{10,}', val)

        for s in serials:
            data.append({
                "agent name": current_agent,
                "serial number": s
            })

    return pd.DataFrame(data)


# READ FILES
df1 = extract_serials(read_file(file1))
df2 = extract_serials(read_file(file2))

# CLEAN
df1 = df1.drop_duplicates()
df2 = df2.drop_duplicates()

# MERGE
merged = pd.merge(df1, df2, on="serial number", how="outer", indicator=True)

# STATUS
merged["status"] = merged["_merge"].map({
    "left_only": "ONLY IN FILE 1",
    "right_only": "ONLY IN FILE 2",
    "both": "MATCHED"
})

merged.drop(columns=["_merge"], inplace=True)

# FIX AGENT NAME (combine both sides)
merged["agent name"] = merged["agent name_x"].fillna("") + merged["agent name_y"].fillna("")
merged.drop(columns=["agent name_x", "agent name_y"], inplace=True)

# DUPLICATES
merged["duplicate_per_agent"] = merged.duplicated(
    subset=["agent name", "serial number"], keep=False
)

# SAVE OUTPUT
os.makedirs("output", exist_ok=True)
merged.to_excel("output/result.xlsx", index=False)

print("Processing complete. Download ready.")
