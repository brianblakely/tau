import type { DashboardSpec, SchemaField } from "@/lib/ml/types";
import { chooseAggregation } from "./aggregation";
import { rankFieldsByPrompt } from "./fieldRanking";
import { inferFilters, promptExplicitlyGroupsByField } from "./filters";
import { chooseSort, inferLimit } from "./sort";
import { chooseTitle } from "./text";
import { chooseChartType } from "./visualization";

export async function parsePrompt(
  prompt: string,
  schema: SchemaField[],
): Promise<DashboardSpec> {
  const numeric = schema.filter((field) => field.kind === "number");
  const groupable = schema.filter(
    (field) => field.kind === "string" || field.kind === "date",
  );

  const [chartChoice, metricRanks, dimensionRanks, filters, sort] =
    await Promise.all([
      chooseChartType(prompt),
      rankFieldsByPrompt(prompt, numeric, "metric"),
      rankFieldsByPrompt(prompt, groupable, "dimension"),
      inferFilters(prompt, schema),
      chooseSort(prompt),
    ]);

  const metric = metricRanks[0]?.field?.name;
  const aggregation = await chooseAggregation(prompt, metric);

  const filteredFields = new Set(filters.map((filter) => filter.field));
  const dimension = dimensionRanks.find(({ field }) => {
    return (
      !filteredFields.has(field.name) ||
      promptExplicitlyGroupsByField(prompt, field)
    );
  })?.field.name;

  const warnings: string[] = [];

  if (!metric && chartChoice.label !== "table" && chartChoice.label !== "kpi") {
    warnings.push("I could not confidently identify a numeric measure.");
  }
  if (!dimension && chartChoice.label !== "kpi") {
    warnings.push("I could not confidently identify a grouping field.");
  }

  const sortField =
    chartChoice.label === "kpi" ? metric : (metric ?? dimension);

  const confidenceParts = [
    chartChoice.score ?? 0,
    metricRanks[0]?.score ?? 0,
    dimensionRanks[0]?.score ?? 0,
    filters.length ? 0.85 : 0.55,
  ];

  return {
    confidence:
      confidenceParts.reduce((sum, score) => sum + score, 0) /
      confidenceParts.length,
    warnings,
    views: [
      {
        kind:
          chartChoice.label === "table"
            ? "table"
            : chartChoice.label === "kpi"
              ? "kpi"
              : "chart",
        chartType: chartChoice.label,
        xField: dimension,
        yField: metric,
        aggregation,
        filters,
        limit: inferLimit(prompt),
        sort:
          sort && sortField
            ? { field: sortField, direction: sort.direction }
            : undefined,
        title: chooseTitle(prompt),
      },
    ],
  };
}
