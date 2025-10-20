export type ChartType = "bar" | "line" | "pie" | "double-bar";

export type ChartHeight = "half" | "full";
export type ChartWidth = "half" | "full";

export interface ChartWidget {
  id: string;
  type: ChartType;
  height: ChartHeight;
  width: ChartWidth;
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  description?: string;
  charts: ChartWidget[];
  createdAt: string;
}
