import { SIGNALSCOPE_API_BASE } from "./config";
import { getLastReport, askQuestion } from "./actions";
import { AskResponse } from "./types";

export type RouteResult =
  | { type: "action"; action: string; source?: string }
  | { type: "ask"; askResponse: AskResponse };

export async function routeUserInput(
  message: string,
  section?: string
): Promise<RouteResult> {
  const lastReport = getLastReport();

  // If a report is loaded, route through /analyze/ask first.
  if (lastReport) {
    try {
      const askResponse = await askQuestion(message, lastReport, section);
      // If the backend returned a meaningful answer or clarification, use it.
      if (askResponse.answer != null || askResponse.clarification != null) {
        return { type: "ask", askResponse };
      }
    } catch (err) {
      console.error("Ask error, falling back to action routing:", err);
    }
  }

  // Fall back to /chat/route for analysis intents.
  try {
    const res = await fetch(`${SIGNALSCOPE_API_BASE}/chat/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) throw new Error("Failed to route user input");

    const data = await res.json();
    return { type: "action", ...data };
  } catch (err) {
    console.error("Router error:", err);
    return { type: "action", action: "analyze_signal", source: "momentum" };
  }
}
