import { SIGNALSCOPE_API_BASE } from "./config";

export async function routeUserInput(message: string) {
  try {
    const res = await fetch(`${SIGNALSCOPE_API_BASE}/chat/route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      throw new Error("Failed to route user input");
    }

    const data = await res.json();

    return data;
  } catch (err) {
    console.error("Router error:", err);

    // fallback
    return {
      action: "analyze_signal",
      source: "momentum",
    };
  }
}
