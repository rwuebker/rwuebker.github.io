/* eslint-disable @typescript-eslint/no-explicit-any */

export interface IntentAction {
  action: string;
  source?: string;
  feature_id?: string;
  factor_set?: string;
  execution_model?: Record<string, any>;
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
  details?: Record<
    string,
    {
      summary?: string;
      assumptions?: string[];
      equations?: string[];
      distributions?: string[];
      validation_checks?: string[];
      citations?: Array<{
        title?: string;
        url?: string;
        kind?: string;
        relevance?: string;
      }>;
    }
  >;
  warnings: string[];
}

export interface ResearchReport {
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
  factorscope_report?: Record<string, any>;
  returnscope_report?: Record<string, any>;
  [key: string]: any;
}

export interface ProjectBlockState {
  block_id: string;
  title: string;
  state: "locked" | "unlocked" | "active" | "complete" | "warning";
  reason_code: string;
  reason: string;
  prerequisites: string[];
  completion: Record<string, boolean>;
  payload: Record<string, any>;
  updated_at: string;
}

export interface ResearchProjectState {
  project_id: string;
  chat_mode: "discussion" | "execution";
  blocks: Record<string, ProjectBlockState>;
  transition_events: Array<{
    timestamp: string;
    block_id: string;
    from_state: string;
    to_state: string;
    reason: string;
  }>;
  updated_at: string;
}

export interface ResearchProjectGuidance {
  next_block: string | null;
  summary: string;
  actions: Array<{
    block_id: string;
    title: string;
    priority: "next" | "warning" | "blocked";
    message: string;
  }>;
}
