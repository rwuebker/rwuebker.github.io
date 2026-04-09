import { IntentAction, SignalScopeReport, AskResponse } from "./types";
import { SIGNALSCOPE_API_BASE } from "./config";

// Module-level cache; replaced by session state in a future iteration.
let lastReport: any = null;

export function getLastReport(): any {
  return lastReport;
}

export async function askQuestion(
  question: string,
  report: any,
  section?: string
): Promise<AskResponse> {
  const response = await fetch(`${SIGNALSCOPE_API_BASE}/analyze/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, report, ...(section ? { section } : {}) }),
  });

  if (!response.ok) {
    throw new Error(`SignalScope ask error: ${response.status}`);
  }

  return response.json();
}

export async function executeAction(
  intent: IntentAction
): Promise<SignalScopeReport> {
  if (intent.action === "analyze_signal") {
    const source = intent.source ?? "noise";

    const response = await fetch(
      `${SIGNALSCOPE_API_BASE}/analyze/report?source=${encodeURIComponent(source)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: intent.signal ?? null,
          signal_metadata: intent.signal_metadata ?? null,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`SignalScope API error: ${response.status}`);
    }

    const result: SignalScopeReport = await response.json();
    if ((result as any).valid === false) {
      throw new Error((result as any).message ?? "SignalScope analysis failed.");
    }
    lastReport = result;
    return result;
  }

  if (intent.action === "generate_signal") {
    const preset = intent.preset ?? "noise";
    const params = intent.params ?? {};

    const response = await fetch(`${SIGNALSCOPE_API_BASE}/generate/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset, params }),
    });

    if (!response.ok) {
      throw new Error(`SignalScope generate error: ${response.status}`);
    }

    const result: SignalScopeReport = await response.json();
    if ((result as any).valid === false) {
      throw new Error((result as any).message ?? "SignalScope generation failed.");
    }
    lastReport = result;
    return result;
  }

  if (intent.action === "analyze_feature_signal") {
    const source = intent.source ?? "linear_factor";
    const featureId = intent.feature_id ?? "moving_average";
    const params = intent.params ?? {};

    const response = await fetch(
      `${SIGNALSCOPE_API_BASE}/featurescope/analyze?source=${encodeURIComponent(source)}&feature_id=${encodeURIComponent(featureId)}&value_column=signal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params }),
      }
    );

    if (!response.ok) {
      throw new Error(`SignalScope feature analysis error: ${response.status}`);
    }

    const result: SignalScopeReport = await response.json();
    if ((result as any).valid === false) {
      throw new Error((result as any).message ?? "Feature analysis failed.");
    }
    lastReport = result;
    return result;
  }

  if (intent.action === "analyze_factorscope") {
    const source = intent.source ?? "linear_factor";
    const factorSet = intent.factor_set ?? "ff3";
    const response = await fetch(
      `${SIGNALSCOPE_API_BASE}/factorscope/report?source=${encodeURIComponent(source)}&factor_set=${encodeURIComponent(factorSet)}`,
      { method: "POST" }
    );

    if (!response.ok) {
      throw new Error(`FactorScope API error: ${response.status}`);
    }

    const data = await response.json();
    if ((data as any).valid === false) {
      throw new Error((data as any).message ?? "FactorScope analysis failed.");
    }
    const result: SignalScopeReport = {
      interpretation:
        "FactorScope analysis completed. Review controlled coefficients and residual alpha below.",
      metrics: {},
      factorscope_report: data,
      sections: [],
    } as SignalScopeReport;
    lastReport = result;
    return result;
  }

  if (intent.action === "explain_last_result") {
    if (!lastReport) {
      throw new Error("No previous result to explain.");
    }
    return lastReport;
  }

  throw new Error(`Unknown action: ${intent.action}`);
}
