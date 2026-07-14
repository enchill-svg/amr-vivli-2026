import type {
  AMRCountryTrend,
  ClusterRow,
  FundingRow,
  InterventionRow,
  PathogenSignal,
} from "./amr-demo-data";

export type DashboardBundle = {
  bundle_version: string;
  generated_at: string;
  pipeline_run: { run_id: string | null; status: string | null };
  countryRiskBacterial: Record<string, unknown>[];
  countryRiskFungal: Record<string, unknown>[];
  clusterTypologyBacterial: Record<string, unknown>[];
  clusterTypologyFungal: Record<string, unknown>[];
  interventions: Record<string, unknown>[];
  fundingGap: Record<string, unknown>[];
  hubFundingComposition: Record<string, unknown>[];
  gatingComparison: Record<string, unknown>[];
  identifiabilityLedger: Record<string, unknown>[];
  q2DriverSummary: Record<string, unknown>[];
  associationSensitivity: Record<string, unknown>[];
  deliverablesIndex: Record<string, unknown>[];
  pipelineSummary?: {
    raw_isolate_count?: number;
    master_isolate_count?: number;
    master_row_count?: number;
    pipeline_run_id?: string | null;
  };
};

let cachedBundle: DashboardBundle | null = null;
let loadError: string | null = null;

const BUNDLE_URL = "/data/published/dashboard_bundle_v1.json";

export async function loadDashboardBundle(): Promise<DashboardBundle | null> {
  if (cachedBundle) return cachedBundle;
  try {
    const res = await fetch(BUNDLE_URL, { cache: "no-cache" });
    if (!res.ok) {
      loadError = `HTTP ${res.status}`;
      return null;
    }
    cachedBundle = (await res.json()) as DashboardBundle;
    loadError = null;
    return cachedBundle;
  } catch (err) {
    loadError = err instanceof Error ? err.message : "fetch failed";
    return null;
  }
}

export function getPublishedLoadError(): string | null {
  return loadError;
}

export function isUsingPublishedData(): boolean {
  return cachedBundle !== null;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}

export async function mapCountryTrends(
  geocodes: Record<string, { country: string; latitude: number; longitude: number }>,
): Promise<AMRCountryTrend[]> {
  const bundle = await loadDashboardBundle();
  if (!bundle) return [];

  const dominant = new Map<string, { organism: string; drug: string }>();
  for (const table of [bundle.clusterTypologyBacterial, bundle.clusterTypologyFungal]) {
    for (const row of table) {
      const iso = str(row.iso3_country);
      const pathogen = str(row.pathogen_type);
      const key = `${pathogen}:${iso}`;
      if (!dominant.has(key)) {
        dominant.set(key, {
          organism: str(row.canonical_organism, "Surveillance aggregate"),
          drug: str(row.canonical_drug, "—"),
        });
      }
    }
  }

  const rows: AMRCountryTrend[] = [];
  const tables: Array<{ pathogen: "bacterial" | "fungal"; data: Record<string, unknown>[] }> = [
    { pathogen: "bacterial", data: bundle.countryRiskBacterial },
    { pathogen: "fungal", data: bundle.countryRiskFungal },
  ];

  for (const { pathogen, data } of tables) {
    for (const row of data) {
      const iso = str(row.iso3_country);
      const geo = geocodes[iso] ?? { country: iso, latitude: 0, longitude: 0 };
      const dom = dominant.get(`${pathogen}:${iso}`);
      const trajectory = num(row.trajectory_risk_percentile);
      const burden = num(row.burden_midpoint_weighted);
      const trendLabel =
        trajectory >= 75
          ? "surging"
          : trajectory >= 55
            ? "rising"
            : trajectory <= 25
              ? "declining"
              : "stable";
      const gate = str(row.quality_gate, "pass");
      const dataQuality = gate === "pass" ? 0.85 : gate === "bounds_only" ? 0.45 : 0.2;

      rows.push({
        iso3: iso,
        country: geo.country,
        latitude: geo.latitude,
        longitude: geo.longitude,
        pathogenType: pathogen,
        latestYear: new Date().getFullYear() - 1,
        riskScore: num(row.composite_risk_score_core ?? row.composite_risk_score),
        earlyWarningScore: trajectory,
        resistanceRate: Math.min(1, Math.max(0, burden)),
        trendLabel,
        lifeExpectancy: num(row.life_expectancy),
        dominantOrganism: dom?.organism ?? "—",
        dominantDrug: dom?.drug ?? "—",
        fundingMismatch: 0,
        predictedLifeGain: 0,
        recommendedIntervention:
          gate === "withhold" ? "Withheld — see ledger" : "See policy deliverable",
        confidence: dataQuality,
        evidenceLevel: gate,
        dataQuality,
        qualityGate: gate,
        gateReason: str(row.gate_reason),
      });
    }
  }
  return rows;
}

export async function mapPathogenSignals(): Promise<PathogenSignal[]> {
  const bundle = await loadDashboardBundle();
  if (!bundle) return [];

  const geocodes = (await import("./iso3-geocodes.json")).default as Record<
    string,
    { country: string }
  >;

  const signals: PathogenSignal[] = [];
  for (const table of [bundle.clusterTypologyBacterial, bundle.clusterTypologyFungal]) {
    for (const row of table.slice(0, 80)) {
      const iso = str(row.iso3_country);
      signals.push({
        id: `${row.pathogen_type}-${iso}-${row.canonical_organism}-${row.canonical_drug}`,
        organism: str(row.canonical_organism),
        drug: str(row.canonical_drug),
        pathogenType: str(row.pathogen_type) as "bacterial" | "fungal",
        country: geocodes[iso]?.country ?? iso,
        resistanceRate: Math.min(1, num(row.static_burden_midpoint)),
        micShift: Math.abs(num(row.evolutionary_trajectory_slope)),
        evolutionaryFitness: Math.abs(num(row.evolutionary_trajectory_slope)) * 10,
        distanceToFailure: 1 - Math.min(1, num(row.static_burden_midpoint)),
        confidence: str(row.quality_gate) === "pass" ? 0.8 : 0.4,
        recommendation: str(row.typology_label, "moderate"),
        typologyLabel: str(row.typology_label),
        qualityGate: str(row.quality_gate),
      });
    }
  }
  return signals;
}

export async function mapFundingRows(): Promise<FundingRow[]> {
  const bundle = await loadDashboardBundle();
  if (!bundle) return [];
  return bundle.fundingGap
    .filter((r) => str(r.deliverable_level) === "organism")
    .map((r) => ({
      organism: str(r.canonical_organism),
      pathogenType: str(r.pathogen_type),
      burdenShare: num(r.burden_share),
      fundingShare: num(r.funding_share),
      gap: num(r.funding_minus_burden_share),
      alignmentDirection: str(r.alignment_direction),
    }));
}

export async function mapInterventions(): Promise<InterventionRow[]> {
  const bundle = await loadDashboardBundle();
  if (!bundle) return [];
  return bundle.interventions.map((r) => ({
    pathogenType: str(r.pathogen_type),
    interventionCategory: str(r.intervention_category),
    subMeasure: str(r.sub_measure),
    dataStatus: str(r.data_status),
    estimatedLeGainYears: r.estimated_le_gain_years == null ? null : num(r.estimated_le_gain_years),
    qualityGate: str(r.quality_gate),
    gateReason: str(r.gate_reason),
    priorityRank: r.priority_rank == null ? null : num(r.priority_rank),
    evidenceCaveat: str(r.evidence_caveat),
  }));
}

export async function mapClusterRows(): Promise<ClusterRow[]> {
  const bundle = await loadDashboardBundle();
  if (!bundle) return [];

  const labels = new Map<string, { count: number; risk: number; gate: string }>();
  for (const row of [...bundle.clusterTypologyBacterial, ...bundle.clusterTypologyFungal]) {
    const label = str(row.typology_label, "moderate");
    const prev = labels.get(label) ?? { count: 0, risk: 0, gate: "pass" };
    labels.set(label, {
      count: prev.count + 1,
      risk: Math.max(prev.risk, num(row.composite_priority_score)),
      gate: str(row.quality_gate, prev.gate),
    });
  }

  return [...labels.entries()].map(([label, info]) => ({
    cluster: label,
    label: label.replace(/_/g, " "),
    countries: `${info.count} organism–drug–country rows`,
    action: label.includes("trajectory") ? "Early stewardship / diagnostics" : "Monitor burden",
    risk: Math.round(info.risk),
    qualityGate: info.gate,
  }));
}
