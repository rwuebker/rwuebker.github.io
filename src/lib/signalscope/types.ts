export interface IntentAction {
  action: string;
  source?: string;
  explanation?: string;
}

export interface SignalScopeReport {
  interpretation: string;
  metrics: {
    ic?: number;
    rank_ic?: number;
  };
  conclusion?: {
    type: string;
    confidence: string;
  };
}
