import { IntentAction, SignalScopeReport } from "./types";
import { SIGNALSCOPE_API_BASE } from "./config";

// Module-level cache; replaced by session state in a future iteration.
let lastResult: SignalScopeReport | null = null;

export async function executeAction(
  intent: IntentAction
): Promise<SignalScopeReport> {
  if (intent.action === "analyze_signal") {
    const source = intent.source ?? "momentum";

    const hasSignal = Array.isArray(intent.signal) && intent.signal.length > 0;

    const response = hasSignal
      ? await fetch(`${SIGNALSCOPE_API_BASE}/analyze/report?source=momentum`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signal: intent.signal }),
        })
      : await fetch(
          `${SIGNALSCOPE_API_BASE}/analyze/report?source=${encodeURIComponent(source)}`,
          { method: "POST" }
        );

    if (!response.ok) {
      throw new Error(`SignalScope API error: ${response.status}`);
    }

    const result: SignalScopeReport = await response.json();
    lastResult = result;
    return result;
  }

  if (intent.action === "explain_last_result") {
    if (!lastResult) {
      throw new Error("No previous result to explain.");
    }
    return lastResult;
  }

  throw new Error(`Unknown action: ${intent.action}`);
}
