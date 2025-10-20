"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

// Dummy data for envelope types
const envelopeTypeData = [
  { type: "Employment Contracts", avgDays: 3.2 },
  { type: "NDA Agreements", avgDays: 1.5 },
  { type: "Vendor Agreements", avgDays: 4.8 },
  { type: "Service Contracts", avgDays: 5.2 },
  { type: "Partnership Agreements", avgDays: 6.5 },
  { type: "Sales Contracts", avgDays: 2.8 },
]

const envelopeTypeConfig = {
  avgDays: {
    label: "Avg Days",
    color: "hsl(217, 91%, 60%)", // Blue color
  },
} satisfies ChartConfig

export function EnvelopeTypeCycleChart({className}: {className?: string}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Average Contract Cycle Time by Envelope Type</CardTitle>
        <CardDescription>Average time to completion by document type</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={envelopeTypeConfig} className="h-[300px] w-full">
          <BarChart accessibilityLayer data={envelopeTypeData} layout="vertical">
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="type"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              width={150}
              style={{ fontSize: '12px' }}
            />
            <XAxis 
              type="number"
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent 
                indicator="line"
                formatter={(value) => `${value} days`}
              />}
            />
            <Bar dataKey="avgDays" fill="var(--color-avgDays)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// Dummy data for the last 10 days
const chartData = [

  { date: "Oct 14", sent: 52, signed: 42 },
  { date: "Oct 15", sent: 48, signed: 40 },
  { date: "Oct 16", sent: 60, signed: 55 },
  { date: "Oct 17", sent: 55, signed: 48 },
  { date: "Oct 18", sent: 58, signed: 52 },
  { date: "Oct 19", sent: 62, signed: 58 },
]

const chartConfig = {
  sent: {
    label: "Sent",
    color: "hsl(217, 91%, 60%)", // Blue color
  },
  signed: {
    label: "Signed",
    color: "hsl(267, 91%, 60%)", // Orange color
  },
} satisfies ChartConfig

export function ContractSigningsChart({className}: {className?: string}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Contract Signings</CardTitle>
        <CardDescription>Last 10 days comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <Bar dataKey="sent" fill="var(--color-sent)" radius={4} />
            <Bar dataKey="signed" fill="var(--color-signed)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
