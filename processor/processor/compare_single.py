import pandas as pd
import sys
import re
import os

if not os.path.exists("output"):
    os.makedirs("output")

excel = sys.argv[1]
whatsapp_file = sys.argv[2]

df = pd.read_excel(excel)

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

df["serial"] = df.apply(
    lambda r: extract_serial(" ".join([str(x) for x in r if pd.notna(x)])),
    axis=1
)

df = df.dropna(subset=["serial"])

# EXTRACT AGENT
if "BA NAME &VAN" in df.columns:
    df[["Agent","Van Plate"]] = df["BA NAME &VAN"].apply(
        lambda x: pd.Series(str(x).split()[:1] + str(x).split()[-1:])
    )

# 🔥 COMPARE WHATSAPP VS EXCEL
excel_set = set(df["serial"])
wa_set = set(wa_df["serial"])

df["In WhatsApp"] = df["serial"].apply(lambda x: x in wa_set)

# SUMMARY
summary = df.groupby(["Agent","Van Plate"]).agg(
    Total=("serial","count"),
    Found_in_WhatsApp=("In WhatsApp","sum")
).reset_index()

summary["Match %"] = ((summary["Found_in_WhatsApp"] / summary["Total"]) * 100).round(1)

# SAVE
with pd.ExcelWriter("output/result.xlsx") as writer:
    df.to_excel(writer, sheet_name="Excel Data", index=False)
    wa_df.to_excel(writer, sheet_name="WhatsApp Data", index=False)
    summary.to_excel(writer, sheet_name="Dashboard", index=False)

print("Single file processing complete ✅")
