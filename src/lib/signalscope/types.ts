export interface IntentAction {
  action: string;
  source?: string;
  explanation?: string;
  signal?: any[];
  signal_metadata?: {
    description?: string;
    frequency?: "daily" | "weekly" | "monthly";
    units?: string;
    theory_name?: string;
    hypothesis?: string;
    references?: Array<{
      title: string;
      url: string;
      kind?: "primary" | "secondary" | "tertiary";
    }>;
    data_sources?: string[];
  };
  preset?: string;
  params?: Record<string, any>;
}

export interface AskResponse {
  answer?: string;
  section?: string;
  citations?: string[];
  clarification?: {
    message: string;
    options: string[];
  };
}

export interface AnalysisContext {
  complete: boolean;
  signal_source: string;
  return_source: string;
  return_definition: string;
  universe: {
    selection: string;
    asset_count: number | null;
  };
  frequency: string;
  alignment: string;
  date_range: {
    start: string | null;
    end: string | null;
  };
  provenance: {
    dataset_type: string;
    source: string;
    description: string;
  };
  warnings: string[];
}

export interface SignalScopeReport {
  interpretation: string;
  metrics: {
    ic?: number;
    rank_ic?: number;
  };
  analysis_context?: AnalysisContext;
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
