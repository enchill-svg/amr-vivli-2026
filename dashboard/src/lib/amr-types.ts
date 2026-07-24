export type PathogenType = "all" | "bacterial" | "fungal";

export type TrendLabel = "declining" | "stable" | "rising" | "surging" | "unknown";

export type AMRCountryTrend = {
  iso3: string;
  country: string;
  latitude: number;
  longitude: number;
  pathogenType: "bacterial" | "fungal";
  latestYear: number;
  riskScore: number | null;
  earlyWarningScore: number | null;
  resistanceRate: number;
  trendLabel: TrendLabel;
  lifeExpectancy: number | null;
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
  lifeExpectancy: number | null;
  burden: number | null;
  qualityGate: string;
};

export type FundingByYearRow = {
  year: number;
  pathogenType: string;
  amountUsd: number;
};
