import { InferenceEngine } from "./runtime";

export const isPromptValid = async (prompt: string): Promise<boolean> => {
  const zeroShot = await InferenceEngine.getZeroShot();
  const result = await zeroShot(
    prompt,
    ["a data visualization, chart, table, or dashboard"],
    {
      hypothesis_template: "This request asks for {}.",
      multi_label: true,
    },
  );

  return result.scores[0] >= 0.7;
};
