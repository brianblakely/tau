import type { DashboardSpec, SchemaContext } from "@/lib/ml/types";

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

export const sampleDataSchemaSpec: SchemaContext = {
  datasetName: "Big box retail store orders/sales",
  fields: [
    {
      name: "State",
      kind: "string",
      description: "US state where the order is to be delivered",
      sampleValues: [
        "California",
        "Texas",
        "Florida",
        "New York",
        "Illinois",
        "New Jersey",
      ],
    },
    {
      name: "Category",
      kind: "string",
      description: "Product category",
      sampleValues: ["Furniture", "Office Supplies", "Technology"],
    },
    {
      name: "Sales",
      kind: "number",
      description: "Total sales amount in dollars for the order",
      sampleValues: ["100.0", "250.5", "75.25", "300.0", "50.0"],
    },
    {
      name: "Profit",
      kind: "number",
      description: "Profit amount in dollars for the order",
      sampleValues: ["20.0", "50.5", "10.25", "80.0", "5.0"],
    },
    {
      name: "Quantity",
      kind: "number",
      description: "Number of items in the order",
      sampleValues: ["1", "2", "3", "4", "5"],
    },
    {
      name: "Order Date",
      kind: "date",
      description: "Date when the order was placed",
      sampleValues: [
        "2023-01-15",
        "2023-02-20",
        "2023-03-10",
        "2023-04-05",
        "2023-05-25",
      ],
    },
  ],
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
