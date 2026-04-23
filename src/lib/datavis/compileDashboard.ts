import type { DashboardSpec, VisType } from "@/lib/ml/types";

type Aggregation = "sum" | "min" | "max" | "count" | "avg" | "first" | "last";

export type DashboardConfig = {
  visType: VisType;
  query: {
    groupBy: string[];
    metrics: { field: string; aggregation: Aggregation }[];
    filters: any[];
    sort: { field: string; direction: "asc" | "desc" }[];
    limit?: number;
  };
  title?: string;
  warnings: string[];
};

export function compileDashboardConfig(spec: DashboardSpec): DashboardConfig {
  const view = spec.views[0];
  if (!view) throw new Error("No views in DashboardSpec");

  return {
    visType: view.chartType ?? "table",
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
