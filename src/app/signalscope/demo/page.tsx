"use client";

import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ScatterChart, Scatter, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { routeUserInput } from "@/lib/signalscope/router";
import { executeAction, getLastReport, askQuestion } from "@/lib/signalscope/actions";
import { SIGNALSCOPE_API_BASE } from "@/lib/signalscope/config";
import type { AskResponse } from "@/lib/signalscope/types";

interface Citation {
  concept: string;
  definition?: string;
  assumptions?: string[];
  failure_modes?: string[];
}

interface SourceExplanation {
  message?: string;
  type?: string;
  model?: string;
  implications?: string[];
  validation_checks?: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  ui_components?: any[];
  clarification?: AskResponse["clarification"];
  section?: string;
  citations?: Citation[];
  _introspection?: {
    summary: string;
    details: Record<string, any>;
  };
  source_explanation?: SourceExplanation;
  data_preview?: Record<string, any>[];
  synth_preset?: string;
  validity?: { status: string; confidence?: string };
  conclusion?: any;
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

function cleanAnswerText(text: string): string {
  if (!text) return "";
  // Only strip lines that are purely backend metadata
  return text
    .replace(/^Sources:\s*\[object Object\].*$/gim, "")
    .replace(/^Sources:\s*.*$/gim, "")
    .replace(/^Section:\s*\S+\s*$/gim, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function DataOverview({ msg }: { msg: Message }) {
  const src = msg.source_explanation;
  const rows = Array.isArray(msg.data_preview) ? msg.data_preview.slice(0, 10) : [];
  if (!src?.message && rows.length === 0) return null;

  const allCols = ["date", "asset", "signal", "return"];
  const cols = rows.length > 0
    ? allCols.filter((k) => k in rows[0])
    : [];

  return (
    <div className="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-3 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-200">Data Overview</h3>

      {src?.message && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-neutral-400">Data Source</div>
          <p className="text-xs text-neutral-300 leading-relaxed">{src.message}</p>
          {src.type === "synthetic" && (
            <div className="mt-1 space-y-0.5 text-xs text-neutral-500">
              {src.model && (
                <div><span className="text-neutral-400">Model:</span> {src.model}</div>
              )}
              {src.implications && src.implications.length > 0 && (
                <div>
                  <span className="text-neutral-400">Implications:</span>
                  <ul className="list-disc ml-4 mt-0.5 space-y-0.5">
                    {src.implications.map((imp, i) => <li key={i}>{imp}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          {src.type === "user" && src.validation_checks && src.validation_checks.length > 0 && (
            <div className="mt-1 text-xs text-neutral-500">
              <span className="text-neutral-400">Validation:</span>
              <ul className="list-disc ml-4 mt-0.5 space-y-0.5">
                {src.validation_checks.map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {cols.length > 0 && (
        <div className="overflow-x-auto">
          <table className="text-xs font-mono border-collapse w-full">
            <thead>
              <tr>
                {cols.map((col) => (
                  <th
                    key={col}
                    className="px-2 py-1 text-left text-neutral-400 border-b border-neutral-800 capitalize font-medium"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "" : "bg-neutral-900/40"}>
                  {cols.map((col) => (
                    <td key={col} className="px-2 py-1 text-neutral-300 border-b border-neutral-900">
                      {row[col] != null ? String(row[col]) : "\u2014"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function downloadNotebook(msg: Message) {
  try {
    const res = await fetch(`${SIGNALSCOPE_API_BASE}/analyze/notebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: msg }),
    });

    if (!res.ok) {
      console.error("Notebook request failed", res.status);
      return;
    }

    const data = await res.json();

    if (!data?.notebook) {
      console.error("No notebook returned");
      return;
    }

    const blob = new Blob(
      [JSON.stringify(data.notebook, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "signalscope_analysis.ipynb";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Download failed", err);
  }
}

const SYNTH_PRESETS = [
  { label: "Noise",         preset: "noise",  defaults: { beta: 0.0, noise_std: 2.0 } },
  { label: "Weak Signal",   preset: "factor", defaults: { beta: 0.2, noise_std: 1.0 } },
  { label: "Strong Factor", preset: "factor", defaults: { beta: 1.0, noise_std: 0.5 } },
  { label: "Leaky Signal",  preset: "leaky",  defaults: { beta: 0.5, noise_std: 1.0 } },
] as const;

type SynthPreset = (typeof SYNTH_PRESETS)[number];

function SyntheticGenerator({
  loading,
  onGenerate,
  onCancel,
}: {
  loading: boolean;
  onGenerate: (preset: string, params: Record<string, number>) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<SynthPreset | null>(null);
  const [params, setParams] = useState<Record<string, number>>({
    n_assets: 100,
    n_periods: 252,
    beta: 0.5,
    noise_std: 1.0,
    seed: 42,
  });

  function handlePreset(p: SynthPreset) {
    setSelected(p);
    setParams((prev) => ({ ...prev, ...p.defaults }));
  }

  const fields: [string, string, string][] = [
    ["n_assets",   "Assets",    "Number of assets in the dataset"],
    ["n_periods",  "Periods",   "Number of time periods (trading days)"],
    ["beta",       "Beta",      "Controls strength of the factor relationship"],
    ["noise_std",  "Noise Std", "Adds randomness to returns"],
    ["seed",       "Seed",      "Random seed for reproducibility"],
  ];

  return (
    <div className="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-neutral-200">Generate Synthetic Signal</h3>

      <div>
        <div className="text-xs text-neutral-500 mb-2">Choose a preset:</div>
        <div className="flex flex-wrap gap-2">
          {SYNTH_PRESETS.map((p) => (
            <button
              key={p.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePreset(p)}
              className={`px-3 py-1.5 text-xs rounded border transition ${
                selected?.label === p.label
                  ? "border-blue-500 bg-blue-950 text-blue-300"
                  : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {fields.map(([key, label, hint]) => (
          <div key={key}>
            <label className="block text-xs font-medium text-neutral-400 mb-0.5">{label}</label>
            <input
              type="number"
              value={params[key]}
              onChange={(e) =>
                setParams((prev) => ({ ...prev, [key]: Number(e.target.value) }))
              }
              className="w-full px-2 py-1 text-xs bg-neutral-900 border border-neutral-800 rounded text-neutral-200 focus:outline-none focus:border-neutral-600"
            />
            <div className="text-xs text-neutral-600 mt-0.5">{hint}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          disabled={!selected || loading}
          onClick={() => selected && onGenerate(selected.preset, params)}
          className="px-4 py-2 text-sm rounded border border-neutral-600 bg-neutral-800 text-neutral-200 hover:bg-neutral-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Generate
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded border border-neutral-700 text-neutral-500 hover:text-neutral-300 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function LeakageAnalysis({ msg }: { msg: Message }) {
  const sections: any[] = Array.isArray((msg as any).sections)
    ? (msg as any).sections
    : Array.isArray(msg.ui_components)
    ? msg.ui_components
    : [];
  const section = sections.find(
    (s: any) => s.title === "Leakage Analysis" || s.id === "leakage_analysis"
  );
  const data = section?.content ?? section?.details?.content;
  if (!data) return null;

  const score: number | null =
    typeof data.leakage_score === "number" ? data.leakage_score : null;
  const scoreColor =
    score === null
      ? "text-neutral-300"
      : score > 0.01
      ? "text-red-400"
      : score < -0.01
      ? "text-green-400"
      : "text-neutral-300";

  return (
    <div className="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-3 space-y-2">
      <h3 className="text-sm font-semibold text-neutral-200">Leakage Analysis</h3>
      <div className="text-sm text-neutral-300 space-y-1">
        {typeof data.ic_original === "number" && (
          <div>
            <span className="font-semibold text-neutral-400">IC (original):</span>{" "}
            {data.ic_original.toFixed(4)}
          </div>
        )}
        {typeof data.ic_forward === "number" && (
          <div>
            <span className="font-semibold text-neutral-400">IC (forward):</span>{" "}
            {data.ic_forward.toFixed(4)}
          </div>
        )}
        {score !== null && (
          <div>
            <span className="font-semibold text-neutral-400">Leakage score:</span>{" "}
            <span className={scoreColor}>{score.toFixed(4)}</span>
          </div>
        )}
      </div>
      {data.interpretation && (
        <p className="text-xs text-neutral-400 leading-relaxed">{data.interpretation}</p>
      )}
      {msg.validity && (
        <div className="text-xs text-neutral-500">
          <span className="font-semibold">Status:</span>{" "}
          {msg.validity.status}
          {msg.validity.confidence ? ` (${msg.validity.confidence})` : ""}
        </div>
      )}
    </div>
  );
}

const AXIS_STYLE = { fill: "#a3a3a3", fontSize: 10 };
const AXIS_LABEL_STYLE = { fill: "#737373", fontSize: 10 };
const TOOLTIP_STYLE = { backgroundColor: "#171717", border: "1px solid #404040", fontSize: 12 };
const TOOLTIP_FORMATTER = (v: unknown) => typeof v === "number" ? v.toFixed(4) : String(v);

function Charts({ msg }: { msg: Message }) {
  const quantiles: { name: string; value: number }[] = [];
  if (Array.isArray(msg.ui_components)) {
    const qa = msg.ui_components.find((s: any) => s.id === "quantile_analysis");
    const raw = qa?.details?.content?.quantiles;
    if (Array.isArray(raw)) {
      raw.forEach((q: any, i: number) => {
        const val = typeof q.mean_return === "number" ? q.mean_return : null;
        if (val !== null) quantiles.push({ name: `Q${q.quantile ?? i + 1}`, value: Number(val.toFixed(4)) });
      });
    }
  }

  const scatter: { signal: number; ret: number }[] = [];
  if (Array.isArray(msg.data_preview)) {
    msg.data_preview.forEach((row: any) => {
      const x = typeof row.signal === "number" ? row.signal : parseFloat(row.signal);
      const y = typeof row.return === "number" ? row.return : parseFloat(row.return);
      if (!isNaN(x) && !isNaN(y)) scatter.push({ signal: Number(x.toFixed(4)), ret: Number(y.toFixed(4)) });
    });
  }

  if (quantiles.length === 0 && scatter.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-neutral-800 bg-neutral-950 p-3 space-y-5">
      <h3 className="text-sm font-semibold text-neutral-200">Visual Analysis</h3>

      {quantiles.length > 0 && (
        <div className="mt-1">
          <h4 className="text-xs font-semibold text-neutral-300 mb-0.5">Quantile Returns (Q1 → Q5)</h4>
          <p className="text-xs text-neutral-500 mb-2">Higher quantiles should produce higher returns if the signal is predictive</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={quantiles} margin={{ top: 4, right: 16, bottom: 24, left: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="name"
                tick={AXIS_STYLE}
                label={{ value: "Quantile", position: "insideBottom", offset: -10, style: AXIS_LABEL_STYLE }}
              />
              <YAxis
                tick={AXIS_STYLE}
                tickFormatter={(v) => v.toFixed(3)}
                label={{ value: "Mean Return", angle: -90, position: "insideLeft", offset: 10, style: AXIS_LABEL_STYLE }}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={TOOLTIP_FORMATTER} />
              <Bar dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {scatter.length > 0 && (
        <div className="mt-1">
          <h4 className="text-xs font-semibold text-neutral-300 mb-0.5">Signal vs Forward Return</h4>
          <p className="text-xs text-neutral-500 mb-2">Linear pattern indicates factor-driven behavior (beta exposure)</p>
          <ResponsiveContainer width="100%" height={190}>
            <ScatterChart margin={{ top: 4, right: 16, bottom: 24, left: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                dataKey="signal"
                name="Signal"
                tick={AXIS_STYLE}
                tickFormatter={(v) => v.toFixed(3)}
                label={{ value: "Signal Value", position: "insideBottom", offset: -10, style: AXIS_LABEL_STYLE }}
              />
              <YAxis
                type="number"
                dataKey="ret"
                name="Return"
                tick={AXIS_STYLE}
                tickFormatter={(v) => v.toFixed(3)}
                label={{ value: "Forward Return", angle: -90, position: "insideLeft", offset: 10, style: AXIS_LABEL_STYLE }}
              />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={TOOLTIP_STYLE}
                formatter={TOOLTIP_FORMATTER}
                labelFormatter={() => ""}
              />
              <Scatter data={scatter} fill="#6366f1" opacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CitationList({ citations }: { citations: Citation[] | undefined }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!Array.isArray(citations) || citations.length === 0) return null;
  return (
    <div className="mt-3 space-y-1" style={{ contain: "layout" }}>
      <div className="text-xs font-medium text-neutral-400">Sources:</div>
      {citations.map((c, i) => {
        const concept = typeof c === "string" ? c : (c.concept || "Unknown source");
        const isExpanded = expanded === concept;
        const hasDetail =
          typeof c === "object" &&
          (c.definition || c.assumptions?.length || c.failure_modes?.length);
        return (
          <div key={i} className="text-xs">
            <button
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setExpanded(isExpanded ? null : concept)}
              className={`text-left flex items-center gap-1 ${
                hasDetail
                  ? "text-neutral-400 hover:text-neutral-200 cursor-pointer"
                  : "text-neutral-500 cursor-default"
              } transition`}
            >
              <span
                className={`inline-block w-3 text-neutral-600 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              >
                {hasDetail ? "›" : "·"}
              </span>
              {concept}
            </button>
            {typeof c === "object" && (
              <div className={`citation-content${isExpanded ? " open" : ""} ml-4 space-y-2 text-neutral-400 border-l border-neutral-800 pl-3`}>
                {c.definition && (
                  <p className="leading-relaxed">{c.definition}</p>
                )}
                {c.assumptions && c.assumptions.length > 0 && (
                  <div>
                    <div className="font-medium text-neutral-500 mb-0.5">Assumptions:</div>
                    <ul className="list-disc ml-4 space-y-0.5">
                      {c.assumptions.map((a, j) => <li key={j}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {c.failure_modes && c.failure_modes.length > 0 && (
                  <div>
                    <div className="font-medium text-neutral-500 mb-0.5">Failure modes:</div>
                    <ul className="list-disc ml-4 space-y-0.5">
                      {c.failure_modes.map((f, j) => <li key={j}>{f}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderContent(content: any) {
  if (content == null) return null;
  if (typeof content === "string") {
    return <p className="text-sm leading-relaxed text-neutral-300">{content}</p>;
  }
  if (typeof content === "object") {
    return (
      <div className="space-y-2 text-sm text-neutral-300">
        {Object.entries(content).map(([key, value]) => {
          // quantiles array — special rendering
          if (key === "quantiles" && Array.isArray(value)) {
            return (
              <div key={key}>
                <div className="font-semibold capitalize text-neutral-400">Quantiles:</div>
                <div className="ml-2 space-y-0.5">
                  {(value as any[]).map((q: any, i: number) => (
                    <div key={i}>
                      Q{q.quantile}: {typeof q.mean_return === "number" ? q.mean_return.toFixed(4) : String(q.mean_return)}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (typeof value === "number") {
            return (
              <div key={key}>
                <span className="font-semibold capitalize text-neutral-400">{key}:</span>{" "}
                {(value as number).toFixed(4)}
              </div>
            );
          }
          if (typeof value === "boolean") {
            return (
              <div key={key}>
                <span className="font-semibold capitalize text-neutral-400">{key}:</span>{" "}
                {value ? "Yes" : "No"}
              </div>
            );
          }
          if (Array.isArray(value)) {
            return (
              <div key={key}>
                <span className="font-semibold capitalize text-neutral-400">{key}:</span>{" "}
                {JSON.stringify(value)}
              </div>
            );
          }
          if (value !== null && typeof value === "object") {
            return (
              <div key={key}>
                <span className="font-semibold capitalize text-neutral-400">{key}:</span>
                <div className="ml-2">{renderContent(value)}</div>
              </div>
            );
          }
          return (
            <div key={key}>
              <span className="font-semibold capitalize text-neutral-400">{key}:</span>{" "}
              {String(value)}
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}

function renderAskResponse(
  resp: { answer?: string; section?: string; citations?: Citation[] } | undefined
) {
  if (!resp) return null;
  console.log("ASK RAW ANSWER:", resp.answer);
  const answer = cleanAnswerText(resp.answer ?? "");
  return (
    <div className="space-y-2 rounded-md border border-neutral-800 bg-neutral-950 px-4 py-3">
      {answer && (
        <p className="text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">{answer}</p>
      )}
      {resp.section && resp.section !== "full_report" && (
        <div className="text-xs text-neutral-500">
          From: {resp.section.replace(/_/g, " ")}
        </div>
      )}
      <CitationList citations={resp.citations} />
    </div>
  );
}

function renderSection(
  section: any,
  handleAsk: (q: string, sectionId?: string) => void,
  setActiveSection: (id: string | null) => void
) {
  return (
    <div
      key={section.id ?? section.title}
      className="rounded-md border border-neutral-800 bg-neutral-950 px-4 py-3 space-y-2"
    >
      <div className="font-semibold text-sm text-neutral-200">{section.title}</div>
      {section.details?.content != null && renderContent(section.details.content)}
      <CitationList citations={section.citations} />
      {section.ask && section.ask.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {section.ask.map((q: string, i: number) => (
            <button
              key={i}
              onClick={() => {
                setActiveSection(section.id ?? null);
                handleAsk(q, section.id);
              }}
              className="text-xs px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const [pendingClarification, setPendingClarification] = useState<AskResponse["clarification"] | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [synthMode, setSynthMode] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    const prev = prevMessageCountRef.current;
    const current = messages.length;
    if (current > prev) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = current;
  }, [messages]);

  async function handleSynthGenerate(preset: string, params: Record<string, number>) {
    setLoading(true);
    setSynthMode(false);
    try {
      const res = await fetch(`${SIGNALSCOPE_API_BASE}/generate/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset, params }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setLastResult(result);
      const nextPrevious = lastSource;
      setPreviousSource(nextPrevious);
      setLastSource("synthetic");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          ui_components: result.ui_components,
          _introspection: result._introspection,
          source_explanation: result.source_explanation,
          data_preview: result.data_preview,
          synth_preset: preset,
          validity: result.validity,
          conclusion: result.conclusion,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error generating synthetic signal." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAsk(question: string, section?: string) {
    const report = getLastReport();
    if (!report) return;

    const resolvedSection = section ?? activeSection ?? undefined;
    if (section) setActiveSection(section);

    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
    ]);

    try {
      const data = await askQuestion(question, report, resolvedSection);

      if (data.clarification != null) {
        setPendingClarification(data.clarification);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.clarification!.message,
            clarification: data.clarification,
          },
        ]);
      } else {
        const answer = data.answer ?? "";
        const normCitations: Citation[] = (data.citations ?? []).map((c: any) =>
          typeof c === "string" ? { concept: c } : c
        );
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: answer,
            section: data.section,
            citations: normCitations,
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error answering question." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    const normalized = input.toLowerCase().trim();

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const q = input.toLowerCase().trim();

    if (q.includes("generate")) {
      let preset = "noise";
      if (q.includes("factor")) preset = "factor";
      else if (q.includes("nonlinear")) preset = "nonlinear";
      else if (q.includes("leaky")) preset = "leaky";

      try {
        const res = await fetch(`${SIGNALSCOPE_API_BASE}/generate/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preset,
            params: { n_assets: 100, n_periods: 252, beta: 2.0, noise_std: 0.5, seed: 42 },
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        setLastResult(result);
        setLastSource("synthetic");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "",
            ui_components: result.ui_components,
            _introspection: result._introspection,
            source_explanation: result.source_explanation,
            data_preview: result.data_preview,
            synth_preset: preset,
            validity: result.validity,
            conclusion: result.conclusion,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error generating synthetic signal." },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (q.includes("synthetic signal")) {
      setSynthMode(true);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Choose a preset to generate synthetic signal data:" },
      ]);
      setLoading(false);
      return;
    }

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

        // update React state
        setPreviousSource(nextPrevious);
        setLastSource(nextLast);

        const assistantMessage: Message = {
          role: "assistant",
          content: "",
          ui_components: result.ui_components,
          _introspection: result._introspection,
          source_explanation: result.source_explanation,
          data_preview: result.data_preview,
          validity: result.validity,
          conclusion: result.conclusion,
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
      const route = await routeUserInput(userMessage.content, activeSection ?? undefined);

      // --- Ask response (Q&A via /analyze/ask) ---
      if (route.type === "ask") {
        const { askResponse } = route;

        if (askResponse.clarification != null) {
          setPendingClarification(askResponse.clarification);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: askResponse.clarification!.message,
              clarification: askResponse.clarification,
            },
          ]);
        } else {
          const answer = askResponse.answer ?? "";
          const normCitations: Citation[] = (askResponse.citations ?? []).map((c: any) =>
            typeof c === "string" ? { concept: c } : c
          );
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: answer,
              section: askResponse.section,
              citations: normCitations,
            },
          ]);
        }
        return;
      }

      // --- Action response (analyze_signal etc.) ---
      const result = await executeAction(route);

      setLastResult(result);

      // compute next context BEFORE updating state
      const nextPrevious = lastSource;
      const nextLast = route.source || null;

      // now update React state
      setPreviousSource(nextPrevious);
      setLastSource(nextLast);

      const assistantMessage: Message = {
        role: "assistant",
        content: "",
        ui_components: result.ui_components,
        _introspection: result._introspection,
        source_explanation: result.source_explanation,
        data_preview: result.data_preview,
        validity: result.validity,
        conclusion: result.conclusion,
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

        <div className="flex flex-col gap-4 mb-6 min-h-[300px] overflow-anchor-none" style={{ overflowAnchor: "none" }}>
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
              {/* user bubble */}
              {msg.role === "user" && (
                <div className="inline-block px-4 py-3 rounded-md text-sm whitespace-pre-wrap max-w-prose bg-neutral-800 text-neutral-100">
                  {msg.content}
                </div>
              )}
              {/* assistant: ask response (has answer/citations but no ui_components) */}
              {msg.role === "assistant" && !msg.ui_components?.length && (
                <div className="max-w-2xl">
                  {(msg.section != null || msg.citations?.length) ? (
                    renderAskResponse({
                      answer: msg.content || undefined,
                      section: msg.section,
                      citations: msg.citations,
                    })
                  ) : (
                    <div className="inline-block px-4 py-3 rounded-md text-sm whitespace-pre-wrap max-w-prose bg-neutral-900 border border-neutral-800 text-neutral-200">
                      {msg.content}
                    </div>
                  )}
                </div>
              )}
              {/* assistant: report with ui_components */}
              {msg.role === "assistant" && msg.ui_components && msg.ui_components.length > 0 && (
                <div className="mt-1 max-w-2xl space-y-4">
                  {msg.content && (
                    <p className="text-sm text-neutral-400">{msg.content}</p>
                  )}
                  {(() => {
                    const type = msg.conclusion?.type;
                    const validity = msg.validity?.status;
                    let suggestion: string | null = null;
                    if (validity === "invalid") {
                      suggestion = "→ This signal appears to use future information. Want to test a properly constructed signal?";
                    } else if (type === "noise") {
                      suggestion = "→ This signal shows no predictive power. Want to test a structured signal like momentum instead?";
                    } else if (type === "factor-driven") {
                      suggestion = "→ This looks factor-driven. Want to compare it to a random signal?";
                    } else if (type === "nonlinear") {
                      suggestion = "→ This signal shows nonlinear structure. Want to test a linear factor signal for comparison?";
                    } else if (type === "independent alpha") {
                      suggestion = "→ This signal may contain independent alpha. Want to validate it further or compare against a factor model?";
                    }
                    return suggestion ? (
                      <div className="mt-2 text-sm text-neutral-400">{suggestion}</div>
                    ) : null;
                  })()}
                  {msg.validity?.status === "invalid" && (
                    <div className="p-3 border border-red-500/40 bg-red-500/10 rounded text-sm text-red-300">
                      ⚠️ This signal appears to use future information (lookahead bias). Results are not reliable.
                    </div>
                  )}
                  {msg.validity?.status === "suspect" && (
                    <div className="p-3 border border-yellow-500/40 bg-yellow-500/10 rounded text-sm text-yellow-300">
                      ⚠️ This signal may contain leakage. Interpret results with caution.
                    </div>
                  )}
                  {msg.synth_preset && (
                    <div className="text-xs text-neutral-500 border border-neutral-800 rounded px-2 py-1 inline-block">
                      Generated using synthetic data &middot; preset: <span className="text-neutral-400 font-medium">{msg.synth_preset}</span>
                    </div>
                  )}
                  {msg.ui_components
                    .filter((s: any) => s.id === "llm_interpretation")
                    .map((s: any) => renderSection(s, handleAsk, setActiveSection))}
                  {msg.ui_components
                    .filter((s: any) => s.id !== "llm_interpretation" && s.title !== "Leakage Analysis")
                    .map((s: any) => renderSection(s, handleAsk, setActiveSection))}
                  <DataOverview msg={msg} />
                  <Charts msg={msg} />
                  <LeakageAnalysis msg={msg} />
                  {(msg.ui_components?.length || msg.data_preview?.length) && (
                    <button
                      onClick={() => downloadNotebook(msg)}
                      className="mt-3 px-3 py-2 text-sm rounded border border-neutral-600 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition cursor-pointer"
                    >
                      Download Notebook
                    </button>
                  )}
                </div>
              )}
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
              {msg.clarification && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.clarification.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setPendingClarification(null);
                        handleAsk(opt);
                      }}
                      className="px-3 py-1.5 text-xs rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-neutral-700 transition"
                    >
                      {opt.replace(/_/g, " ")}
                    </button>
                  ))}
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

        {synthMode && (
          <SyntheticGenerator
            loading={loading}
            onGenerate={handleSynthGenerate}
            onCancel={() => setSynthMode(false)}
          />
        )}

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
                setMessages((prev) => [
                  ...prev,
                  { role: "user", content: "analyze custom signal" },
                  {
                    role: "assistant",
                    content: "",
                    ui_components: result.ui_components,
                    _introspection: result._introspection,
                    source_explanation: result.source_explanation,
                    data_preview: result.data_preview,
                    validity: result.validity,
                    conclusion: result.conclusion,
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
