export interface Bill {
  month: string;
  consumption: number;
  amount: number;
  isEstimated?: boolean;
}

export interface Tier {
  from: number;
  to: number;
  rate: number;
}

export interface SeasonalAnalysis {
  summerAvg: number;
  winterAvg: number;
  spikePercentage: number;
  baseLoad: number;
  coolingLoad: number;
}

export interface SystemRecommendation {
  systemSize: number;
  panelCount: number;
  spaceRequired: number;
  annualProduction: number;
  inverterCapacity: number;
  batteryCapacity: number;
  summerCoverage: number;
  winterCoverage: number;
  annualCoverage: number;
}

export interface FinancialAnalysis {
  annualSavings: number;
  paybackPeriod: number;
  roi25Year: number;
  netMeteringCredits: number;
}