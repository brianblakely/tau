import type {
  DataType,
  FeatureExtractionPipeline,
  ZeroShotClassificationPipeline,
} from "@huggingface/transformers";
import { ModelRegistry, pipeline } from "@huggingface/transformers";
import type { InferenceBackend } from "./inferenceTypes";

const preferredDtypes: DataType[] = ["q8", "q4", "fp32"];

const detectBackend = async (): Promise<InferenceBackend> => {
  if (!("gpu" in self.navigator)) return "wasm";

  try {
    const adapter = await self.navigator.gpu.requestAdapter();
    if (!adapter) return "wasm";
    return "webgpu";
  } catch {
    return "wasm";
  }
};

const chooseDtype = async (
  model: string,
  backend: InferenceBackend,
): Promise<DataType> => {
  try {
    const available = await ModelRegistry.get_available_dtypes(model);
    return preferredDtypes.find((dtype) => available.includes(dtype)) ?? "fp32";
  } catch {
    return backend === "webgpu" ? "fp32" : "q8";
  }
};

const inferenceRuntimeConfig = async (
  model: string,
): Promise<{
  device: InferenceBackend;
  dtype: DataType;
}> => {
  const device = await detectBackend();
  const dtype = await chooseDtype(model, device);
  return { device, dtype };
};

export const InferenceEngine: {
  zeroShotPromise: Promise<ZeroShotClassificationPipeline> | null;
  embedderPromise: Promise<FeatureExtractionPipeline> | null;
  getZeroShot: (
    progress_callback?: (x: unknown) => void,
  ) => Promise<ZeroShotClassificationPipeline>;
  getEmbedder: (
    progress_callback?: (x: unknown) => void,
  ) => Promise<FeatureExtractionPipeline>;
} = {
  zeroShotPromise: null,
  embedderPromise: null,

  async getZeroShot(progress_callback?: (x: unknown) => void) {
    const model = "Xenova/nli-deberta-v3-xsmall";
    const { device, dtype } = await inferenceRuntimeConfig(model);

    if (!InferenceEngine.zeroShotPromise) {
      InferenceEngine.zeroShotPromise = pipeline(
        "zero-shot-classification",
        model,
        { progress_callback, device, dtype },
      );
    }
    return InferenceEngine.zeroShotPromise;
  },

  async getEmbedder(progress_callback?: (x: unknown) => void) {
    const model = "Xenova/all-MiniLM-L6-v2";
    const { device, dtype } = await inferenceRuntimeConfig(model);

    if (!InferenceEngine.embedderPromise) {
      InferenceEngine.embedderPromise = pipeline("feature-extraction", model, {
        progress_callback,
        device,
        dtype,
      });
    }
    return InferenceEngine.embedderPromise;
  },
};
