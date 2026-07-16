import geocodes from "./iso3-geocodes.json";
import {
  demoCountryTrends,
  type AMRCountryTrend,
  type CountryYearRow,
  type PathogenType,
} from "./amr-demo-data";
import {
  isUsingPublishedData,
  loadDashboardBundle,
  mapClusterRows,
  mapCountryTrends,
  mapCountryYearPanel,
  mapFundingByYear,
  mapFundingRows,
  mapInterventions,
  mapPathogenSignals,
} from "./published-data";

export type { AMRCountryTrend, PathogenType } from "./amr-demo-data";
export { mapFundingRows, mapInterventions, mapClusterRows, isUsingPublishedData };

export type FundingByYearPoint = { year: number; bacterial: number; fungal: number };

/** Sign-aware — a real predictedLifeGain can be negative, unlike the old
 * hardcoded `+{value}y` display. Null (not enough measured interventions) is
 * always "—", never a fabricated number. */
export function formatLifeGain(value: number | null): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}y`;
}

/** Full-sentence variant for captions with room to explain the sparse-sample
 * gate, e.g. map popups and side panels. */
export function lifeGainDisplay(value: number | null, sampleCount: number): string {
  if (value == null) {
    return `not enough measured interventions yet (${sampleCount} so far)`;
  }
  return `${formatLifeGain(value)} (average across ${sampleCount} measured intervention${sampleCount === 1 ? "" : "s"})`;
}

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

/**
 * Real per-year global average (unweighted mean across whatever countries
 * reported that year) from the gated country-year panel. Gaps — a year or
 * pathogen type with no reporting countries — come back as null, never a
 * fabricated/interpolated value.
 */
export async function getResistanceSeries() {
  const rows = await mapCountryYearPanel();
  const byYear = new Map<number, { bacterial: number[]; fungal: number[]; life: number[] }>();
  for (const r of rows) {
    if (!byYear.has(r.year)) byYear.set(r.year, { bacterial: [], fungal: [], life: [] });
    const bucket = byYear.get(r.year)!;
    bucket.life.push(r.lifeExpectancy);
    if (r.burden != null) {
      if (r.pathogenType === "bacterial") bucket.bacterial.push(r.burden);
      if (r.pathogenType === "fungal") bucket.fungal.push(r.burden);
    }
  }
  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  return [...byYear.keys()]
    .sort((a, b) => a - b)
    .map((year) => {
      const b = byYear.get(year)!;
      return {
        year,
        bacterial: avg(b.bacterial),
        fungal: avg(b.fungal),
        life: avg(b.life),
        n: b.life.length,
      };
    });
}

export async function getCountryYearPanel(
  pathogenType: PathogenType = "all",
): Promise<CountryYearRow[]> {
  const rows = await mapCountryYearPanel();
  if (pathogenType === "all") return rows;
  return rows.filter((r) => r.pathogenType === pathogenType);
}

function pivotFundingByYear(
  rows: Array<{ year: number; pathogenType: string; amountUsd: number }>,
): FundingByYearPoint[] {
  const byYear = new Map<number, { bacterial: number; fungal: number }>();
  for (const r of rows) {
    if (!byYear.has(r.year)) byYear.set(r.year, { bacterial: 0, fungal: 0 });
    const bucket = byYear.get(r.year)!;
    if (r.pathogenType === "bacterial") bucket.bacterial += r.amountUsd;
    else if (r.pathogenType === "fungal") bucket.fungal += r.amountUsd;
  }
  return [...byYear.keys()].sort((a, b) => a - b).map((year) => ({ year, ...byYear.get(year)! }));
}

/** Real Hub R&D pro-rata totals by start year, pivoted to {year, bacterial, fungal}. */
export async function getFundingByYear(): Promise<FundingByYearPoint[]> {
  const rows = await mapFundingByYear();
  return pivotFundingByYear(rows);
}

export async function getGatedOrganisms(): Promise<Record<"bacterial" | "fungal", string[]>> {
  const bundle = await loadDashboardBundle();
  const result: Record<"bacterial" | "fungal", string[]> = { bacterial: [], fungal: [] };
  if (!bundle) return result;
  const tables: Array<["bacterial" | "fungal", Record<string, unknown>[]]> = [
    ["bacterial", bundle.clusterTypologyBacterial],
    ["fungal", bundle.clusterTypologyFungal],
  ];
  for (const [pathogenType, table] of tables) {
    const set = new Set<string>();
    for (const row of table) {
      if (String(row.quality_gate ?? "") !== "pass") {
        set.add(String(row.canonical_organism ?? ""));
      }
    }
    result[pathogenType] = [...set];
  }
  return result;
}

export type PathogenComparisonStats = {
  yearMin: number;
  yearMax: number;
  countryCount: number;
  longestIso: string | null;
  longestN: number;
  fundingPeakYear: number;
  fundingPeakValue: number;
  gatedOrganisms: string[];
};

export async function getPathogenComparisonStats(
  pathogenType: "bacterial" | "fungal",
): Promise<PathogenComparisonStats | null> {
  const rows = await getCountryYearPanel(pathogenType);
  const fundingByYear = await getFundingByYear();
  const gatedOrganisms = await getGatedOrganisms();
  if (!rows.length || !fundingByYear.length) return null;

  const years = rows.map((r) => r.year);
  const countries = new Set(rows.map((r) => r.iso3));
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.iso3, (counts.get(r.iso3) ?? 0) + 1);
  let longestIso: string | null = null;
  let longestN = 0;
  for (const [iso, n] of counts) {
    if (n > longestN) {
      longestN = n;
      longestIso = iso;
    }
  }
  const peak = fundingByYear.reduce((a, b) => (b[pathogenType] > a[pathogenType] ? b : a));

  return {
    yearMin: Math.min(...years),
    yearMax: Math.max(...years),
    countryCount: countries.size,
    longestIso,
    longestN,
    fundingPeakYear: peak.year,
    fundingPeakValue: peak[pathogenType],
    gatedOrganisms: gatedOrganisms[pathogenType] ?? [],
  };
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
  const avgRiskScore =
    countries.length > 0 ? countries.reduce((s, c) => s + c.riskScore, 0) / countries.length : 0;
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
    avgRiskScore,
    avgLifeGain,
    fundingGap: Math.round(maxGap * 100),
    isolates,
    dataSource: isUsingPublishedData() ? "published" : "demo",
  };
}
