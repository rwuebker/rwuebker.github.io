"use client";

import { useState, useEffect, useRef } from "react";
import { routeUserInput } from "@/lib/signalscope/router";
import { executeAction } from "@/lib/signalscope/actions";
import { SIGNALSCOPE_API_BASE } from "@/lib/signalscope/config";

interface Message {
  role: "user" | "assistant";
  content: string;
  _introspection?: {
    summary: string;
    details: Record<string, any>;
  };
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

function generateComparisonInsight(current: any, baseline: any, label: string): string {
  const getSection = (res: any, title: string) =>
    res.sections?.find((s: any) => s.title === title)?.content;

  const curPred = getSection(current, "Predictive Power");
  const basePred = getSection(baseline, "Predictive Power");

  const curQuant = getSection(current, "Quantile Analysis");
  const baseQuant = getSection(baseline, "Quantile Analysis");

  if (!curPred || !basePred || !curQuant || !baseQuant) {
    return "Unable to compare signals due to missing data.";
  }

  const icDiff = curPred.ic - basePred.ic;
  const spreadDiff = curQuant.spread - baseQuant.spread;

  const labelName = label === "momentum"
    ? "momentum signal"
    : "random signal";

  const absIcDiff = Math.abs(icDiff);
  const absSpreadDiff = Math.abs(spreadDiff);

  let summary = `Relative to the ${labelName}, the provided signal is `;

  if (absIcDiff > 0.05 || absSpreadDiff > 0.05) {
    summary += icDiff > 0
      ? `stronger, with higher predictive power (IC)`
      : `weaker, with lower predictive power (IC)`;
  } else {
    summary += `similar in strength`;
  }

  if (absSpreadDiff > 0.05) {
    summary += spreadDiff > 0
      ? ` and a stronger long/short spread. `
      : ` and a weaker long/short spread. `;
  } else {
    summary += `. `;
  }

  summary += `The IC difference is ${absIcDiff.toFixed(3)} and the spread difference is ${absSpreadDiff.toFixed(3)}.`;

  if (curQuant.spread < 0) {
    summary += ` The provided signal appears inversely predictive (negative spread), so a flipped long/short construction may be more appropriate.`;
  }

  return summary;
}

function generateDecisionInsight(result: any, input: string): string | null {
  if (!result) return null;

  const q = input.toLowerCase();

  if (
    !q.includes("should") &&
    !q.includes("trade") &&
    !q.includes("good") &&
    !q.includes("worth") &&
    !q.includes("invest")
  ) {
    return null;
  }

  const sections = result.sections || [];

  const predictive = sections.find((s: any) => s.title === "Predictive Power")?.content;
  const quant = sections.find((s: any) => s.title === "Quantile Analysis")?.content;
  const stability = sections.find((s: any) => s.title === "Stability")?.content;
  const factor = sections.find((s: any) => s.title === "Factor Decomposition")?.content;

  if (!predictive || !quant || !stability || !factor) return null;

  const ic = predictive.ic;
  const spread = quant.spread;
  const csStd = stability.cs_ic_std;
  const alpha = factor.alpha;

  let score = 0;

  if (Math.abs(ic) > 0.05) score += 1;
  if (Math.abs(ic) > 0.1) score += 1;

  if (Math.abs(spread) > 0.02) score += 1;
  if (Math.abs(spread) > 0.05) score += 1;

  if (csStd < 0.2) score += 1;

  if (Math.abs(alpha) > 0.01) score += 1;

  let verdict = "";
  const reasoning: string[] = [];

  if (score >= 5) {
    verdict = "This looks like a strong signal.";
  } else if (score >= 3) {
    verdict = "This signal shows some promise, but is not particularly strong.";
  } else {
    verdict = "This signal appears weak or unreliable.";
  }

  if (Math.abs(ic) > 0.1) {
    reasoning.push("It has meaningful predictive power.");
  } else {
    reasoning.push("Predictive power is weak.");
  }

  if (Math.abs(spread) > 0.05) {
    reasoning.push("The long/short spread is economically meaningful.");
  } else {
    reasoning.push("The spread is small, limiting profitability.");
  }

  if (csStd < 0.2) {
    reasoning.push("The signal appears relatively stable.");
  } else {
    reasoning.push("The signal is unstable across periods.");
  }

  if (Math.abs(alpha) > 0.01) {
    reasoning.push("There is some evidence of independent alpha.");
  } else {
    reasoning.push("Returns are mostly explained by factor exposure.");
  }

  return `${verdict} ${reasoning.join(" ")}`;
}

function generateIntrospectionAnswer(
  introspection: any,
  input: string
): string | null {
  if (!introspection) return null;

  const q = input.toLowerCase();

  const data = introspection.details?.data;
  const methodology = introspection.details?.methodology;

  if (!data) return null;

  if (q.includes("data") || q.includes("dataset")) {
    return introspection.summary;
  }

  if (q.includes("rows") || q.includes("observations")) {
    return `The analysis used ${data.output_rows} observations after dropping ${data.rows_dropped} rows during alignment.`;
  }

  if (q.includes("dropped")) {
    return `${data.rows_dropped} rows were dropped due to alignment (signal_t → return_t+1).`;
  }

  if (q.includes("assets")) {
    return `The signal covered ${data.unique_assets} assets.`;
  }

  if (q.includes("date") || q.includes("range")) {
    return `The data spans from ${data.date_range.start} to ${data.date_range.end}.`;
  }

  if (q.includes("align")) {
    return methodology?.alignment || null;
  }

  if (q.includes("clean")) {
    return methodology?.cleaning || null;
  }

  if (q.includes("method") || q.includes("compute")) {
    return `The system computes IC, rank IC, quantile spreads, and performs regression-based factor decomposition.`;
  }

  return null;
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

    const spread = quant.spread ?? 0;
    const absSpread = Math.abs(spread);
    const stabilityScore = stability?.cs_ic_std ?? 1;

    let response = "PnL Intuition:\n\n";

    response += `The reported spread is defined as (Q5 − Q1), where Q5 is the top signal quantile (long leg) and Q1 is the bottom quantile (short leg).\n\n`;

    response += `Observed spread: Q5 − Q1 = ${spread.toFixed(4)}\n\n`;

    if (absSpread > 0.05) {
      response += `The magnitude (|spread| = ${absSpread.toFixed(4)}) suggests economically meaningful separation between long and short portfolios.\n\n`;
    } else {
      response += `The magnitude (|spread| = ${absSpread.toFixed(4)}) is small, suggesting limited economic value.\n\n`;
    }

    if (spread < 0) {
      response += `Because the spread is negative, the signal is inversely predictive under the standard construction (long Q5, short Q1).\n`;
      response += `A flipped strategy (long Q1, short Q5) would align positions with the signal and capture the return differential.\n\n`;
    } else {
      response += `The positive spread indicates that the standard construction (long Q5, short Q1) aligns with the signal.\n\n`;
    }

    if (stabilityScore === 0) {
      response += "IC shows no variation over time in this sample, so stability cannot be reliably assessed.\n\n";
    } else if (stabilityScore < 0.1) {
      response += "The signal appears relatively stable over time.\n\n";
    } else {
      response += "IC variability is elevated, suggesting returns may be unstable and regime-dependent.\n\n";
    }

    response += "Net profitability will depend on implementation costs, turnover, and execution.";

    return response;
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
      stability.cs_ic_std === 0
        ? "no IC variation in this sample — stability cannot be reliably assessed."
        : stability.cs_ic_std < 0.1
        ? "relatively stable performance over time."
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
  const [lastComparison, setLastComparison] = useState<any | null>(null);
  const [customSignal, setCustomSignal] = useState<string>("");

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

    const q = input.toLowerCase().trim();

    if (q.startsWith("compare")) {
      if (!lastResult) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "No signal to compare. Analyze a signal first." },
        ]);
        setLoading(false);
        return;
      }
      const baselineSource = q.includes("momentum") ? "momentum" : "random";
      const baseline = await executeAction({ action: "analyze_signal", source: baselineSource });
      const comparison = generateComparisonInsight(lastResult, baseline, baselineSource);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: comparison },
      ]);
      setLastComparison({ current: lastResult, baseline });
      setLoading(false);
      return;
    }

    if (normalized === "yes") {
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
            (suggestion ? `\n\n\u2192 ${suggestion}` : ""),
          _introspection: result._introspection,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,          { role: "assistant", content: "Error running comparison." },
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

    const introspectionAnswer = generateIntrospectionAnswer(
      lastResult?._introspection,
      input
    );

    if (introspectionAnswer) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: introspectionAnswer },
      ]);
      setLoading(false);
      return;
    }

    const decisionAnswer = generateDecisionInsight(lastResult, input);

    if (decisionAnswer) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: decisionAnswer },
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
          (suggestion ? `\n\n\u2192 ${suggestion}` : ""),
        _introspection: result._introspection,
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
              {msg._introspection && (
                <div className="mt-2 px-3 py-2 rounded-md border border-neutral-800 bg-neutral-950 text-xs text-neutral-400 max-w-prose">
                  <div className="font-medium text-neutral-300 mb-1">How this was computed</div>
                  <div className="mb-2">{msg._introspection.summary}</div>
                  <details>
                    <summary className="cursor-pointer text-neutral-500 hover:text-neutral-300">
                      Show details
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-neutral-500">
                      {JSON.stringify(msg._introspection.details, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
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

        <div className="mt-6 border-t border-neutral-800 pt-5">
          <div className="text-xs text-neutral-500 font-medium mb-2">Paste custom signal (JSON)</div>
          <textarea
            value={customSignal}
            onChange={(e) => setCustomSignal(e.target.value)}
            placeholder={'[{"date":"2020-01-01","asset":"ASSET_000","signal":0.5}]'}
            className="w-full h-28 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-xs font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
          />
          <button
            disabled={loading || !customSignal.trim()}
            onClick={async () => {
              let parsed: any[];
              try {
                parsed = JSON.parse(customSignal);
              } catch {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: "Invalid JSON format for signal." },
                ]);
                return;
              }
              setLoading(true);
              try {
                const result = await executeAction({ action: "analyze_signal", signal: parsed });
                setLastResult(result);
                const suggestion = generateSuggestion(result, "custom", lastSource);
                setMessages((prev) => [
                  ...prev,
                  { role: "user", content: "analyze custom signal" },
                  {
                    role: "assistant",
                    content: formatReport(result) + (suggestion ? `\n\n\u2192 ${suggestion}` : ""),
                    _introspection: result._introspection,
                  },
                ]);
                setPreviousSource(lastSource);
                setLastSource("custom");
              } catch (err) {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: "Error analyzing custom signal." },
                ]);
              } finally {
                setLoading(false);
              }
            }}
            className="mt-2 px-4 py-2 bg-neutral-700 text-white text-sm rounded-md hover:bg-neutral-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Analyze Custom Signal
          </button>
        </div>
      </div>
    </main>
  );
}
