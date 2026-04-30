export type FieldKind = "string" | "number" | "date" | "boolean";

export interface SchemaField {
  name: string;
  kind: FieldKind;
  sampleValues?: string[];
}

export type Aggregation = "sum" | "avg" | "count" | "min" | "max";
export type VisType =
  | "table"
  | "bar"
  | "line"
  | "area"
  | "scatter"
  | "pie"
  | "kpi";

export interface FilterSpec {
  field: string;
  op: "=" | "!=" | ">" | "<" | ">=" | "<=" | "contains" | "in" | "not in";
  value: string | number | string[];
}

export interface ViewSpec {
  kind: "chart" | "table" | "kpi";
  chartType?: VisType;
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
