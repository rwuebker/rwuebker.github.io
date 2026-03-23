"use client";

import { useState, useEffect, useRef } from "react";
import { routeUserInput } from "@/lib/signalscope/router";
import { executeAction } from "@/lib/signalscope/actions";
import { SIGNALSCOPE_API_BASE } from "@/lib/signalscope/config";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function generateSuggestion(
  report: any,
  lastSource: string | null,
  previousSource: string | null
): string | null {
  if (!report?.conclusion?.type) return null;

  const type = report.conclusion.type;

  // === CASE 1: Comparison just happened ===
  if (previousSource === "momentum" && lastSource === "random") {
    return "This comparison shows the original signal is much stronger than noise. Want to test its stability or explore residual alpha?";
  }

  // === CASE 2: First-time analysis ===
  if (type === "factor-driven") {
    return "This looks factor-driven. Want to compare it to a random signal?";
  }

  if (type === "independent alpha") {
    return "This may contain alpha. Want to test its stability or compare to random?";
  }

  // fallback
  return "Want to analyze another signal or explore this one further?";
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

function generateRiskInsight(report: any, query: string): string | null {
  if (!report) return null;

  const q = query.toLowerCase();

  if (
    q.includes("risk") ||
    q.includes("drawdown") ||
    q.includes("stable") ||
    q.includes("robust") ||
    q.includes("fail")
  ) {
    const factor = report?.sections?.find(
      (s: any) => s.title === "Factor Decomposition"
    )?.content;

    const stability = report?.sections?.find(
      (s: any) => s.title === "Stability"
    )?.content;

    const quant = report?.sections?.find(
      (s: any) => s.title === "Quantile Analysis"
    )?.content;

    if (!factor && !stability && !quant) {
      return "No risk-related data available.";
    }

    const beta = factor?.beta ?? null;
    const alpha = factor?.alpha ?? null;
    const residualStd = factor?.residual_std ?? null;
    const csIcStd = stability?.cs_ic_std ?? null;
    const spread = quant?.spread ?? null;

    const lines: string[] = [];
    lines.push("Risk Intuition:");
    lines.push("");

    if (typeof beta === "number") {
      lines.push(`Factor Exposure Risk: Beta = ${beta.toFixed(2)}`);
      lines.push(
        beta > 1
          ? "This suggests the strategy is meaningfully exposed to its underlying factor and may underperform if that factor weakens."
          : "This suggests more limited factor sensitivity."
      );
      lines.push("");
    }

    if (typeof csIcStd === "number") {
      lines.push(`Stability Risk: Cross-sectional IC Std = ${csIcStd.toFixed(4)}`);
      lines.push(
        csIcStd < 0.1
          ? "Signal behavior appears stable across periods, reducing robustness concerns."
          : "Signal behavior appears unstable across periods, which raises robustness concerns."
      );
      lines.push("");
    }

    if (typeof residualStd === "number") {
      lines.push(`Residual Risk: Residual Std = ${residualStd.toFixed(4)}`);
      lines.push(
        residualStd < 0.1
          ? "Low unexplained variance suggests tight factor fit, but also implies limited independent diversification."
          : "High unexplained variance suggests either noise or unmodeled sources of return."
      );
      lines.push("");
    }

    if (typeof spread === "number") {
      lines.push(`Drawdown Intuition: Spread = ${spread.toFixed(4)}`);
      lines.push(
        spread > 0.1
          ? "The signal appears economically meaningful, but future drawdowns could still occur if the spread compresses or reverses."
          : "The signal spread is small, so even modest trading frictions or regime shifts could eliminate profitability."
      );
    }

    if (typeof alpha === "number" && Math.abs(alpha) < 0.01) {
      lines.push("");
      lines.push(
        "Overall, this strategy appears more exposed to factor risk than supported by independent alpha."
      );
    }

    return lines.join("\n");
  }

  return null;
}

function generatePnLInsight(report: any, query: string): string | null {
  if (!report) return null;

  const q = query.toLowerCase();

  if (
    q.includes("pnl") ||
    q.includes("profit") ||
    q.includes("returns") ||
    q.includes("how profitable")
  ) {
    const quant = report?.sections?.find(
      (s: any) => s.title === "Quantile Analysis"
    )?.content;

    const stability = report?.sections?.find(
      (s: any) => s.title === "Stability"
    )?.content;

    if (!quant) return "No data available.";

    const spread = quant.spread;
    const stabilityScore = stability?.cs_ic_std ?? 1;

    return `PnL Intuition:

The long/short spread of ${spread.toFixed(4)} represents the expected return differential between top and bottom signals.

This implies ${
      spread > 0.1
        ? "strong potential profitability for a market-neutral strategy."
        : "limited profitability and weak economic signal."
    }

${
  stabilityScore < 0.1
    ? "The low variability in IC suggests returns would likely be consistent over time."
    : "High variability in IC suggests returns may be unstable and regime-dependent."
}`;
  }

  return null;
}

function generateLongShortInsight(report: any, query: string): string | null {
  if (!report) return null;

  const q = query.toLowerCase();

  if (
    q.includes("long short") ||
    q.includes("long/short") ||
    q.includes("trade this") ||
    q.includes("portfolio")
  ) {
    const quant = report?.sections?.find(
      (s: any) => s.title === "Quantile Analysis"
    )?.content;

    if (!quant) return "No quantile data available.";

    const spread = quant.spread;
    const top = quant.quantiles?.find((x: any) => x.quantile === 5);
    const bottom = quant.quantiles?.find((x: any) => x.quantile === 1);

    return `Long/Short Portfolio Construction:

Long: Top quantile (Q5) → mean return ${top.mean_return.toFixed(4)}
Short: Bottom quantile (Q1) → mean return ${bottom.mean_return.toFixed(4)}

Expected spread (Q5 - Q1): ${spread.toFixed(4)}

This indicates ${
      spread > 0.1
        ? "a strong cross-sectional signal suitable for a market-neutral long/short strategy."
        : "a weak signal with limited economic value for long/short construction."
    }`;
  }

  return null;
}

function isUnsupportedQuery(query: string): boolean {
  const q = query.toLowerCase();

  return (
    q.includes("which factor") ||
    q.includes("what factor") ||
    q.includes("factor breakdown") ||
    q.includes("sector") ||
    q.includes("exposure breakdown")
  );
}

function generateLimitResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes("factor")) {
    return `This model estimates aggregate factor exposure (beta), but does not decompose returns into specific factors such as value, momentum, or size.

Identifying individual factor contributions would require extending the analysis to a multi-factor model.`;
  }

  if (q.includes("sector") || q.includes("breakdown")) {
    return `The current analysis does not include sector- or factor-level decomposition.

Extending this would require additional feature inputs and a more granular attribution model.`;
  }

  return `This query is outside the scope of the current model.

The system focuses on signal evaluation, predictive power, and factor exposure rather than detailed attribution.`;
}

function extractSection(report: any, title: string) {
  return report?.sections?.find((s: any) => s.title === title)?.content;
}

function generateDeepInsight(
  report: any,
  query: string
): string | null {
  if (!report) return null;

  const q = query.toLowerCase();

  // === STABILITY ===
  if (q.includes("stability")) {
    const stability = extractSection(report, "Stability");

    if (!stability) return "No stability data available.";

    return `Stability Analysis:
Mean IC: ${stability.cs_ic_mean.toFixed(4)}
Std Dev: ${stability.cs_ic_std.toFixed(4)}

This indicates ${
      stability.cs_ic_std < 0.1
        ? "highly consistent performance over time."
        : "unstable and inconsistent performance."
    }`;
  }

  // === FACTOR EXPLANATION ===
  if (q.includes("why") || q.includes("factor")) {
    const factor = extractSection(report, "Factor Decomposition");

    if (!factor) return "No factor decomposition available.";

    return `Factor Explanation:
Beta: ${factor.beta.toFixed(2)}
Alpha: ${factor.alpha.toFixed(4)}

This signal is ${
      Math.abs(factor.alpha) < 0.01
        ? "primarily driven by factor exposure rather than independent alpha."
        : "showing signs of independent alpha beyond factor exposure."
    }`;
  }

  // === RESIDUAL ANALYSIS ===
  if (q.includes("residual")) {
    const factor = extractSection(report, "Factor Decomposition");

    if (!factor) return "No residual data available.";

    return `Residual Analysis:
Residual Std: ${factor.residual_std.toFixed(4)}

This suggests ${
      factor.residual_std < 0.1
        ? "low unexplained variance (tight factor fit)."
        : "high unexplained variance (potential alpha or noise)."
    }`;
  }

  return null;
}

export default function SignalScopeDemoPage() {
  console.log("API BASE:", SIGNALSCOPE_API_BASE);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSource, setLastSource] = useState<string | null>(null);
  const [previousSource, setPreviousSource] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

        setLastResult(result);

        // compute next context BEFORE updating state
        const nextPrevious = lastSource;
        const nextLast = "random";

        // generate suggestion using NEXT state
        const suggestion = generateSuggestion(result, nextLast, nextPrevious);

        // update React state
        setPreviousSource(nextPrevious);
        setLastSource(nextLast);

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

    if (isUnsupportedQuery(input)) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: generateLimitResponse(input) },
      ]);
      setLoading(false);
      return;
    }

    const risk = generateRiskInsight(lastResult, input);

    if (risk) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: risk },
      ]);
      setLoading(false);
      return;
    }

    const pnl = generatePnLInsight(lastResult, input);

    if (pnl) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: pnl },
      ]);
      setLoading(false);
      return;
    }

    const longShort = generateLongShortInsight(lastResult, input);

    if (longShort) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: longShort },
      ]);
      setLoading(false);
      return;
    }

    const deepInsight = generateDeepInsight(lastResult, input);

    if (deepInsight) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: deepInsight },
      ]);
      setLoading(false);
      return;
    }

    try {
      const route = await routeUserInput(userMessage.content);
      const result = await executeAction(route);

      setLastResult(result);

      // compute next context BEFORE updating state
      const nextPrevious = lastSource;
      const nextLast = route.source || null;

      // generate suggestion using NEXT state (not stale React state)
      const suggestion = generateSuggestion(result, nextLast, nextPrevious);

      // now update React state
      setPreviousSource(nextPrevious);
      setLastSource(nextLast);

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
          <div ref={chatEndRef} />
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
