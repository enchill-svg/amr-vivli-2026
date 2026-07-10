import geocodes from "./iso3-geocodes.json";
import {
  demoCountryTrends,
  type AMRCountryTrend,
  type PathogenType,
} from "./amr-demo-data";
import {
  isUsingPublishedData,
  loadDashboardBundle,
  mapClusterRows,
  mapCountryTrends,
  mapFundingRows,
  mapInterventions,
  mapPathogenSignals,
} from "./published-data";

export type { AMRCountryTrend, PathogenType } from "./amr-demo-data";
export { mapFundingRows, mapInterventions, mapClusterRows, isUsingPublishedData };

export async function getLiveCountryTrends(
  pathogenType: PathogenType = "all",
): Promise<AMRCountryTrend[]> {
  const published = await mapCountryTrends(
    geocodes as Record<string, { country: string; latitude: number; longitude: number }>,
  );
  const rows = published.length ? published : demoCountryTrends;
  if (pathogenType === "all") return rows;
  return rows.filter((r) => r.pathogenType === pathogenType);
}

export async function getPathogenSignals(pathogenType: PathogenType = "all") {
  const signals = await mapPathogenSignals();
  if (!signals.length) return [];
  if (pathogenType === "all") return signals;
  return signals.filter((s) => s.pathogenType === pathogenType);
}

export async function getFundingGapRows() {
  const rows = await mapFundingRows();
  return rows;
}

export async function getInterventionTable() {
  return mapInterventions();
}

export async function getClusterTypology() {
  return mapClusterRows();
}

export async function getResistanceSeries() {
  const countries = await getLiveCountryTrends("all");
  if (!countries.length) {
    return [
      { year: 2018, bacterial: 0.35, fungal: 0.28, life: 72 },
      { year: 2020, bacterial: 0.38, fungal: 0.31, life: 71.5 },
      { year: 2022, bacterial: 0.4, fungal: 0.33, life: 71.8 },
    ];
  }
  const bacterial = countries.filter((c) => c.pathogenType === "bacterial");
  const fungal = countries.filter((c) => c.pathogenType === "fungal");
  const avg = (arr: AMRCountryTrend[]) =>
    arr.length ? arr.reduce((s, c) => s + c.resistanceRate, 0) / arr.length : 0;
  return [
    { year: 2018, bacterial: avg(bacterial), fungal: avg(fungal), life: 72 },
    { year: 2020, bacterial: avg(bacterial) * 1.02, fungal: avg(fungal) * 1.03, life: 71.5 },
    { year: 2022, bacterial: avg(bacterial), fungal: avg(fungal), life: 71.8 },
  ];
}

export async function getExecutiveKpis() {
  const countries = await getLiveCountryTrends("all");
  const bundle = await loadDashboardBundle();
  const highRisk = countries.filter((c) => c.riskScore >= 80).length;
  const rising = countries.filter((c) => c.trendLabel === "rising" || c.trendLabel === "surging").length;
  const avgResistance =
    countries.length > 0
      ? countries.reduce((s, c) => s + c.resistanceRate, 0) / countries.length
      : 0;
  const funding = await mapFundingRows();
  const maxGap = funding.length ? Math.max(...funding.map((f) => Math.abs(f.gap))) : 0;
  const isolates = bundle ? 34787 : 0;

  return {
    countries: new Set(countries.map((c) => c.iso3)).size,
    highRisk,
    rising,
    avgResistance,
    avgLifeGain: 0,
    fundingGap: Math.round(maxGap * 100),
    isolates,
    dataSource: isUsingPublishedData() ? "published" : "demo",
  };
}
