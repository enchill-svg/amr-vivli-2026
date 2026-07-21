"""Generate the two figures embedded in docs/VIVLI_SUBMISSION_REPORT_v1.md.

Reads only from data/published/*.csv (no recomputation) and writes PNGs into
this directory. Re-run after any pipeline republish that changes these two
source files.
"""
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

plt.rcParams.update(
    {
        "font.family": "sans-serif",
        "font.size": 10,
        "axes.edgecolor": "#333333",
        "axes.labelcolor": "#222222",
        "text.color": "#222222",
        "xtick.color": "#333333",
        "ytick.color": "#333333",
        "axes.spines.top": False,
        "axes.spines.right": False,
    }
)

RISK_COLOR = "#B5443C"
MODALITY_COLORS = ["#2E6E62", "#4C8C7F", "#7FB0A5", "#C9C2A8"]
GEO_COLORS = ["#3E5C76", "#B5443C"]

# --- Figure 1: bacterial country risk ranking (top pass-gated countries) ---
risk = pd.read_csv("data/published/country_risk_ranking_bacterial_gated_v1.csv")
top = (
    risk[risk["quality_gate"] == "pass"]
    .sort_values("risk_rank")
    .head(10)
    .sort_values("risk_rank", ascending=False)
)

fig, ax = plt.subplots(figsize=(6.5, 3.4), dpi=200)
bars = ax.barh(top["iso3_country"], top["composite_risk_score_core"], color=RISK_COLOR, height=0.65)
for bar, rank in zip(bars, top["risk_rank"].astype(int)):
    ax.text(
        bar.get_width() + 1.0,
        bar.get_y() + bar.get_height() / 2,
        f"#{rank}",
        va="center",
        ha="left",
        fontsize=8.5,
        color="#555555",
    )
ax.set_xlabel("Composite risk score (core components, 0-100)")
ax.set_xlim(0, 95)
ax.set_title("Bacterial country risk ranking - top 10 pass-gated countries", fontsize=11, loc="left")
fig.text(
    0.01,
    -0.02,
    "Source: country_risk_ranking_bacterial_gated_v1.csv. Ghana withheld (missing_country_gate); not shown.",
    fontsize=7.5,
    color="#666666",
)
fig.tight_layout()
fig.savefig("docs/figures/fig1_bacterial_country_risk.png", bbox_inches="tight")
plt.close(fig)

# --- Figure 2: Hub funding composition (modality + geography) ---
hub = pd.read_csv("data/published/hub_funding_composition_summary_v1.csv")
modality = hub[hub["composition_dimension"] == "modality"].sort_values("share_of_hub_total", ascending=False)
geography = hub[hub["composition_dimension"] == "geography"].sort_values("share_of_hub_total", ascending=False)

fig, axes = plt.subplots(1, 2, figsize=(7.2, 3.0), dpi=200)

ax = axes[0]
labels = modality["bucket"].str.replace("_", " ").str.title()
ax.barh(labels, modality["share_of_hub_total"] * 100, color=MODALITY_COLORS[: len(modality)], height=0.6)
ax.set_xlabel("Share of Hub total ($18.84B)")
ax.set_xlim(0, 70)
ax.invert_yaxis()
ax.set_title("Modality", fontsize=10.5, loc="left")
for i, v in enumerate(modality["share_of_hub_total"] * 100):
    ax.text(v + 1.2, i, f"{v:.1f}%", va="center", fontsize=8.5, color="#555555")

ax = axes[1]
labels = geography["bucket"].str.replace("_", " ").str.title()
ax.barh(labels, geography["share_of_hub_total"] * 100, color=GEO_COLORS[: len(geography)], height=0.5)
ax.set_xlabel("Share of Hub total")
ax.set_xlim(0, 110)
ax.invert_yaxis()
ax.set_title("Geography", fontsize=10.5, loc="left")
for i, v in enumerate(geography["share_of_hub_total"] * 100):
    ax.text(v + 1.5, i, f"{v:.1f}%", va="center", fontsize=8.5, color="#555555")

fig.suptitle("Global AMR R&D Hub funding composition", fontsize=11, x=0.02, ha="left")
fig.text(
    0.01,
    -0.03,
    "Source: hub_funding_composition_summary_v1.csv. Hub excludes private/VC funding.",
    fontsize=7.5,
    color="#666666",
)
fig.tight_layout(rect=[0, 0, 1, 0.92])
fig.savefig("docs/figures/fig2_hub_funding_composition.png", bbox_inches="tight")
plt.close(fig)

print("Wrote docs/figures/fig1_bacterial_country_risk.png")
print("Wrote docs/figures/fig2_hub_funding_composition.png")
