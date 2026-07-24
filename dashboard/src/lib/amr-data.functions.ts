import geocodes from "./iso3-geocodes.json";
import type { AMRCountryTrend, CountryYearRow, PathogenType } from "./amr-types";
import {
  getInterventionGainSummary,
  getPublishedLoadError,
  isUsingPublishedData,
  loadDashboardBundle,
  mapClusterRows,
  mapCountryTrends,
  mapCountryYearPanel,
  mapFundingByYear,
  mapFundingRows,
  mapHubFundingComposition,
  mapInterventions,
  mapPathogenSignals,
} from "./published-data";

export type { AMRCountryTrend, PathogenType } from "./amr-types";
export {
  mapFundingRows,
  mapInterventions,
  mapClusterRows,
  isUsingPublishedData,
  getPublishedLoadError,
};

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

/** Pipeline-only country trends. Empty when the published bundle is unavailable —
 * never invents demo rows. */
export async function getLiveCountryTrends(
  pathogenType: PathogenType = "all",
): Promise<AMRCountryTrend[]> {
  const rows = await mapCountryTrends(
    geocodes as Record<string, { country: string; latitude: number; longitude: number }>,
  );
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

export async function getHubFundingComposition() {
  return mapHubFundingComposition();
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
    if (r.qualityGate !== "pass") continue;
    if (!byYear.has(r.year)) byYear.set(r.year, { bacterial: [], fungal: [], life: [] });
    const bucket = byYear.get(r.year)!;
    if (r.lifeExpectancy != null) bucket.life.push(r.lifeExpectancy);
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

/** Collapse bacterial + fungal rows to one score per ISO3 (max risk / any rising). */
function uniqueCountryMetrics(rows: AMRCountryTrend[]) {
  const byIso = new Map<
    string,
    { riskScore: number | null; resistanceRate: number; rising: boolean }
  >();
  for (const row of rows) {
    const prev = byIso.get(row.iso3);
    const rising = row.trendLabel === "rising" || row.trendLabel === "surging";
    if (!prev) {
      byIso.set(row.iso3, {
        riskScore: row.riskScore,
        resistanceRate: row.resistanceRate,
        rising,
      });
      continue;
    }
    const nextRisk =
      row.riskScore == null
        ? prev.riskScore
        : prev.riskScore == null
          ? row.riskScore
          : Math.max(prev.riskScore, row.riskScore);
    byIso.set(row.iso3, {
      riskScore: nextRisk,
      resistanceRate: Math.max(prev.resistanceRate, row.resistanceRate),
      rising: prev.rising || rising,
    });
  }
  return byIso;
}

export async function getExecutiveKpis() {
  const countries = await getLiveCountryTrends("all");
  const bundle = await loadDashboardBundle();
  const byIso = uniqueCountryMetrics(countries);
  const unique = [...byIso.values()];

  const highRisk = unique.filter((c) => c.riskScore != null && c.riskScore >= 80).length;
  const rising = unique.filter((c) => c.rising).length;
  const avgResistance =
    unique.length > 0 ? unique.reduce((s, c) => s + c.resistanceRate, 0) / unique.length : 0;
  const scoredRiskScores = unique.map((c) => c.riskScore).filter((v): v is number => v != null);
  const avgRiskScore =
    scoredRiskScores.length > 0
      ? scoredRiskScores.reduce((s, n) => s + n, 0) / scoredRiskScores.length
      : 0;
  const funding = await mapFundingRows();
  const maxGap = funding.length ? Math.max(...funding.map((f) => Math.abs(f.gap))) : 0;
  const summary = bundle?.pipelineSummary;
  // Prefer master isolate count from the pipeline publish; never invent a number.
  const isolates = summary?.master_isolate_count ?? summary?.raw_isolate_count ?? 0;

  // Same gate as mapCountryTrends: quality_gate==pass + MIN_INTERVENTION_SAMPLES.
  // Never average withheld/positive-only rows into a homepage "Predicted gain".
  const gainByPathogen = getInterventionGainSummary(bundle);
  const clearedGains: number[] = [];
  let lifeGainSampleCount = 0;
  for (const summaryRow of gainByPathogen.values()) {
    if (summaryRow.gain == null) continue;
    clearedGains.push(summaryRow.gain);
    lifeGainSampleCount += summaryRow.sampleCount;
  }
  const avgLifeGain =
    clearedGains.length > 0 ? clearedGains.reduce((s, n) => s + n, 0) / clearedGains.length : null;
  if (avgLifeGain == null) {
    lifeGainSampleCount = [...gainByPathogen.values()].reduce((s, r) => s + r.sampleCount, 0);
  }

  return {
    countries: byIso.size,
    highRisk,
    rising,
    avgResistance,
    avgRiskScore,
    avgLifeGain,
    lifeGainSampleCount,
    fundingGap: Math.round(maxGap * 100),
    isolates,
    dataSource: isUsingPublishedData() ? ("published" as const) : ("unavailable" as const),
    loadError: getPublishedLoadError(),
  };
}
