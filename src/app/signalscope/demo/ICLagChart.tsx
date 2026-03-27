"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ICLagPoint {
  lag: number;
  ic: number;
}

interface Props {
  data: ICLagPoint[] | null | undefined;
}

export default function ICLagChart({ data }: Props) {
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-neutral-200 mb-2">IC vs Lag</h4>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#374151" />
          <XAxis
            dataKey="lag"
            label={{ value: "Lag", position: "insideBottom", offset: -2, style: { fill: "#9ca3af", fontSize: 11 } }}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
          />
          <YAxis
            label={{ value: "IC", angle: -90, position: "insideLeft", offset: 8, style: { fill: "#9ca3af", fontSize: 11 } }}
            tick={{ fill: "#9ca3af", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 4 }}
            labelStyle={{ color: "#e5e7eb", fontSize: 11 }}
            itemStyle={{ color: "#93c5fd", fontSize: 11 }}
          />
          <Line
            type="monotone"
            dataKey="ic"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 3, fill: "#60a5fa" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-neutral-400 mt-2">
        Peak at lag 0 indicates valid timing. Peak at positive lag suggests potential leakage.
      </p>
    </div>
  );
}
