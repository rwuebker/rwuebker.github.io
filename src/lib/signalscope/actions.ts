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
    const source = intent.source ?? "random";

    const response = await fetch(
      `${SIGNALSCOPE_API_BASE}/analyze/report?source=${encodeURIComponent(source)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signal: intent.signal ?? null,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`SignalScope API error: ${response.status}`);
    }

    const result: SignalScopeReport = await response.json();
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
