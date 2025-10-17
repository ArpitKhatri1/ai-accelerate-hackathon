"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";

// --- Dummy Data ---
const envelopes = [
  { envelope_id: "1", status: "completed", contract_cycle_time_hours: "24", subject: "Contract A" },
  { envelope_id: "2", status: "sent", contract_cycle_time_hours: "0", subject: "Contract B" },
  { envelope_id: "3", status: "completed", contract_cycle_time_hours: "36", subject: "Contract C" },
  { envelope_id: "4", status: "draft", contract_cycle_time_hours: "0", subject: "Contract D" },
  { envelope_id: "5", status: "completed", contract_cycle_time_hours: "48", subject: "Contract E" },
];

const recipients = [
  { envelope_id: "1", status: "signed", name: "Alice", type: "signer" },
  { envelope_id: "2", status: "pending", name: "Bob", type: "signer" },
  { envelope_id: "3", status: "signed", name: "Alice", type: "signer" },
  { envelope_id: "4", status: "viewed", name: "Charlie", type: "signer" },
  { envelope_id: "5", status: "signed", name: "Bob", type: "signer" },
];

// --- Colors for charts ---
const colors = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#6366f1"];

export default function Dashboard() {
  // --- Metrics ---
  const totalEnvelopes = envelopes.length;
  const avgCycleTime =
    envelopes.reduce((acc, e) => acc + parseFloat(e.contract_cycle_time_hours), 0) / envelopes.length;

  const statusCounts = envelopes.reduce((acc: Record<string, number>, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const userCounts = recipients.reduce((acc: Record<string, number>, r) => {
    if (r.type === "signer") acc[r.name] = (acc[r.name] || 0) + 1;
    return acc;
  }, {});

  const topUsers = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const cycleData = envelopes.map((e) => ({
    envelope: e.subject,
    cycleTime: parseFloat(e.contract_cycle_time_hours),
  }));

  const recipientStatusCounts = recipients.reduce((acc: Record<string, number>, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const recipientData = Object.entries(recipientStatusCounts).map(([name, value]) => ({ name, value }));

  return (
    <ScrollArea className="h-screen p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Summary Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Summary Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>Total Envelopes: {totalEnvelopes}</div>
            <div>Average Cycle Time (hrs): {avgCycleTime.toFixed(2)}</div>
          </CardContent>
        </Card>

        {/* Envelope Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Envelope Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {statusData.map((_, index) => (
                    <Cell key={index} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cycle Time Area Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Contract Cycle Times</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cycleData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <XAxis dataKey="envelope" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="cycleTime" stroke="#4f46e5" fill="#c7d2fe" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Users Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Users by Envelopes Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topUsers} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recipient Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Recipient Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={recipientData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {recipientData.map((_, index) => (
                    <Cell key={index} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
