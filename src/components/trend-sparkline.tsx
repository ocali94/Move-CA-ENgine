"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

export function TrendSparkline({
  data,
  color = "#3ca848",
}: {
  data: { date?: string; value: number }[];
  color?: string;
}) {
  const safeData = data.length ? data : [{ value: 0 }, { value: 0 }];

  return (
    <div className="h-14 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={safeData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
