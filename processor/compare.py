import pandas as pd
import sys
import re

file1 = sys.argv[1]
file2 = sys.argv[2]

def read_file(file):
    try:
        return pd.read_excel(file)
    except:
        try:
            return pd.read_csv(file, encoding='latin1')
        except:
            raise Exception("Unsupported file format")

import re
import pandas as pd

def extract_serials(df):
    serials = []
    
    for col in df.columns:
        for val in df[col]:
            if pd.isna(val):
                continue

            val = str(val)

            # Extract long numbers (serials)
            matches = re.findall(r'\d{10,}', val)

            for m in matches:
                serials.append(m)

    return pd.DataFrame({"serial number": serials})
    serials = []

    for col in df.columns:
        for val in df[col]:
            if pd.isna(val):
                continue

            val = str(val)
            matches = re.findall(r'\d{10,}', val)
            serials.extend(matches)

    return pd.DataFrame({"serial number": list(set(serials))})

df1 = extract_serials(read_file(file1))
df2 = extract_serials(read_file(file2))

# merge safely
merged = pd.merge(
    df1.drop_duplicates(),
    df2.drop_duplicates(),
    on="serial number",
    how="outer",
    indicator=True
)

merged["status"] = merged["_merge"].map({
    "both": "MATCHED",
    "left_only": "ONLY IN FILE 1",
    "right_only": "ONLY IN FILE 2"
})

merged["status"] = merged["_merge"].map({
    "both": "matched",
    "left_only": "only in file 1",
    "right_only": "only in file 2"
})

merged.drop(columns=["_merge"], inplace=True)

merged.to_excel("preview.xlsx", index=False)
