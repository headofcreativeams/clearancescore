import { Bar, BarChart, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { SubScore } from "@/lib/scan-data";
import { scoreBand } from "@/lib/scan-data";

interface SubScoreChartProps {
  subScores: SubScore[];
}

function riskColorVar(riskValue: number): string {
  // riskValue is a risk amount (0 = safe), so invert for banding purposes.
  const proxyScore = 100 - riskValue;
  return scoreBand(proxyScore).cssVar;
}

export function SubScoreChart({ subScores }: SubScoreChartProps) {
  const data = subScores
    .slice()
    .sort((a, b) => b.riskValue - a.riskValue)
    .map((s) => ({
      name: s.shortLabel,
      risk: s.riskValue,
      weight: s.weight,
      fullLabel: s.label,
    }));

  return (
    <div className="h-64 w-full" data-testid="chart-subscores">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted))" }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--popover-border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, _name, item) => [
              `${value} risk points`,
              `${item.payload.fullLabel} · ${item.payload.weight}% weight`,
            ]}
          />
          <Bar dataKey="risk" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry, index) => (
              <Cell key={index} fill={`hsl(var(${riskColorVar(entry.risk)}))`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
