"use client";

import { useState } from "react";
import { routeUserInput } from "@/lib/signalscope/router";
import { executeAction } from "@/lib/signalscope/actions";
import { SIGNALSCOPE_API_BASE } from "@/lib/signalscope/config";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function generateSuggestion(report: any): string | null {
  if (!report?.conclusion?.type) return null;

  const type = report.conclusion.type;

  if (type === "factor-driven") {
    return "This looks factor-driven. Want to compare it to a random signal?";
  }

  if (type === "independent alpha") {
    return "This may contain alpha. Want to test its stability or compare to random?";
  }

  return "Want to analyze another signal or compare this one?";
}

function formatReport(report: any): string {
  const lines: string[] = [];

  if (!report || !report.sections) {
    return "Invalid report structure";
  }

  // Helper to get section by title
  const getSection = (title: string) =>
    report.sections.find((s: any) => s.title === title);

  // LLM Interpretation
  const interpretation = getSection("LLM Interpretation");
  if (interpretation?.content) {
    lines.push(`Interpretation: ${interpretation.content}`);
  }

  // Predictive Power
  const predictive = getSection("Predictive Power");
  if (predictive?.content) {
    const ic = predictive.content.ic;
    const rankIc = predictive.content.rank_ic;

    if (typeof ic === "number") {
      lines.push(`IC: ${ic.toFixed(4)}`);
    }

    if (typeof rankIc === "number") {
      lines.push(`Rank IC: ${rankIc.toFixed(4)}`);
    }
  }

  // Quantile Analysis
  const quantile = getSection("Quantile Analysis");
  if (quantile?.content) {
    const spread = quantile.content.spread;
    if (typeof spread === "number") {
      lines.push(`Spread: ${spread.toFixed(4)}`);
    }

    if (quantile.content.monotonic !== undefined) {
      lines.push(`Monotonic: ${quantile.content.monotonic ? "Yes" : "No"}`);
    }
  }

  // Stability
  const stability = getSection("Stability");
  if (stability?.content) {
    const mean = stability.content.cs_ic_mean;
    const std = stability.content.cs_ic_std;

    if (typeof mean === "number") {
      lines.push(`CS IC Mean: ${mean.toFixed(4)}`);
    }

    if (typeof std === "number") {
      lines.push(`CS IC Std: ${std.toFixed(4)}`);
    }
  }

  // Factor Decomposition
  const factor = getSection("Factor Decomposition");
  if (factor?.content) {
    const beta = factor.content.beta;
    const alpha = factor.content.alpha;

    if (typeof beta === "number") {
      lines.push(`Beta: ${beta.toFixed(4)}`);
    }

    if (typeof alpha === "number") {
      lines.push(`Alpha: ${alpha.toFixed(4)}`);
    }
  }

  return lines.join("\n");
}

export default function SignalScopeDemoPage() {
  console.log("API BASE:", SIGNALSCOPE_API_BASE);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    const normalized = input.toLowerCase().trim();

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    if (normalized === "yes" || normalized.includes("compare")) {
      try {
        const result = await executeAction({
          action: "analyze_signal",
          source: "random",
        });

        const suggestion = generateSuggestion(result);

        const assistantMessage: Message = {
          role: "assistant",
          content:
            formatReport(result) +
            (suggestion ? `\n\n→ ${suggestion}` : ""),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error running comparison." },
        ]);
      } finally {
        setLoading(false);
      }

      return;
    }

    try {
      const route = await routeUserInput(userMessage.content);
      const result = await executeAction(route);

      const suggestion = generateSuggestion(result);

      const assistantMessage: Message = {
        role: "assistant",
        content:
          formatReport(result) +
          (suggestion ? `\n\n→ ${suggestion}` : ""),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage: Message = {
        role: "assistant",
        content: "Error processing request.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <div className="max-w-2xl mx-auto w-full px-6 py-12 flex flex-col flex-1">
        <h1 className="text-2xl font-semibold mb-1">SignalScope Demo</h1>
        <p className="text-neutral-400 text-sm mb-8">
          Try: &quot;analyze momentum signal&quot; or &quot;analyze random
          signal&quot;
        </p>

        <div className="flex flex-col gap-4 mb-6 min-h-[300px]">
          {messages.length === 0 && (
            <p className="text-neutral-600 text-sm">No messages yet.</p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={msg.role === "user" ? "text-right" : "text-left"}
            >
              <span className="text-xs text-neutral-500 block mb-1">
                {msg.role === "user" ? "You" : "SignalScope"}
              </span>
              <div
                className={`inline-block px-4 py-3 rounded-md text-sm whitespace-pre-wrap max-w-prose ${
                  msg.role === "user"
                    ? "bg-neutral-800 text-neutral-100"
                    : "bg-neutral-900 border border-neutral-800 text-neutral-200"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-left">
              <span className="text-xs text-neutral-500 block mb-1">
                SignalScope
              </span>
              <div className="inline-block px-4 py-3 rounded-md text-sm bg-neutral-900 border border-neutral-800 text-neutral-400">
                Analyzing signal...
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-md text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-neutral-100 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
