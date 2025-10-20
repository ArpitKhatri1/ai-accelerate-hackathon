"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  Cell,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { AgentChart } from '@/lib/agent-types';

const BLUE_SHADES = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

interface Props {
  chart: AgentChart;
}

function BarChartRenderer({ chart }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chart.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
        <XAxis dataKey="name" stroke="#1e3a8a" tickLine={false} />
        <YAxis stroke="#1e3a8a" tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#bfdbfe' }} />
        <Legend wrapperStyle={{ color: '#1e3a8a' }} />
        <Bar dataKey="value" fill={BLUE_SHADES[2]} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function DoubleBarChartRenderer({ chart }: Props) {
  const seriesALabel = chart.meta?.seriesALabel ?? 'Series A';
  const seriesBLabel = chart.meta?.seriesBLabel ?? 'Series B';
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chart.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
        <XAxis dataKey="name" stroke="#1e3a8a" tickLine={false} />
        <YAxis stroke="#1e3a8a" tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#bfdbfe' }} />
        <Legend wrapperStyle={{ color: '#1e3a8a' }} />
        <Bar dataKey="seriesA" name={seriesALabel} fill={BLUE_SHADES[1]} radius={[6, 6, 0, 0]} />
        <Bar dataKey="seriesB" name={seriesBLabel} fill={BLUE_SHADES[3]} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartRenderer({ chart }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chart.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
        <XAxis dataKey="name" stroke="#1e3a8a" tickLine={false} />
        <YAxis stroke="#1e3a8a" tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#bfdbfe' }} />
        <Legend wrapperStyle={{ color: '#1e3a8a' }} />
        <Line type="monotone" dataKey="value" stroke={BLUE_SHADES[1]} strokeWidth={3} dot={{ fill: BLUE_SHADES[0] }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function PieChartRenderer({ chart }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#bfdbfe' }} />
        <Legend wrapperStyle={{ color: '#1e3a8a' }} />
        <Pie
          data={chart.data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={100}
          stroke="#fff"
          strokeWidth={2}
        >
          {chart.data.map((entry, index) => (
            <Cell key={chart.id + '-' + index} fill={BLUE_SHADES[index % BLUE_SHADES.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ChatChartRenderer({ chart }: Props) {
  let renderedChart: React.ReactNode = null;

  switch (chart.type) {
    case 'bar':
      renderedChart = <BarChartRenderer chart={chart} />;
      break;
    case 'double-bar':
      renderedChart = <DoubleBarChartRenderer chart={chart} />;
      break;
    case 'line':
      renderedChart = <LineChartRenderer chart={chart} />;
      break;
    case 'pie':
      renderedChart = <PieChartRenderer chart={chart} />;
      break;
    default:
      renderedChart = null;
  }

  if (!renderedChart) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-background">
      {(chart.title || chart.description) && (
        <CardHeader className="pb-2">
          {chart.title && <CardTitle className="text-lg text-primary">{chart.title}</CardTitle>}
          {chart.description && (
            <CardDescription className="text-sm text-muted-foreground">
              {chart.description}
            </CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent className="pt-0">{renderedChart}</CardContent>
    </Card>
  );
}
