import pandas as pd
import sys
import re

file1 = sys.argv[1]
file2 = sys.argv[2]

def read_file(file):
    try:
        return pd.read_excel(file)
    except:
        return pd.read_csv(file, encoding='latin1')

def extract_data(df):
    data = []
    current_agent = ""

    for col in df.columns:
        for val in df[col]:
            if pd.isna(val):
                continue

            val = str(val).strip()

            # Detect agent name (text only)
            if re.match(r'^[A-Za-z\s]+$', val) and len(val) > 3:
                current_agent = val
                continue

            # Extract serial numbers
            serials = re.findall(r'\d{10,}', val)

            # Extract date
            date = re.findall(r'\d{4}[-/]\d{2}[-/]\d{2}', val)

            # Extract vehicle
            plate = re.findall(r'K[A-Z]{2}\s?\d+[A-Z]?', val)

            for s in serials:
                data.append({
                    "agent name": current_agent,
                    "serial number": s,
                    "date": date[0] if date else "",
                    "van": plate[0] if plate else ""
                })

    return pd.DataFrame(data)

df1 = extract_data(read_file(file1))
df2 = extract_data(read_file(file2))

# remove duplicates
df1 = df1.drop_duplicates()
df2 = df2.drop_duplicates()

# merge
merged = pd.merge(
    df1,
    df2,
    on="serial number",
    how="outer",
    indicator=True,
    suffixes=("_file1", "_file2")
)

# status
merged["status"] = merged["_merge"].map({
    "both": "MATCHED",
    "left_only": "ONLY IN FILE 1",
    "right_only": "ONLY IN FILE 2"
})

# choose best values
merged["agent name"] = merged["agent name_file1"].fillna(merged["agent name_file2"])
merged["date"] = merged["date_file1"].fillna(merged["date_file2"])
merged["van"] = merged["van_file1"].fillna(merged["van_file2"])

# duplicate per agent
merged["duplicate_per_agent"] = merged.duplicated(
    subset=["agent name", "serial number"], keep=False
)

# final output
final = merged[[
    "agent name",
    "serial number",
    "van",
    "date",
    "status",
    "duplicate_per_agent"
]]

# export
final.to_excel("preview.xlsx", index=False)
final.head(50).to_html("preview.html", index=False)
