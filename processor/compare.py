import pandas as pd
import sys
import re
import os

if not os.path.exists("output"):
    os.makedirs("output")

file1 = sys.argv[1]
file2 = sys.argv[2]

df1 = pd.read_excel(file1)
df2 = pd.read_excel(file2)

# SERIAL EXTRACTION
def extract_serial(text):
    match = re.search(r"\b\d{8,}\b", text)
    return match.group(0) if match else None

# SAFE SERIAL EXTRACTION
df1["serial"] = df1.apply(
    lambda r: extract_serial(" ".join([str(x) for x in r if pd.notna(x)])),
    axis=1
)

df2["serial"] = df2.apply(
    lambda r: extract_serial(" ".join([str(x) for x in r if pd.notna(x)])),
    axis=1
)

df1 = df1.dropna(subset=["serial"])
df2 = df2.dropna(subset=["serial"])

# EXTRACT AGENT + VAN
def extract_agent_van(val):
    if pd.isna(val):
        return ("Unknown", "Unknown")

    parts = str(val).split()
    if len(parts) >= 2:
        return (parts[0], parts[-1])
    return (val, "Unknown")

if "BA NAME &VAN" in df1.columns:
    df1[["Agent", "Van Plate"]] = df1["BA NAME &VAN"].apply(
        lambda x: pd.Series(extract_agent_van(x))
    )
else:
    df1["Agent"] = "Unknown"
    df1["Van Plate"] = "Unknown"

# INTERNAL DUPLICATES
df1["Internal Duplicate"] = df1.duplicated(subset=["serial"], keep=False)

# UNIQUE
df1_unique = df1.drop_duplicates(subset=["serial"])
df2_unique = df2.drop_duplicates(subset=["serial"])

# CROSS DUPLICATES
common = set(df1_unique["serial"]).intersection(set(df2_unique["serial"]))
df1_unique["Duplicate"] = df1_unique["serial"].apply(lambda x: x in common)

# SUMMARY
summary = df1_unique.groupby(["Agent", "Van Plate"]).agg(
    Total=("serial", "count"),
    Duplicates=("Duplicate", "sum")
).reset_index()

summary["Quality %"] = ((summary["Total"] - summary["Duplicates"]) / summary["Total"] * 100).round(1)

# FLAGS
summary["Flag"] = summary["Quality %"].apply(
    lambda q: "⚠️ Suspicious" if q < 80 else "✅ Good"
)

summary = summary.sort_values(by="Quality %", ascending=False)
summary["Rank"] = range(1, len(summary)+1)

# 🧠 AI INSIGHTS
insights = []

for _, row in summary.iterrows():
    if row["Quality %"] < 75:
        insights.append(f"{row['Agent']} has LOW quality ({row['Quality %']}%)")

    if row["Duplicates"] > 20:
        insights.append(f"{row['Agent']} has HIGH duplicates ({row['Duplicates']})")

if not insights:
    insights.append("All agents performing well")

insights_df = pd.DataFrame({"Insights": insights})

# SAVE
output_file = "output/result.xlsx"

with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
    df1.to_excel(writer, sheet_name="Raw with Flags", index=False)
    df1_unique.to_excel(writer, sheet_name="Cleaned", index=False)
    summary.to_excel(writer, sheet_name="Dashboard", index=False)
    insights_df.to_excel(writer, sheet_name="Insights", index=False)

print("Advanced Processing Complete ✅")
