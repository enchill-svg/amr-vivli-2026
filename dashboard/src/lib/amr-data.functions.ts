import geocodes from "./iso3-geocodes.json";
import { demoCountryTrends, type AMRCountryTrend, type PathogenType } from "./amr-demo-data";
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
  const year =
    countries.length > 0
      ? Math.max(...countries.map((c) => c.latestYear))
      : new Date().getFullYear() - 1;
  if (!countries.length) {
    return [{ year, bacterial: 0, fungal: 0, life: 0 }];
  }
  const bacterial = countries.filter((c) => c.pathogenType === "bacterial");
  const fungal = countries.filter((c) => c.pathogenType === "fungal");
  const avg = (arr: AMRCountryTrend[]) =>
    arr.length ? arr.reduce((s, c) => s + c.resistanceRate, 0) / arr.length : 0;
  const avgLife = (arr: AMRCountryTrend[]) =>
    arr.length ? arr.reduce((s, c) => s + c.lifeExpectancy, 0) / arr.length : 0;
  return [
    {
      year,
      bacterial: avg(bacterial),
      fungal: avg(fungal),
      life: avgLife([...bacterial, ...fungal]),
    },
  ];
}

export async function getExecutiveKpis() {
  const countries = await getLiveCountryTrends("all");
  const bundle = await loadDashboardBundle();
  const highRisk = countries.filter((c) => c.riskScore >= 80).length;
  const rising = countries.filter(
    (c) => c.trendLabel === "rising" || c.trendLabel === "surging",
  ).length;
  const avgResistance =
    countries.length > 0
      ? countries.reduce((s, c) => s + c.resistanceRate, 0) / countries.length
      : 0;
  const funding = await mapFundingRows();
  const maxGap = funding.length ? Math.max(...funding.map((f) => Math.abs(f.gap))) : 0;
  const summary = bundle?.pipelineSummary;
  const isolates = summary?.master_isolate_count ?? summary?.raw_isolate_count ?? (bundle ? 0 : 0);
  const measuredGains = (bundle?.interventions ?? [])
    .map((row) => Number(row.estimated_le_gain_years))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgLifeGain =
    measuredGains.length > 0 ? measuredGains.reduce((s, n) => s + n, 0) / measuredGains.length : 0;

  return {
    countries: new Set(countries.map((c) => c.iso3)).size,
    highRisk,
    rising,
    avgResistance,
    avgLifeGain,
    fundingGap: Math.round(maxGap * 100),
    isolates,
    dataSource: isUsingPublishedData() ? "published" : "demo",
  };
}
