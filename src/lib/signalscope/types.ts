export interface IntentAction {
  action: string;
  source?: string;
  explanation?: string;
  signal?: any[];
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
  sections?: any[];
  _introspection?: {
    summary: string;
    details: Record<string, any>;
  };
  [key: string]: any;
}
