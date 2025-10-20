'use client'

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartVisualizationType } from './types'

const BLUE_SHADES = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd']

const barData = [
  { name: 'Sales', value: 420 },
  { name: 'Marketing', value: 310 },
  { name: 'Finance', value: 280 },
  { name: 'Support', value: 350 },
]

const lineData = [
  { month: 'Jan', value: 120 },
  { month: 'Feb', value: 180 },
  { month: 'Mar', value: 160 },
  { month: 'Apr', value: 220 },
  { month: 'May', value: 260 },
  { month: 'Jun', value: 240 },
]

const doubleBarData = [
  { name: 'Q1', current: 320, previous: 250 },
  { name: 'Q2', current: 410, previous: 300 },
  { name: 'Q3', current: 380, previous: 330 },
  { name: 'Q4', current: 460, previous: 360 },
]

const pieData = [
  { name: 'North', value: 35, fill: BLUE_SHADES[0] },
  { name: 'South', value: 25, fill: BLUE_SHADES[1] },
  { name: 'East', value: 20, fill: BLUE_SHADES[2] },
  { name: 'West', value: 20, fill: BLUE_SHADES[3] },
]

export const chartMetadata: Record<
  ChartVisualizationType,
  {
    label: string
    description: string
  }
> = {
  bar: {
    label: 'Bar Chart',
    description: 'Compare values across categories using vertical bars.',
  },
  'double-bar': {
    label: 'Double Bar Chart',
    description: 'Compare two metrics side-by-side for each category.',
  },
  line: {
    label: 'Line Chart',
    description: 'Track performance trends over time.',
  },
  pie: {
    label: 'Pie Chart',
    description: 'Show proportional breakdown of a whole.',
  },
}

interface ChartRendererProps {
  type: ChartVisualizationType
  height: number
}

export function ChartRenderer({ type, height }: ChartRendererProps) {
  switch (type) {
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
            <XAxis dataKey="name" stroke="#1e3a8a" />
            <YAxis stroke="#1e3a8a" />
            <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#bfdbfe' }} />
            <Legend wrapperStyle={{ color: '#1e3a8a' }} />
            <Bar dataKey="value" fill={BLUE_SHADES[2]} radius={[6, 6, 0, 0]} />
          </RechartsBarChart>
        </ResponsiveContainer>
      )
    case 'double-bar':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart data={doubleBarData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
            <XAxis dataKey="name" stroke="#1e3a8a" />
            <YAxis stroke="#1e3a8a" />
            <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#bfdbfe' }} />
            <Legend wrapperStyle={{ color: '#1e3a8a' }} />
            <Bar dataKey="current" fill={BLUE_SHADES[1]} radius={[6, 6, 0, 0]} />
            <Bar dataKey="previous" fill={BLUE_SHADES[3]} radius={[6, 6, 0, 0]} />
          </RechartsBarChart>
        </ResponsiveContainer>
      )
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#bfdbfe" />
            <XAxis dataKey="month" stroke="#1e3a8a" />
            <YAxis stroke="#1e3a8a" />
            <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#bfdbfe' }} />
            <Legend wrapperStyle={{ color: '#1e3a8a' }} />
            <Line type="monotone" dataKey="value" stroke={BLUE_SHADES[1]} strokeWidth={3} dot={{ fill: BLUE_SHADES[0] }} />
          </LineChart>
        </ResponsiveContainer>
      )
    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} stroke="#fff" strokeWidth={2} />
            <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#bfdbfe' }} />
            <Legend wrapperStyle={{ color: '#1e3a8a' }} />
          </PieChart>
        </ResponsiveContainer>
      )
    default:
      return null
  }
}
