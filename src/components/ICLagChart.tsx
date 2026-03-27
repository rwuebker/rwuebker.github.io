import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

type Props = {
  data?: { lag: number; ic: number }[];
};

export default function ICLagChart({ data }: Props) {
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-neutral-200 mb-2">
        IC vs Lag
      </h4>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid stroke="#374151" />
          <XAxis dataKey="lag" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="ic"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-neutral-400 mt-2">
        Peak at lag 0 = valid timing. Peak at +1 = potential leakage.
      </p>
    </div>
  );
}
