import pandas as pd
import sys
import re
import os

if not os.path.exists("output"):
    os.makedirs("output")

excel1 = sys.argv[1]
excel2 = sys.argv[2]
whatsapp_file = sys.argv[3]

df1 = pd.read_excel(excel1)
df2 = pd.read_excel(excel2)

# READ WHATSAPP
wa_data = []
with open(whatsapp_file, "r") as f:
    lines = f.readlines()

for line in lines:
    parts = line.strip().split()
    if len(parts) >= 3:
        wa_data.append([parts[0], parts[1], parts[2]])

wa_df = pd.DataFrame(wa_data, columns=["Agent","Van Plate","serial"])

def extract_serial(text):
    match = re.search(r"\b\d{8,}\b", text)
    return match.group(0) if match else None

df1["serial"] = df1.apply(lambda r: extract_serial(" ".join([str(x) for x in r if pd.notna(x)])), axis=1)
df2["serial"] = df2.apply(lambda r: extract_serial(" ".join([str(x) for x in r if pd.notna(x)])), axis=1)

df1 = df1.dropna(subset=["serial"])
df2 = df2.dropna(subset=["serial"])

# EXTRACT AGENT + VAN
if "BA NAME &VAN" in df1.columns:
    df1[["Agent","Van Plate"]] = df1["BA NAME &VAN"].apply(lambda x: pd.Series(str(x).split()[:1] + str(x).split()[-1:]))

combined = pd.concat([
    df1[["Agent","Van Plate","serial"]],
    wa_df
])

combined = combined.drop_duplicates(subset=["serial"])

df2 = df2.drop_duplicates(subset=["serial"])
common = set(combined["serial"]).intersection(set(df2["serial"]))

combined["Duplicate"] = combined["serial"].apply(lambda x: x in common)

summary = combined.groupby(["Agent","Van Plate"]).agg(
    Total=("serial","count"),
    Duplicates=("Duplicate","sum")
).reset_index()

summary["Quality %"] = ((summary["Total"]-summary["Duplicates"]) / summary["Total"] *100).round(1)

with pd.ExcelWriter("output/result.xlsx") as writer:
    combined.to_excel(writer, sheet_name="Combined", index=False)
    summary.to_excel(writer, sheet_name="Dashboard", index=False)
