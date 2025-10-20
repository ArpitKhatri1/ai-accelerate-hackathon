export type ChartVisualizationType = "bar" | "line" | "pie" | "double-bar";

export type WidgetKind = "chart" | "text-insight";

export type ChartHeight = "half" | "full";
export type ChartWidth = "half" | "full";

export interface BaseWidget {
  id: string;
  kind: WidgetKind;
  prompt: string;
  title?: string;
  description?: string;
  width: ChartWidth;
}

export interface ChartWidget extends BaseWidget {
  kind: "chart";
  chartType: ChartVisualizationType;
  height: ChartHeight;
}

export interface TextInsightWidget extends BaseWidget {
  kind: "text-insight";
}

export type DashboardWidget = ChartWidget | TextInsightWidget;

export interface AnalyticsDashboard {
  id: string;
  name: string;
  description?: string;
  charts: DashboardWidget[];
  createdAt: string;
}
