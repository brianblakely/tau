export type FieldKind = "string" | "number" | "date" | "boolean";

export interface SchemaField {
  name: string;
  kind: FieldKind;
  description?: string;
  sampleValues?: string[];
}

export interface SchemaContext {
  datasetName: string;
  fields: SchemaField[];
}

export type Aggregation = "sum" | "avg" | "count" | "min" | "max";
export type ChartType =
  | "bar"
  | "line"
  | "area"
  | "scatter"
  | "pie"
  | "table"
  | "kpi";

export interface FilterSpec {
  field: string;
  op: "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "in";
  value: string | number | string[];
}

export interface ViewSpec {
  kind: "chart" | "table" | "kpi";
  chartType?: ChartType;
  xField?: string;
  yField?: string;
  aggregation?: Aggregation;
  filters: FilterSpec[];
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  title?: string;
}

export interface DashboardSpec {
  views: ViewSpec[];
  warnings: string[];
  confidence: number;
}
