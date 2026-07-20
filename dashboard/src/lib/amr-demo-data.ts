export type PathogenType = "all" | "bacterial" | "fungal";

export type TrendLabel = "declining" | "stable" | "rising" | "surging";

export type AMRCountryTrend = {
  iso3: string;
  country: string;
  latitude: number;
  longitude: number;
  pathogenType: "bacterial" | "fungal";
  latestYear: number;
  riskScore: number | null;
  earlyWarningScore: number;
  resistanceRate: number;
  trendLabel: TrendLabel;
  lifeExpectancy: number;
  dominantOrganism: string;
  dominantDrug: string;
  fundingMismatch: number | null;
  predictedLifeGain: number | null;
  predictedLifeGainSampleCount: number;
  recommendedIntervention: string;
  confidence: number;
  evidenceLevel: string;
  dataQuality: number;
  qualityGate?: string;
  gateReason?: string;
};

export type PathogenSignal = {
  id: string;
  organism: string;
  drug: string;
  pathogenType: "bacterial" | "fungal";
  country: string;
  resistanceRate: number;
  micShift: number;
  evolutionaryFitness: number;
  distanceToFailure: number;
  confidence: number;
  recommendation: string;
  typologyLabel?: string;
  qualityGate?: string;
};

export type FundingRow = {
  organism: string;
  pathogenType: string;
  burdenShare: number;
  fundingShare: number;
  gap: number;
  alignmentDirection: string;
};

export type InterventionRow = {
  pathogenType: string;
  interventionCategory: string;
  subMeasure: string;
  dataStatus: string;
  estimatedLeGainYears: number | null;
  qualityGate: string;
  gateReason: string;
  priorityRank: number | null;
  evidenceCaveat: string;
};

export type ClusterRow = {
  cluster: string;
  label: string;
  countries: string;
  action: string;
  risk: number;
  qualityGate?: string;
};

export type CountryYearRow = {
  pathogenType: "bacterial" | "fungal";
  iso3: string;
  year: number;
  lifeExpectancy: number;
  burden: number | null;
  qualityGate: string;
};

export type FundingByYearRow = {
  year: number;
  pathogenType: string;
  amountUsd: number;
};

/** Minimal demo fallback when published bundle is unavailable (dev only). */
export const demoCountryTrends: AMRCountryTrend[] = [
  {
    iso3: "TUR",
    country: "Turkey",
    latitude: 38.9637,
    longitude: 35.2433,
    pathogenType: "bacterial",
    latestYear: 2021,
    riskScore: 72,
    earlyWarningScore: 68,
    resistanceRate: 0.42,
    trendLabel: "rising",
    lifeExpectancy: 77.7,
    dominantOrganism: "Streptococcus pneumoniae",
    dominantDrug: "Penicillin",
    fundingMismatch: 0.35,
    predictedLifeGain: 0.3,
    predictedLifeGainSampleCount: 5,
    recommendedIntervention: "See gated policy table",
    confidence: 0.55,
    evidenceLevel: "demo",
    dataQuality: 0.5,
  },
];

export const clusterRows: ClusterRow[] = [
  {
    cluster: "demo",
    label: "Awaiting published typology",
    countries: "—",
    action: "Run pipeline publish",
    risk: 0,
  },
];

export const fundingRows: FundingRow[] = [];

export const interventionLevers: Array<{
  key: string;
  label: string;
  appliesTo: string;
  defaultValue: number;
  effect: number;
}> = [];
