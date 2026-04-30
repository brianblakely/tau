import type { WorkerRequest } from "@/lib/ml/nlp/inferenceTypes";
import { parsePrompt } from "@/lib/ml/nlp/parsePrompt";
import { InferenceEngine } from "@/lib/ml/nlp/runtime";

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  try {
    if (event.data.type === "init") {
      await Promise.all([
        InferenceEngine.getZeroShot((payload) =>
          self.postMessage({ type: "progress", payload }),
        ),
        InferenceEngine.getEmbedder((payload) =>
          self.postMessage({ type: "progress", payload }),
        ),
      ]);
      self.postMessage({ type: "ready" });
      return;
    }

    if (event.data.type === "parse") {
      const spec = await parsePrompt(event.data.prompt, event.data.schema);
      self.postMessage({ type: "result", payload: spec });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: error instanceof Error ? error.message : "Unknown worker error",
    });
  }
});
