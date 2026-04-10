"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ScatterChart, Scatter, CartesianGrid, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { routeUserInput } from "@/lib/signalscope/router";
import { executeAction, getLastReport, askQuestion } from "@/lib/signalscope/actions";
import {
  createResearchProject,
  updateProjectBlock,
  setProjectChatMode,
  getProjectBlockDrilldown,
  getProjectDataProviders,
  createProjectPaperPlan,
  getProjectGuidance,
  runProjectPipeline,
} from "@/lib/signalscope/project";
import ICLagChart from "@/components/ICLagChart";
import { SIGNALSCOPE_API_BASE } from "@/lib/signalscope/config";
import type { AnalysisContext, AskResponse, SignalScopeReport, ProjectBlockState, ResearchProjectGuidance, ResearchProjectState } from "@/lib/signalscope/types";

interface Citation {
  concept: string;
  definition?: string;
  assumptions?: string[];
  failure_modes?: string[];
  title?: string;
  explanation?: string;
  url?: string;
  primary_reference?: { url?: string };
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
  sections?: any[];
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
  analysis_context?: AnalysisContext;
  research_theory?: { name?: string; hypothesis?: string } | null;
  user_references?: Array<{ title?: string; url?: string; kind?: string }>;
  citation_audit?: Record<string, any>;
  run_id?: string;
  feature_scope?: {
    feature_id: string;
    feature_name?: string;
    value_column?: string;
    params?: Record<string, any>;
  };
  factorscope_report?: Record<string, any>;
  returnscope_report?: Record<string, any>;
}

const SYNTHETIC_ALIAS_TO_CANONICAL: Record<string, string> = {
  noise: "noise",
  random: "noise",
  linear_factor: "linear_factor",
  momentum: "linear_factor",
  factor: "linear_factor",
  nonlinear_monotonic: "nonlinear_monotonic",
  nonlinear: "nonlinear_monotonic",
  leaky_forward: "leaky_forward",
  leaky: "leaky_forward",
};

const SYNTHETIC_PRETTY_LABELS: Record<string, string> = {
  noise: "noise",
  linear_factor: "linear factor",
  nonlinear_monotonic: "nonlinear monotonic",
  leaky_forward: "leaky forward",
};

function toCanonicalSyntheticName(name: string | null | undefined): string | null {
  if (!name) return null;
  const normalized = name.toLowerCase().trim().replace(/\s+/g, "_");
  return SYNTHETIC_ALIAS_TO_CANONICAL[normalized] ?? normalized;
}

function formatSyntheticDisplayName(name: string | null | undefined): string {
  const canonical = toCanonicalSyntheticName(name);
  if (!canonical) return "unknown";
  return SYNTHETIC_PRETTY_LABELS[canonical] ?? canonical.replace(/_/g, " ");
}

function formatAnalysisContextValue(value: string | null | undefined): string {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ");
}

function formatUniverse(context: AnalysisContext): string {
  const selection = formatAnalysisContextValue(context.universe?.selection);
  const assetCount = context.universe?.asset_count;

  if (typeof assetCount === "number") {
    return `${selection} (${assetCount} assets)`;
  }

  return selection;
}

function formatDateRange(context: AnalysisContext): string {
  const start = context.date_range?.start ?? "Unknown";
  const end = context.date_range?.end ?? "Unknown";
  return `${start} → ${end}`;
}

function buildReportMessage(
  result: SignalScopeReport,
  options?: { synthPreset?: string }
): Message {
  return {
    role: "assistant",
    content: "",
    ui_components: result.ui_components,
    _introspection: result._introspection,
    source_explanation: result.source_explanation,
    data_preview: result.data_preview,
    synth_preset: options?.synthPreset,
    validity: result.validity,
    conclusion: result.conclusion,
    analysis_context: result.analysis_context,
    run_id: (result as any).run_id,
    feature_scope: (result as any).feature_scope,
    factorscope_report: (result as any).factorscope_report,
    returnscope_report: (result as any).returnscope_report,
    ...(result as any).research_theory ? { research_theory: (result as any).research_theory } : {},
    ...(result as any).user_references ? { user_references: (result as any).user_references } : {},
    ...(result as any).citation_audit ? { citation_audit: (result as any).citation_audit } : {},
  };
}

function FactorScopeBlock({
  report,
}: {
  report: Record<string, any> | undefined;
}) {
  if (!report || !report.after_controls) return null;
  const ac = report.after_controls;
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 space-y-2">
      <h3 className="text-sm font-semibold text-neutral-200">FactorScope</h3>
      <div className="space-y-1 text-xs text-neutral-300">
        <div><span className="text-neutral-400">Factor set:</span> {report.factor_set}</div>
        <div><span className="text-neutral-400">Signal coeff (after controls):</span> {Number(ac.signal_coefficient ?? 0).toFixed(4)}</div>
        <div><span className="text-neutral-400">Signal coeff t-stat:</span> {Number(ac.signal_coefficient_t_stat ?? 0).toFixed(2)}</div>
        <div><span className="text-neutral-400">Residual alpha:</span> {Number(ac.residual_alpha ?? 0).toFixed(4)}</div>
        <div><span className="text-neutral-400">Residual alpha t-stat:</span> {Number(ac.residual_alpha_t_stat ?? 0).toFixed(2)}</div>
      </div>
    </div>
  );
}

function ReturnScopeBlock({
  report,
}: {
  report: Record<string, any> | undefined;
}) {
  if (!report || !report.returns) return null;
  const returns = report.returns;
  const series = Array.isArray(returns.series) ? returns.series : [];
  const tail = series.slice(-5);
  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 space-y-2">
      <h3 className="text-sm font-semibold text-neutral-200">ReturnScope</h3>
      <div className="space-y-1 text-xs text-neutral-300">
        <div><span className="text-neutral-400">Periods:</span> {returns.n_periods}</div>
        <div><span className="text-neutral-400">Mean period return:</span> {Number(returns.mean_period_return ?? 0).toFixed(4)}</div>
        <div><span className="text-neutral-400">Final cumulative return:</span> {Number(returns.final_cumulative_return ?? 0).toFixed(4)}</div>
      </div>
      {tail.length > 0 && (
        <div className="text-xs text-neutral-400 pt-1 border-t border-neutral-800">
          Latest series points:
          {tail.map((row: any) => (
            <div key={String(row.date)}>
              {String(row.date)}: r={Number(row.strategy_return ?? 0).toFixed(4)}, cum={Number(row.cumulative_return ?? 0).toFixed(4)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  const labelName = `${formatSyntheticDisplayName(label)} signal`;

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
                <div><span className="text-neutral-400">Model:</span> {formatSyntheticDisplayName(src.model)}</div>
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

function AnalysisContextBlock({ context }: { context: AnalysisContext | undefined }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  if (!context) return null;

  const hasWarnings = Array.isArray(context.warnings) && context.warnings.length > 0;
  const isIncomplete = !context.complete;
  const contextTone = isIncomplete
    ? "border-yellow-500/30 bg-yellow-500/5"
    : "border-neutral-800 bg-neutral-950";
  const contextDetailLabel = isIncomplete ? "Context Warnings" : "Context Notes";
  const contextDetailTone = isIncomplete
    ? "border-yellow-500/25 bg-yellow-500/10"
    : "border-neutral-800 bg-neutral-900/40";
  const contextDetailTitleTone = isIncomplete ? "text-yellow-200" : "text-neutral-300";
  const contextDetailTextTone = isIncomplete ? "text-yellow-100/90" : "text-neutral-400";

  const rows: Array<{ key: string; label: string; value: string }> = [
    { key: "signal_source", label: "Signal source", value: formatAnalysisContextValue(context.signal_source) },
    { key: "return_source", label: "Return source", value: formatAnalysisContextValue(context.return_source) },
    { key: "return_definition", label: "Return definition", value: formatAnalysisContextValue(context.return_definition) },
    { key: "universe", label: "Universe", value: formatUniverse(context) },
    { key: "frequency", label: "Frequency", value: formatAnalysisContextValue(context.frequency) },
    { key: "alignment", label: "Alignment", value: formatAnalysisContextValue(context.alignment) },
    { key: "date_range", label: "Date range", value: formatDateRange(context) },
  ];

  const fallbackDetail = (key: string, label: string, value: string) => ({
    summary: `${label}: ${value}`,
    assumptions: [
      "Context values are computed from the dataset used in this run.",
      "Interpretation quality depends on correct source metadata and alignment.",
    ],
    equations: [`${key} = observed_from_prepared_dataset`],
    distributions: [
      "Distribution notes are source-dependent; use Data Overview and section diagnostics for full context.",
    ],
    validation_checks: [
      "Required schema columns are validated before analysis.",
      "Date parsing and cleaning are applied in DataScope.",
    ],
    citations: [],
  });

  return (
    <div className={`rounded-md border p-3 space-y-3 ${contextTone}`}>
      <div>
        <h3 className="text-sm font-semibold text-neutral-200">Analysis Context</h3>
        {!context.complete && (
          <p className="mt-1 text-xs text-yellow-300/90">
            Context is incomplete. Interpret the analysis with the listed caveats in mind.
          </p>
        )}
      </div>

      <div className="space-y-2 text-xs text-neutral-300">
        {rows.map((row) => {
          const isExpanded = expandedKey === row.key;
          const detail = context.details?.[row.key];
          return (
          <div key={row.key} className="rounded border border-neutral-800 bg-neutral-900/30 px-2 py-2">
            <button
              onClick={() => setExpandedKey(isExpanded ? null : row.key)}
              className="w-full text-left"
            >
              <span className="text-neutral-400">{row.label}:</span> {row.value}
              <span className="ml-2 text-neutral-500">{isExpanded ? "▲" : "▼"}</span>
            </button>
            {isExpanded && (
              <div className="mt-2 space-y-2 text-xs text-neutral-300 border-t border-neutral-800 pt-2">
                {((detail || fallbackDetail(row.key, row.label, row.value)).summary) && (
                  <div>
                    <span className="text-neutral-400">Summary:</span> {(detail || fallbackDetail(row.key, row.label, row.value)).summary}
                  </div>
                )}
                {Array.isArray((detail || fallbackDetail(row.key, row.label, row.value)).assumptions) && (detail || fallbackDetail(row.key, row.label, row.value)).assumptions!.length > 0 && (
                  <div>
                    <div className="text-neutral-400">Assumptions</div>
                    <ul className="list-disc ml-4 mt-1 space-y-1 text-neutral-300">
                      {(detail || fallbackDetail(row.key, row.label, row.value)).assumptions!.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray((detail || fallbackDetail(row.key, row.label, row.value)).equations) && (detail || fallbackDetail(row.key, row.label, row.value)).equations!.length > 0 && (
                  <div>
                    <div className="text-neutral-400">Equations</div>
                    <ul className="list-disc ml-4 mt-1 space-y-1 font-mono text-neutral-300">
                      {(detail || fallbackDetail(row.key, row.label, row.value)).equations!.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray((detail || fallbackDetail(row.key, row.label, row.value)).distributions) && (detail || fallbackDetail(row.key, row.label, row.value)).distributions!.length > 0 && (
                  <div>
                    <div className="text-neutral-400">Distributions</div>
                    <ul className="list-disc ml-4 mt-1 space-y-1 text-neutral-300">
                      {(detail || fallbackDetail(row.key, row.label, row.value)).distributions!.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray((detail || fallbackDetail(row.key, row.label, row.value)).validation_checks) && (detail || fallbackDetail(row.key, row.label, row.value)).validation_checks!.length > 0 && (
                  <div>
                    <div className="text-neutral-400">Validation checks</div>
                    <ul className="list-disc ml-4 mt-1 space-y-1 text-neutral-300">
                      {(detail || fallbackDetail(row.key, row.label, row.value)).validation_checks!.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray((detail || fallbackDetail(row.key, row.label, row.value)).citations) && (detail || fallbackDetail(row.key, row.label, row.value)).citations!.length > 0 && (
                  <div>
                    <div className="text-neutral-400">Citations</div>
                    <ul className="list-disc ml-4 mt-1 space-y-1 text-neutral-300">
                      {(detail || fallbackDetail(row.key, row.label, row.value)).citations!.map((c, idx) => (
                        <li key={idx}>
                          {c.title || "Reference"} {c.kind ? `(${c.kind})` : ""}
                          {c.url && (
                            <>
                              {" "}
                              <a className="text-blue-400 hover:text-blue-300" href={c.url} target="_blank" rel="noopener noreferrer">
                                link
                              </a>
                            </>
                          )}
                          {c.relevance && (
                            <div className="text-neutral-500">{c.relevance}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )})}
      </div>

      {hasWarnings && (
        <div className={`rounded border px-3 py-2 ${contextDetailTone}`}>
          <div className={`text-xs font-medium ${contextDetailTitleTone}`}>{contextDetailLabel}</div>
          <ul className={`mt-1 list-disc ml-4 space-y-1 text-xs ${contextDetailTextTone}`}>
            {context.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FeatureScopeBlock({
  feature,
}: {
  feature: Message["feature_scope"] | undefined;
}) {
  if (!feature) return null;

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 space-y-2">
      <h3 className="text-sm font-semibold text-neutral-200">Feature Engineering</h3>
      <div className="space-y-1 text-xs text-neutral-300">
        <div>
          <span className="text-neutral-400">Feature:</span>{" "}
          {feature.feature_name || feature.feature_id}
        </div>
        <div>
          <span className="text-neutral-400">Value column:</span>{" "}
          {feature.value_column || "signal"}
        </div>
        {feature.params && Object.keys(feature.params).length > 0 && (
          <div>
            <span className="text-neutral-400">Params:</span>{" "}
            {JSON.stringify(feature.params)}
          </div>
        )}
      </div>
    </div>
  );
}

function ResearchTheoryBlock({
  theory,
  references,
  citationAudit,
}: {
  theory: any;
  references: any[] | undefined;
  citationAudit: any;
}) {
  const hasTheory = theory && (theory.name || theory.hypothesis);
  const hasRefs = Array.isArray(references) && references.length > 0;
  const hasAudit = citationAudit && typeof citationAudit === "object";

  if (!hasTheory && !hasRefs && !hasAudit) return null;

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 space-y-2">
      <h3 className="text-sm font-semibold text-neutral-200">Research Theory</h3>
      {hasTheory && (
        <div className="text-xs text-neutral-300 space-y-1">
          {theory?.name && (
            <div><span className="text-neutral-400">Theory:</span> {theory.name}</div>
          )}
          {theory?.hypothesis && (
            <div><span className="text-neutral-400">Hypothesis:</span> {theory.hypothesis}</div>
          )}
        </div>
      )}
      {hasRefs && (
        <div className="text-xs text-neutral-300">
          <div className="text-neutral-400 mb-1">User References</div>
          <ul className="list-disc ml-4 space-y-1">
            {references!.map((ref: any, idx: number) => (
              <li key={idx}>
                {ref.title} ({ref.kind || "secondary"}){" "}
                {ref.url && (
                  <a className="text-blue-400 hover:text-blue-300" href={ref.url} target="_blank" rel="noopener noreferrer">
                    link
                  </a>
                )}
                {(ref.year || ref.authors || ref.publication || ref.doi || ref.hypothesis) && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-neutral-500 hover:text-neutral-300">
                      Drilldown
                    </summary>
                    <div className="mt-1 space-y-1 text-neutral-400">
                      {ref.year && <div>Year: {ref.year}</div>}
                      {Array.isArray(ref.authors) && ref.authors.length > 0 && (
                        <div>Authors: {ref.authors.join(", ")}</div>
                      )}
                      {ref.publication && <div>Publication: {ref.publication}</div>}
                      {ref.doi && <div>DOI: {ref.doi}</div>}
                      {ref.hypothesis && <div>Hypothesis: {ref.hypothesis}</div>}
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasAudit && (
        <div className="text-xs text-neutral-500 border-t border-neutral-800 pt-2">
          Citation audit: knowledge primary {citationAudit.knowledge_citations_with_primary ?? 0}/
          {citationAudit.knowledge_citations_total ?? 0}, user primary {citationAudit.user_references_primary ?? 0}/
          {citationAudit.user_references_total ?? 0}
        </div>
      )}
    </div>
  );
}

async function downloadNotebook(msg: Message) {
  try {
    const runId = (getLastReport() as any)?.run_id ?? msg.run_id;
    if (runId) {
      const byRunRes = await fetch(`${SIGNALSCOPE_API_BASE}/analyze/notebook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: runId }),
      });
      if (byRunRes.ok) {
        const data = await byRunRes.json();
        if (data?.notebook) {
          const blob = new Blob([JSON.stringify(data.notebook, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "signalscope_analysis.ipynb";
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      }
    }

    const reportPayload = getLastReport() ?? {
      interpretation: (msg as any).interpretation,
      metrics: (msg as any).metrics,
      sections: msg.sections,
      ui_components: msg.ui_components,
      _introspection: msg._introspection,
      source_explanation: msg.source_explanation,
      data_preview: msg.data_preview,
      validity: msg.validity,
      conclusion: msg.conclusion,
      analysis_context: msg.analysis_context,
      research_theory: msg.research_theory,
      user_references: msg.user_references,
      citation_audit: msg.citation_audit,
    };

    const res = await fetch(`${SIGNALSCOPE_API_BASE}/analyze/notebook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: reportPayload }),
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

async function downloadPdfReport(msg: Message) {
  try {
    const runId = (getLastReport() as any)?.run_id ?? msg.run_id;
    if (runId) {
      const byRunRes = await fetch(`${SIGNALSCOPE_API_BASE}/analyze/report/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: runId }),
      });
      if (byRunRes.ok) {
        const blob = await byRunRes.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "signal_lab_report.pdf";
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
    }

    const reportPayload = getLastReport() ?? {
      interpretation: (msg as any).interpretation,
      metrics: (msg as any).metrics,
      sections: msg.sections,
      ui_components: msg.ui_components,
      _introspection: msg._introspection,
      source_explanation: msg.source_explanation,
      data_preview: msg.data_preview,
      validity: msg.validity,
      conclusion: msg.conclusion,
      analysis_context: msg.analysis_context,
      research_theory: msg.research_theory,
      user_references: msg.user_references,
      citation_audit: msg.citation_audit,
    };

    let res = await fetch(`${SIGNALSCOPE_API_BASE}/analyze/report/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: reportPayload }),
    });

    // Compatibility fallback: some backend versions accept raw report JSON rather than { report: ... }.
    if (res.status === 422) {
      res = await fetch(`${SIGNALSCOPE_API_BASE}/analyze/report/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload),
      });
    }

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error("PDF request failed", res.status, errorText);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const source =
      msg.synth_preset ??
      msg.analysis_context?.signal_source ??
      msg.analysis_context?.provenance?.source ??
      msg.source_explanation?.model ??
      "unknown";
    const normalizedSource = source.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");
    const timestamp = Math.floor(Date.now() / 1000);
    a.href = url;
    a.download = `signal_lab_report_${normalizedSource}_${timestamp}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF download failed", err);
  }
}

const SYNTH_PRESETS = [
  { label: "Noise", preset: "noise", defaults: { beta: 0.0, noise_std: 2.0 } },
  { label: "Linear Factor (Weak)", preset: "linear_factor", defaults: { beta: 0.2, noise_std: 1.0 } },
  { label: "Linear Factor (Strong)", preset: "linear_factor", defaults: { beta: 1.0, noise_std: 0.5 } },
  { label: "Leaky Forward", preset: "leaky_forward", defaults: { beta: 0.5, noise_std: 1.0 } },
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
  const citations = section?.citations ?? section?.details?.citations ?? [];
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
      {data.reference_bands && (
        <div className="rounded border border-neutral-800 bg-neutral-900/40 p-2 text-xs space-y-1">
          <div className="font-medium text-neutral-300">Leakage Score Context</div>
          <div className="text-neutral-400">
            Expected neutral band: [{Number(data.reference_bands.neutral_band?.min ?? -0.02).toFixed(2)}, {Number(data.reference_bands.neutral_band?.max ?? 0.02).toFixed(2)}]
          </div>
          <div className="text-neutral-400">
            Valid timing signal typically: score &lt; {Number(data.reference_bands.valid_threshold ?? -0.02).toFixed(2)}
          </div>
          <div className="text-neutral-400">
            Suspect leakage signal typically: score &gt; {Number(data.reference_bands.suspect_threshold ?? 0.02).toFixed(2)}
          </div>
          {score !== null && (
            <div className="text-neutral-300">
              Current score position: <span className="text-neutral-200">{String(data.score_position || "unknown")}</span>
            </div>
          )}
        </div>
      )}
      {msg.validity && (
        <div className="text-xs text-neutral-500">
          <span className="font-semibold">Status:</span>{" "}
          {msg.validity.status}
          {msg.validity.confidence ? ` (${msg.validity.confidence})` : ""}
        </div>
      )}
      <CitationList citations={citations} />
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

  const returnSeries: Array<{
    date: string;
    cumulative_net_return: number;
    drawdown: number;
    turnover: number;
  }> = [];
  const rawSeries = msg.returnscope_report?.returns?.series;
  if (Array.isArray(rawSeries)) {
    rawSeries.forEach((row: any) => {
      const date = String(row.date ?? "");
      if (!date) return;
      returnSeries.push({
        date,
        cumulative_net_return: Number(row.cumulative_net_return ?? 0),
        drawdown: Number(row.drawdown ?? 0),
        turnover: Number(row.turnover ?? 0),
      });
    });
  }

  if (quantiles.length === 0 && scatter.length === 0 && returnSeries.length === 0) return null;

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
          <p className="text-xs text-neutral-500 mb-2">Linear pattern indicates a strong signal–return relationship</p>
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

      {returnSeries.length > 0 && (
        <div className="space-y-5">
          <div className="mt-1">
            <h4 className="text-xs font-semibold text-neutral-300 mb-0.5">Backtest: Cumulative Net Return</h4>
            <p className="text-xs text-neutral-500 mb-2">Net of transaction costs using current execution model assumptions</p>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={returnSeries} margin={{ top: 4, right: 16, bottom: 24, left: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={AXIS_STYLE} hide />
                <YAxis tick={AXIS_STYLE} tickFormatter={(v) => v.toFixed(3)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={TOOLTIP_FORMATTER} />
                <Line type="monotone" dataKey="cumulative_net_return" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1">
            <h4 className="text-xs font-semibold text-neutral-300 mb-0.5">Backtest: Drawdown</h4>
            <p className="text-xs text-neutral-500 mb-2">Peak-to-trough path of the strategy equity curve</p>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={returnSeries} margin={{ top: 4, right: 16, bottom: 24, left: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={AXIS_STYLE} hide />
                <YAxis tick={AXIS_STYLE} tickFormatter={(v) => v.toFixed(3)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={TOOLTIP_FORMATTER} />
                <Line type="monotone" dataKey="drawdown" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1">
            <h4 className="text-xs font-semibold text-neutral-300 mb-0.5">Backtest: Turnover</h4>
            <p className="text-xs text-neutral-500 mb-2">One-way turnover per rebalance period used for cost estimation</p>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={returnSeries} margin={{ top: 4, right: 16, bottom: 24, left: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={AXIS_STYLE} hide />
                <YAxis tick={AXIS_STYLE} tickFormatter={(v) => v.toFixed(3)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={TOOLTIP_FORMATTER} />
                <Line type="monotone" dataKey="turnover" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
                {(c.title || c.explanation || c.url || c.primary_reference?.url) && (
                  <div className="mt-2 pt-2 border-t border-neutral-800">
                    {c.title && (
                      <div className="font-medium text-neutral-300 mb-1">{c.title}</div>
                    )}
                    {c.explanation && (
                      <div className="text-neutral-400 mb-1">{c.explanation}</div>
                    )}
                    {c.url && (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition"
                      >
                        View reference →
                      </a>
                    )}
                    {c.primary_reference?.url && (
                      <a
                        href={c.primary_reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block",
                          marginTop: "4px",
                          fontSize: "0.85rem",
                          color: "#555",
                        }}
                      >
                        View original paper →
                      </a>
                    )}
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
          const label = key === "ic_t_stat"
            ? "IC t-stat"
            : key === "rank_ic_t_stat"
            ? "Rank IC t-stat"
            : key;

          // Hide t-stats when backend returns null during partial/incomplete analyses.
          if ((key === "ic_t_stat" || key === "rank_ic_t_stat") && value == null) {
            return null;
          }

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
            const formattedValue =
              key === "ic_t_stat" || key === "rank_ic_t_stat"
                ? (value as number).toFixed(2)
                : (value as number).toFixed(4);

            return (
              <div key={key}>
                <span className="font-semibold capitalize text-neutral-400">{label}:</span>{" "}
                {formattedValue}
              </div>
            );
          }
          if (typeof value === "boolean") {
            return (
              <div key={key}>
                <span className="font-semibold capitalize text-neutral-400">{label}:</span>{" "}
                {value ? "Yes" : "No"}
              </div>
            );
          }
          if (Array.isArray(value)) {
            return (
              <div key={key}>
                <span className="font-semibold capitalize text-neutral-400">{label}:</span>{" "}
                {JSON.stringify(value)}
              </div>
            );
          }
          if (value !== null && typeof value === "object") {
            return (
              <div key={key}>
                <span className="font-semibold capitalize text-neutral-400">{label}:</span>
                <div className="ml-2">{renderContent(value)}</div>
              </div>
            );
          }
          return (
            <div key={key}>
              <span className="font-semibold capitalize text-neutral-400">{label}:</span>{" "}
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

function blockStateClass(state: ProjectBlockState["state"]): string {
  if (state === "complete") return "border-emerald-500/50 bg-emerald-950/20";
  if (state === "active") return "border-amber-500/60 bg-amber-950/20";
  if (state === "warning") return "border-yellow-500/60 bg-yellow-950/20";
  if (state === "unlocked") return "border-sky-500/50 bg-sky-950/20";
  return "border-neutral-800 bg-neutral-900/70";
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
  const [customDescription, setCustomDescription] = useState<string>("User-defined signal");
  const [customFrequency, setCustomFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [customUnits, setCustomUnits] = useState<string>("");
  const [customTheoryName, setCustomTheoryName] = useState<string>("");
  const [customHypothesis, setCustomHypothesis] = useState<string>("");
  const [customReferences, setCustomReferences] = useState<string>("");
  const [customDataSources, setCustomDataSources] = useState<string>("");
  const [pendingClarification, setPendingClarification] = useState<AskResponse["clarification"] | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [synthMode, setSynthMode] = useState(false);
  const [projectMode, setProjectMode] = useState(true);
  const [projectIdInput, setProjectIdInput] = useState("proj_day114");
  const [projectNameInput, setProjectNameInput] = useState("Research Project");
  const [projectObjectiveInput, setProjectObjectiveInput] = useState("Design and validate a cited strategy");
  const [projectHypothesisInput, setProjectHypothesisInput] = useState("");
  const [projectState, setProjectState] = useState<ResearchProjectState | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [flashUnlocked, setFlashUnlocked] = useState<Record<string, boolean>>({});
  const [focusedDrilldown, setFocusedDrilldown] = useState<any | null>(null);
  const [drillTab, setDrillTab] = useState<"overview" | "assumptions" | "equations" | "distributions" | "citations" | "validation">("overview");
  const [dataProviders, setDataProviders] = useState<any[]>([]);
  const [paperSourceInput, setPaperSourceInput] = useState("");
  const [paperIncludesCodeRepo, setPaperIncludesCodeRepo] = useState(false);
  const [projectFactorSet, setProjectFactorSet] = useState("ff3");
  const [projectGuidance, setProjectGuidance] = useState<ResearchProjectGuidance | null>(null);

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

  useEffect(() => {
    if (!projectState) return;
    const nextFlash: Record<string, boolean> = {};
    Object.values(projectState.blocks).forEach((block) => {
      if (block.state === "unlocked") {
        const latest = projectState.transition_events[projectState.transition_events.length - 1];
        if (latest && latest.block_id === block.block_id && latest.to_state === "unlocked") {
          nextFlash[block.block_id] = true;
        }
      }
    });
    if (Object.keys(nextFlash).length > 0) {
      setFlashUnlocked(nextFlash);
      const timer = setTimeout(() => setFlashUnlocked({}), 1800);
      return () => clearTimeout(timer);
    }
  }, [projectState]);

  useEffect(() => {
    async function loadDrilldown() {
      if (!projectState || !focusedBlockId) {
        setFocusedDrilldown(null);
        return;
      }
      try {
        const data = await getProjectBlockDrilldown(projectState.project_id, focusedBlockId);
        setFocusedDrilldown(data.drilldown ?? null);
      } catch {
        setFocusedDrilldown(null);
      }
    }
    loadDrilldown();
  }, [projectState, focusedBlockId]);

  useEffect(() => {
    if (!projectMode) return;
    async function loadProviders() {
      try {
        const providers = await getProjectDataProviders();
        setDataProviders(providers);
      } catch {
        setDataProviders([]);
      }
    }
    loadProviders();
  }, [projectMode]);

  useEffect(() => {
    async function loadGuidance() {
      if (!projectState) {
        setProjectGuidance(null);
        return;
      }
      try {
        const guidance = await getProjectGuidance(projectState.project_id);
        setProjectGuidance(guidance);
      } catch {
        setProjectGuidance(null);
      }
    }
    loadGuidance();
  }, [projectState]);

  async function handleCreateProjectMode() {
    setLoading(true);
    try {
      const state = await createResearchProject({
        project_id: projectIdInput.trim(),
        name: projectNameInput.trim(),
        objective: projectObjectiveInput.trim(),
        hypothesis: projectHypothesisInput.trim() || undefined,
      });
      setProjectState(state);
      setProjectMode(true);
      setFocusedBlockId("data");
      setDrillTab("overview");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Project ${state.project_id} created. Start with the Data block.` },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Could not create project. Try a unique project id." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function saveFocusedBlockPayload(payload: Record<string, any>) {
    if (!projectState || !focusedBlockId) return;
    setLoading(true);
    try {
      const state = await updateProjectBlock(projectState.project_id, focusedBlockId, payload);
      setProjectState(state);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Failed to update ${focusedBlockId}.` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function switchProjectChatMode(mode: "discussion" | "execution") {
    if (!projectState) return;
    try {
      const state = await setProjectChatMode(projectState.project_id, mode);
      setProjectState(state);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Could not switch project chat mode." },
      ]);
    }
  }

  async function handleCreatePaperPlan() {
    if (!projectState || !paperSourceInput.trim()) return;
    setLoading(true);
    try {
      const data = await createProjectPaperPlan(
        projectState.project_id,
        paperSourceInput.trim(),
        paperIncludesCodeRepo
      );
      setProjectState(data.state);
      setFocusedBlockId("reproduce_paper_results");
      setDrillTab("overview");
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Failed to create paper reproduction plan." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRunProjectPipeline() {
    if (!projectState) return;
    setLoading(true);
    try {
      const data = await runProjectPipeline(projectState.project_id, { factor_set: projectFactorSet });
      setProjectState(data.state);
      const report = data.report as SignalScopeReport;
      setLastResult(report);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Project run completed: ${data.run_id}` },
        buildReportMessage(report),
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Project run failed. Complete prerequisites and try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

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
        buildReportMessage(result, { synthPreset: preset }),
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

    if (
      projectState?.chat_mode === "discussion" &&
      /^(analyze|run|generate|recreate|compare|test)\b/.test(normalized)
    ) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Project chat is in discussion mode. Switch to execution mode to run deterministic analyses.",
        },
      ]);
      setLoading(false);
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
      const baselineSource =
        q.includes("noise") || q.includes("random")
          ? "noise"
          : q.includes("linear factor") || q.includes("linear_factor") || q.includes("momentum") || q.includes("factor")
          ? "linear_factor"
          : "noise";
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
          source: "noise",
        });

        setLastResult(result);

        // compute next context BEFORE updating state
        const nextPrevious = lastSource;
        const nextLast = "noise";

        // update React state
        setPreviousSource(nextPrevious);
        setLastSource(nextLast);

        const assistantMessage = buildReportMessage(result);
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

      const assistantMessage = buildReportMessage(result);
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

  const workspaceBlocks = projectState
    ? Object.values(projectState.blocks).sort((a, b) => a.title.localeCompare(b.title))
    : [];
  const focusedBlock = focusedBlockId && projectState ? projectState.blocks[focusedBlockId] : null;
  const splitWorkspace = projectMode && projectState;

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <div className={`${splitWorkspace ? "w-full px-4 py-4" : "max-w-2xl mx-auto w-full px-6 py-12"} flex flex-col flex-1`}>
        <h1 className="text-2xl font-semibold mb-1">SignalLab Demo</h1>
        <p className="text-neutral-400 text-sm mb-8">
          Try: &quot;analyze linear factor signal&quot; or &quot;analyze noise
          signal&quot; or &quot;analyze moving average crossover on linear factor&quot; or &quot;run factor scope after controls&quot; or &quot;analyze return scope long only monthly&quot;
        </p>
        <p className="text-neutral-500 text-xs mb-6">
          Scope pipeline: DataScope → FeatureScope → SignalScope → FactorScope → ReturnScope
        </p>

        <div className={splitWorkspace ? "grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-4 items-start" : ""}>
        <div className={`${splitWorkspace ? "lg:order-2 mb-0 rounded-md border border-neutral-800 bg-neutral-900/60 p-3 h-[calc(100vh-190px)] overflow-y-auto" : "mb-6 space-y-3 rounded-md border border-neutral-800 bg-neutral-900/60 p-3"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-neutral-400">Research Project Experience</div>
            <button
              onClick={() => setProjectMode((v) => !v)}
              className="px-2.5 py-1 rounded border border-neutral-700 text-xs text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800"
            >
              {projectMode ? "Hide Project Mode" : "Show Project Mode"}
            </button>
          </div>
          {projectMode && !projectState && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                value={projectIdInput}
                onChange={(e) => setProjectIdInput(e.target.value)}
                placeholder="project_id"
                className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-200"
              />
              <input
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                placeholder="Project name"
                className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-200"
              />
              <input
                value={projectObjectiveInput}
                onChange={(e) => setProjectObjectiveInput(e.target.value)}
                placeholder="Objective"
                className="md:col-span-2 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-200"
              />
              <input
                value={projectHypothesisInput}
                onChange={(e) => setProjectHypothesisInput(e.target.value)}
                placeholder="Hypothesis (optional)"
                className="md:col-span-2 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-neutral-200"
              />
              <button
                onClick={handleCreateProjectMode}
                disabled={loading || !projectIdInput.trim() || !projectNameInput.trim() || !projectObjectiveInput.trim()}
                className="md:col-span-2 px-3 py-2 rounded bg-white text-black text-xs font-medium disabled:opacity-40"
              >
                Create Project
              </button>
            </div>
          )}
          {projectMode && projectState && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                <span className="font-medium text-neutral-200">{projectState.project_id}</span>
                <span>Chat mode:</span>
                <button
                  onClick={() => switchProjectChatMode("execution")}
                  className={`px-2 py-1 rounded border ${projectState.chat_mode === "execution" ? "border-white text-white" : "border-neutral-700 text-neutral-400"}`}
                >
                  execution
                </button>
                <button
                  onClick={() => switchProjectChatMode("discussion")}
                  className={`px-2 py-1 rounded border ${projectState.chat_mode === "discussion" ? "border-white text-white" : "border-neutral-700 text-neutral-400"}`}
                >
                  discussion
                </button>
                <span className="ml-2">Factor set:</span>
                <select
                  value={projectFactorSet}
                  onChange={(e) => setProjectFactorSet(e.target.value)}
                  className="px-2 py-1 rounded border border-neutral-700 bg-neutral-900 text-neutral-200"
                >
                  <option value="ff3">ff3</option>
                </select>
                <button
                  onClick={handleRunProjectPipeline}
                  disabled={loading || projectState.chat_mode !== "execution"}
                  className="ml-1 px-2.5 py-1 rounded border border-neutral-600 text-neutral-200 hover:bg-neutral-800 disabled:opacity-40"
                >
                  Run Project
                </button>
              </div>
              {projectGuidance && (
                <div className="rounded-md border border-neutral-800 bg-neutral-950 p-2 space-y-1">
                  <div className="text-xs font-medium text-neutral-300">Guidance</div>
                  <div className="text-xs text-neutral-400">{projectGuidance.summary}</div>
                  {projectGuidance.next_block && (
                    <div className="text-xs text-sky-300">Suggested next block: {projectGuidance.next_block}</div>
                  )}
                  <div className="space-y-1">
                    {(projectGuidance.actions || []).slice(0, 4).map((a) => (
                      <div key={`${a.block_id}-${a.priority}`} className="text-xs text-neutral-400">
                        <span className={`${a.priority === "warning" ? "text-yellow-300" : a.priority === "next" ? "text-emerald-300" : "text-neutral-500"}`}>
                          [{a.priority}]
                        </span>{" "}
                        {a.title}: {a.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {workspaceBlocks.map((block) => (
                  <button
                    key={block.block_id}
                    onClick={() => {
                      setFocusedBlockId(block.block_id);
                      setDrillTab("overview");
                    }}
                    className={`text-left rounded-md border p-3 transition ${blockStateClass(block.state)} ${flashUnlocked[block.block_id] ? "animate-pulse" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-neutral-100">{block.title}</div>
                      <div className="text-[10px] uppercase tracking-wide text-neutral-400">{block.state}</div>
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">{block.reason}</div>
                  </button>
                ))}
              </div>
              {focusedBlock && (
                <div className="rounded-md border border-neutral-800 bg-neutral-950 p-3 space-y-2">
                  <div className="text-sm font-semibold text-neutral-200">{focusedBlock.title} Focus</div>
                  <div className="text-xs text-neutral-400">{focusedBlock.reason}</div>
                  {focusedBlock.block_id === "data" && dataProviders.length > 0 && (
                    <div className="rounded border border-neutral-800 bg-neutral-900/60 p-2">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">Data Providers</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                        {dataProviders.map((p) => (
                          <div key={String(p.id)} className={`text-xs rounded border px-2 py-1 ${p.enabled ? "border-emerald-700/60 text-emerald-300" : "border-neutral-700 text-neutral-400"}`}>
                            <div className="font-medium">{String(p.id)}</div>
                            <div>{Array.isArray(p.asset_classes) ? p.asset_classes.join(", ") : ""}</div>
                            <div>{p.enabled ? "enabled" : "planned"}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {focusedBlock.block_id === "data" && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      <input id="data_source" placeholder="source (e.g. yfinance)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="data_provenance" placeholder="provenance (synthetic/real)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="data_frequency" placeholder="frequency (daily)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="data_missing_ratio" placeholder="missing_ratio (0.00)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="data_asset_count" placeholder="asset_count (10)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <button
                        onClick={() => saveFocusedBlockPayload({
                          source: (document.getElementById("data_source") as HTMLInputElement)?.value ?? "",
                          provenance: (document.getElementById("data_provenance") as HTMLInputElement)?.value ?? "",
                          frequency: (document.getElementById("data_frequency") as HTMLInputElement)?.value ?? "",
                          missing_ratio: Number((document.getElementById("data_missing_ratio") as HTMLInputElement)?.value ?? 0),
                          asset_count: Number((document.getElementById("data_asset_count") as HTMLInputElement)?.value ?? 0),
                        })}
                        className="md:col-span-5 px-3 py-2 rounded border border-neutral-700 text-xs text-neutral-200 hover:bg-neutral-800"
                      >
                        Save Data Block
                      </button>
                    </div>
                  )}
                  {focusedBlock.block_id === "universe" && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      <input id="uni_selection" placeholder="selection (etf_cross_asset)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="uni_rules" placeholder="rules (comma-separated)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="uni_count" placeholder="asset_count (number)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="uni_asset_class" placeholder="asset_class (equities/etf/crypto)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="uni_min_adv" placeholder="min_adv_usd (optional)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <button
                        onClick={() => saveFocusedBlockPayload({
                          selection: (document.getElementById("uni_selection") as HTMLInputElement)?.value ?? "",
                          rules: ((document.getElementById("uni_rules") as HTMLInputElement)?.value ?? "").split(",").map((x) => x.trim()).filter(Boolean),
                          asset_count: Number((document.getElementById("uni_count") as HTMLInputElement)?.value ?? 0),
                          asset_class: (document.getElementById("uni_asset_class") as HTMLInputElement)?.value ?? "",
                          min_adv_usd: Number((document.getElementById("uni_min_adv") as HTMLInputElement)?.value ?? 0),
                        })}
                        className="md:col-span-5 px-3 py-2 rounded border border-neutral-700 text-xs text-neutral-200 hover:bg-neutral-800"
                      >
                        Save Universe Block
                      </button>
                    </div>
                  )}
                  {focusedBlock.block_id === "return_definition" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input id="ret_convention" placeholder="convention (close_to_close)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="ret_horizon" placeholder="horizon (1d)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="ret_alignment" placeholder="alignment (t_to_t1)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <button
                        onClick={() => saveFocusedBlockPayload({
                          convention: (document.getElementById("ret_convention") as HTMLInputElement)?.value ?? "",
                          horizon: (document.getElementById("ret_horizon") as HTMLInputElement)?.value ?? "",
                          alignment: (document.getElementById("ret_alignment") as HTMLInputElement)?.value ?? "",
                        })}
                        className="md:col-span-3 px-3 py-2 rounded border border-neutral-700 text-xs text-neutral-200 hover:bg-neutral-800"
                      >
                        Save Return Definition Block
                      </button>
                    </div>
                  )}
                  {focusedBlock.block_id === "strategy_builder" && (
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                      <input id="str_side" placeholder="side (long_only/long_short)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="str_weighting" placeholder="weighting (equal_weight)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="str_aum" placeholder="aum (100000)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="str_gross" placeholder="gross_exposure (200000)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="str_cost" placeholder="t_cost_bps (10)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="str_rebalance" placeholder="rebalance (daily/weekly/monthly)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="str_holding" placeholder="holding_period (1)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="str_maxpos" placeholder="max_positions (optional)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="str_base_bps" placeholder="cost_base_bps (8)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <input id="str_slippage_bps" placeholder="cost_slippage_bps (4)" className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs" />
                      <button
                        onClick={() => saveFocusedBlockPayload({
                          side: (document.getElementById("str_side") as HTMLInputElement)?.value ?? "",
                          weighting: (document.getElementById("str_weighting") as HTMLInputElement)?.value ?? "",
                          aum: Number((document.getElementById("str_aum") as HTMLInputElement)?.value ?? 0),
                          gross_exposure: Number((document.getElementById("str_gross") as HTMLInputElement)?.value ?? 0),
                          t_cost_bps: Number((document.getElementById("str_cost") as HTMLInputElement)?.value ?? 0),
                          rebalance_frequency: (document.getElementById("str_rebalance") as HTMLInputElement)?.value ?? "",
                          holding_period: Number((document.getElementById("str_holding") as HTMLInputElement)?.value ?? 1),
                          max_positions: Number((document.getElementById("str_maxpos") as HTMLInputElement)?.value ?? 0) || null,
                          cost_base_bps: Number((document.getElementById("str_base_bps") as HTMLInputElement)?.value ?? 0),
                          cost_slippage_bps: Number((document.getElementById("str_slippage_bps") as HTMLInputElement)?.value ?? 0),
                        })}
                        className="md:col-span-5 px-3 py-2 rounded border border-neutral-700 text-xs text-neutral-200 hover:bg-neutral-800"
                      >
                        Save Strategy Builder Block
                      </button>
                    </div>
                  )}
                  {focusedBlock.block_id === "reproduce_paper_results" && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <input
                        value={paperSourceInput}
                        onChange={(e) => setPaperSourceInput(e.target.value)}
                        placeholder="Paper URL/PDF/local path"
                        className="md:col-span-3 px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs"
                      />
                      <label className="flex items-center gap-2 px-2 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-300">
                        <input
                          type="checkbox"
                          checked={paperIncludesCodeRepo}
                          onChange={(e) => setPaperIncludesCodeRepo(e.target.checked)}
                        />
                        code repo
                      </label>
                      <button
                        onClick={handleCreatePaperPlan}
                        className="md:col-span-4 px-3 py-2 rounded border border-neutral-700 text-xs text-neutral-200 hover:bg-neutral-800"
                      >
                        Build Reproduction Plan
                      </button>
                    </div>
                  )}
                  <div className="pt-1 border-t border-neutral-800 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {(["overview", "assumptions", "equations", "distributions", "citations", "validation"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setDrillTab(tab)}
                          className={`px-2 py-1 rounded text-[11px] border ${drillTab === tab ? "border-white text-white" : "border-neutral-700 text-neutral-400 hover:text-neutral-200"}`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-neutral-300 whitespace-pre-wrap">
                      {(() => {
                        if (!focusedDrilldown) return "No drilldown available yet for this block.";
                        if (drillTab === "overview") {
                          const d = focusedDrilldown.diagnostics ? `\nDiagnostics: ${JSON.stringify(focusedDrilldown.diagnostics, null, 2)}` : "";
                          return `${focusedDrilldown.summary ?? ""}${d}`;
                        }
                        if (drillTab === "assumptions") return (focusedDrilldown.assumptions || []).join("\n- ").replace(/^/, "- ");
                        if (drillTab === "equations") return (focusedDrilldown.equations || []).join("\n- ").replace(/^/, "- ");
                        if (drillTab === "distributions") return (focusedDrilldown.distributions || []).join("\n- ").replace(/^/, "- ");
                        if (drillTab === "validation") return (focusedDrilldown.validation_checks || []).join("\n- ").replace(/^/, "- ");
                        if (drillTab === "citations") {
                          const rows = (focusedDrilldown.citations || []).map(
                            (c: any) => `- ${c.title || "Untitled"}${c.url ? `\n  ${c.url}` : ""}${c.relevance ? `\n  ${c.relevance}` : ""}`
                          );
                          return rows.length ? rows.join("\n") : "No citations attached.";
                        }
                        return "";
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className={splitWorkspace ? "lg:order-1 rounded-md border border-neutral-800 bg-neutral-950 p-3 h-[calc(100vh-190px)] flex flex-col" : ""}>
        <div className={`flex flex-col gap-4 mb-6 overflow-anchor-none ${splitWorkspace ? "min-h-0 flex-1 overflow-y-auto" : "min-h-[300px]"}`} style={{ overflowAnchor: "none" }}>
          {messages.length === 0 && (
            <p className="text-neutral-600 text-sm">No messages yet.</p>
          )}
          {messages.map((msg, i) => {
            const lagSection =
              lastResult?.sections?.find((s: any) => s.title === "IC vs Lag");

            return (
            <div
              key={i}
              className={msg.role === "user" ? "text-right" : "text-left"}
            >
              <span className="text-xs text-neutral-500 block mb-1">
                {msg.role === "user" ? "You" : "SignalLab"}
              </span>
              {/* user bubble */}
              {msg.role === "user" && (
                <div className="inline-block px-4 py-3 rounded-md text-sm whitespace-pre-wrap max-w-prose bg-neutral-800 text-neutral-100">
                  {msg.content}
                </div>
              )}
              {/* assistant: ask response (has answer/citations but no ui_components) */}
              {msg.role === "assistant" && !msg.ui_components?.length && !msg.factorscope_report && !msg.returnscope_report && (
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
              {msg.role === "assistant" && ((msg.ui_components && msg.ui_components.length > 0) || msg.factorscope_report || msg.returnscope_report) && (
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
                      suggestion = "→ This signal shows no predictive power. Want to test a structured signal like a linear factor signal instead?";
                    } else if (type === "factor-driven") {
                      suggestion = "→ This signal shows strong explanatory power (high beta, low residual). Want to compare it to a noise signal?";
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
                      Generated using synthetic data &middot; preset: <span className="text-neutral-400 font-medium">{formatSyntheticDisplayName(msg.synth_preset)}</span>
                    </div>
                  )}
                  <AnalysisContextBlock context={msg.analysis_context} />
                  <FeatureScopeBlock feature={msg.feature_scope} />
                  <FactorScopeBlock report={msg.factorscope_report} />
                  <ReturnScopeBlock report={msg.returnscope_report} />
                  <ResearchTheoryBlock
                    theory={(msg as any).research_theory}
                    references={(msg as any).user_references}
                    citationAudit={(msg as any).citation_audit}
                  />
                  {(msg.ui_components || [])
                    .filter((s: any) => s.id === "llm_interpretation")
                    .map((s: any) => renderSection(s, handleAsk, setActiveSection))}
                  {(msg.ui_components || [])
                    .filter((s: any) => s.id !== "llm_interpretation" && s.title !== "Leakage Analysis" && s.title !== "IC vs Lag")
                    .map((s: any) => renderSection(s, handleAsk, setActiveSection))}
                  <DataOverview msg={msg} />
                  <Charts msg={msg} />
                  <ICLagChart data={lagSection?.content?.points} />
                  <LeakageAnalysis msg={msg} />
                  {(msg.ui_components?.length || msg.data_preview?.length) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => downloadNotebook(msg)}
                        className="px-3 py-2 text-sm rounded border border-neutral-600 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition cursor-pointer"
                      >
                        Download Notebook
                      </button>
                      <button
                        onClick={() => downloadPdfReport(msg)}
                        className="px-3 py-2 text-sm rounded border border-neutral-600 bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition cursor-pointer"
                      >
                        Download Report (PDF)
                      </button>
                    </div>
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
          );})}
          {loading && (
            <div className="text-left">
              <span className="text-xs text-neutral-500 block mb-1">
                SignalLab
              </span>
              <div className="inline-block px-4 py-3 rounded-md text-sm bg-neutral-900 border border-neutral-800 text-neutral-400">
                Analyzing signal...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {synthMode && !splitWorkspace && (
          <SyntheticGenerator
            loading={loading}
            onGenerate={handleSynthGenerate}
            onCancel={() => setSynthMode(false)}
          />
        )}

        <form onSubmit={handleSubmit} className={`flex gap-3 ${splitWorkspace ? "mt-auto" : ""}`}>
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
        {!splitWorkspace && (
        <div className="mt-6 border-t border-neutral-800 pt-5">
          <div className="text-xs text-neutral-500 font-medium mb-2">Paste custom signal (JSON)</div>
          <textarea
            value={customSignal}
            onChange={(e) => setCustomSignal(e.target.value)}
            placeholder={'[{"date":"2020-01-01","asset":"ASSET_000","signal":0.5}]'}
            className="w-full h-28 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-xs font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
          />
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="text"
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="Signal description"
              className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
            />
            <select
              value={customFrequency}
              onChange={(e) => setCustomFrequency(e.target.value as "daily" | "weekly" | "monthly")}
              className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-xs text-neutral-300 focus:outline-none focus:border-neutral-600"
            >
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
            </select>
            <input
              type="text"
              value={customUnits}
              onChange={(e) => setCustomUnits(e.target.value)}
              placeholder="Units (optional)"
              className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
            />
            <input
              type="text"
              value={customTheoryName}
              onChange={(e) => setCustomTheoryName(e.target.value)}
              placeholder="Theory name (optional)"
              className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
            />
          </div>
          <textarea
            value={customHypothesis}
            onChange={(e) => setCustomHypothesis(e.target.value)}
            placeholder="Hypothesis (recommended): e.g., Higher relative-strength assets will outperform over the next month."
            className="mt-2 w-full h-16 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
          />
          <input
            type="text"
            value={customDataSources}
            onChange={(e) => setCustomDataSources(e.target.value)}
            placeholder="Data sources (comma-separated, optional)"
            className="mt-2 w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-xs text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          />
          <textarea
            value={customReferences}
            onChange={(e) => setCustomReferences(e.target.value)}
            placeholder={'References JSON (optional): [{"title":"Paper","url":"https://...","kind":"primary"}]'}
            className="mt-2 w-full h-20 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-md text-xs font-mono text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 resize-none"
          />
          <button
            disabled={loading || !customSignal.trim()}
            onClick={async () => {
              let parsed: any[];
              let parsedRefs: any[] = [];
              try {
                parsed = JSON.parse(customSignal);
              } catch {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: "Invalid JSON format for signal." },
                ]);
                return;
              }
              if (customReferences.trim()) {
                try {
                  const refs = JSON.parse(customReferences);
                  if (!Array.isArray(refs)) throw new Error("References must be a JSON array.");
                  parsedRefs = refs;
                } catch {
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: "Invalid references JSON. Expected an array of {title,url,kind}." },
                  ]);
                  return;
                }
              }
              setLoading(true);
              try {
                const result = await executeAction({
                  action: "analyze_signal",
                  signal: parsed,
                  signal_metadata: {
                    description: customDescription || "User-defined signal",
                    frequency: customFrequency,
                    units: customUnits || undefined,
                    theory_name: customTheoryName || undefined,
                    hypothesis: customHypothesis || undefined,
                    references: parsedRefs,
                    data_sources: customDataSources
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                });
                setLastResult(result);
                setMessages((prev) => [
                  ...prev,
                  { role: "user", content: "analyze custom signal" },
                  buildReportMessage(result),
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
        )}
        </div>
      </div>
    </main>
  );
}
