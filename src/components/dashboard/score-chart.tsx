"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MODEL_META, modelLabel } from "@/lib/models-meta";

interface ScorePoint {
  date: string;
  [model: string]: string | number | null;
}

export function ScoreChart({ data, models, unit }: { data: ScorePoint[]; models: string[]; unit?: string }) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Pas encore de données — lance une première analyse.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickFormatter={(d: string) => d.slice(5)}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value, name) => [`${value ?? "—"}${unit ?? ""}`, modelLabel(String(name))]}
          contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
        />
        {models.length > 1 && <Legend formatter={(v: string) => modelLabel(v)} />}
        {models.map((model) => (
          <Line
            key={model}
            type="monotone"
            dataKey={model}
            stroke={MODEL_META[model]?.color ?? "#666"}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
