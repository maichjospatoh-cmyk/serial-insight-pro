import pandas as pd
import sys
import re

file1 = sys.argv[1]
file2 = sys.argv[2]

def read_file(file):
    try:
        return pd.read_excel(file, engine="openpyxl")
    except:
        return pd.read_csv(file, encoding="latin1")

def extract_data(df):
    data = []
    current_agent = ""

    for val in df.values.flatten():
        if pd.isna(val):
            continue

        val = str(val).strip()

        # detect agent names (text without numbers)
        if not re.search(r'\d{5,}', val) and len(val) > 3:
            current_agent = val
            continue

        # extract serials
        serials = re.findall(r'\d{10,}', val)

        for s in serials:
            data.append({
                "agent name": current_agent,
                "serial number": s
            })

    return pd.DataFrame(data)

df1 = extract_data(read_file(file1))
df2 = extract_data(read_file(file2))

df1 = df1.drop_duplicates()
df2 = df2.drop_duplicates()

merged = pd.merge(
    df1,
    df2,
    on="serial number",
    how="outer",
    indicator=True
)

# combine agent names from both files
merged["agent name"] = merged["agent name_x"].combine_first(merged["agent name_y"])

merged["status"] = merged["_merge"].map({
    "both": "MATCHED",
    "left_only": "ONLY IN FILE 1",
    "right_only": "ONLY IN FILE 2"
})

merged["duplicate_per_agent"] = merged.duplicated(
    subset=["agent name"],
    keep=False
)

final = merged[[
    "agent name",
    "serial number",
    "status",
    "duplicate_per_agent"
]]

# Save to ROOT (IMPORTANT)
final.to_excel("output.xlsx", index=False)

# Preview page
final.head(50).to_html("preview.html", index=False)

print("DONE")
