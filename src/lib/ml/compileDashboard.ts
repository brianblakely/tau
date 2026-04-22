import type { DashboardSpec } from "@/lib/ml/types";

export type DashboardConfig = {
  chartType?: string;
  query: {
    groupBy: string[];
    metrics: { field: string; aggregation: string }[];
    filters: any[];
    sort: { field: string; direction: "asc" | "desc" }[];
    limit?: number;
  };
  title?: string;
  warnings: string[];
};

export function compileDashboardConfig(spec: DashboardSpec) {
  const view = spec.views[0];
  if (!view) throw new Error("No views in DashboardSpec");

  return {
    chartType: view.chartType,
    query: {
      groupBy: view.xField ? [view.xField] : [],
      metrics: view.yField
        ? [{ field: view.yField, aggregation: view.aggregation ?? "sum" }]
        : [],
      filters: view.filters,
      sort: view.sort ? [view.sort] : [],
      limit: view.limit,
    },
    title: view.title,
    warnings: spec.warnings,
  };
}
