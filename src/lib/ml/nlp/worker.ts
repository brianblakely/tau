import type { SchemaField } from "@/lib/ml/types";
import { isPromptValid, parsePrompt, preloadInference } from "./inference";

export type ValidateRequest = {
  type: "validate";
  prompt: string;
};

export type ParseRequest = {
  type: "parse";
  prompt: string;
  schema: SchemaField[];
};

export type InitRequest = {
  type: "init";
};

export type WorkerRequest = ValidateRequest | ParseRequest | InitRequest;

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  try {
    if (event.data.type === "init") {
      await preloadInference((payload) =>
        self.postMessage({ type: "progress", payload }),
      );
      self.postMessage({ type: "ready" });
      return;
    }

    if (event.data.type === "validate") {
      const isValid = await isPromptValid(event.data.prompt);
      self.postMessage({ type: "validation", payload: isValid });
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
