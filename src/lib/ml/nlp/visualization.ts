import type { VisType } from "@/lib/ml/types";
import { InferenceEngine } from "./runtime";

export async function chooseChartType(
  prompt: string,
): Promise<{ label: VisType; score: number }> {
  const zeroShot = await InferenceEngine.getZeroShot();
  const labelMapping: Record<string, VisType> = {
    "bar chart": "bar",
    "line chart": "line",
    "area chart": "area",
    "scatter plot": "scatter",
    "pie chart": "pie",
    "sunburst chart": "pie",
    table: "table",
    datagrid: "table",
    "kpi card": "kpi",
  };

  const result = await zeroShot(prompt, Object.keys(labelMapping));
  const top = {
    label: result.labels[0] as string,
    score: result.scores[0] as number,
  };

  return {
    label: labelMapping[top.label] ?? "table",
    score: top.score,
  };
}
