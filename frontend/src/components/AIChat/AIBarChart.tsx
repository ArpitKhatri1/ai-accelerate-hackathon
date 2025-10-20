// @/components/dashboard/BarChart.tsx
'use client';

import {
  Bar,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface ChartDatum {
  [key: string]: string | number;
}

interface BarChartProps {
  data: ChartDatum[];
}

export function AIBarChart({ data }: BarChartProps) {
  // 1. Guard against empty data
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] w-full text-gray-500">
        No data to display.
      </div>
    );
  }

  // 2. Dynamically find the keys
  const keys = Object.keys(data[0]);

  // Assume the "name" key is for the X-axis (the label)
  const xAxisKey = 'name';

  // Find the (first) other key that is a number
  // This will be our Y-axis (the bar value)
  const yAxisKey = keys.find((key) => {
    if (key === xAxisKey) {
      return false;
    }
    const value = data[0][key];
    return typeof value === 'number';
  });

  // 3. Handle cases where data is in the wrong format
  if (!yAxisKey) {
    console.error('Chart Error: Could not find a numeric data key.', data[0]);
    return (
      <div className="flex items-center justify-center h-[350px] w-full text-red-500">
        Error: Chart data is in an unknown format.
      </div>
    );
  }

  // 4. Render the chart with the dynamic keys
  return (
    <ResponsiveContainer width={900} height={350} className={'p-1'}>
      <RechartsBarChart data={data}>
        <XAxis
          dataKey={xAxisKey} // Use the "name" key
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          // Hide long ticks if they are UUIDs or long names
          // tick={false} 
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(4px)',
            borderRadius: '0.5rem',
            border: '1px solid rgba(0, 0, 0, 0.1)',
          }}
        />
        <Bar
          dataKey={yAxisKey} // <-- THE FIX: Use the dynamic key
          fill="currentColor"
          radius={[4, 4, 0, 0]}
          className="fill-primary"
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}