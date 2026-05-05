"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardSpec, SchemaField } from "../lib/ml/types";

export function useMlOutput() {
  const workerRef = useRef<Worker | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const worker = new Worker(
      new URL("../lib/ml/nlp/worker.ts", import.meta.url),
      {
        type: "module",
      },
    );

    workerRef.current = worker;
    worker.postMessage({ type: "init" });

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "ready") {
        setReady(true);
      }
    };

    worker.addEventListener("message", onMessage);
    return () => {
      worker.removeEventListener("message", onMessage);
      worker.terminate();
    };
  }, []);

  const validate = async (prompt: string): Promise<boolean> => {
    const worker = workerRef.current;
    if (!worker) throw new Error("Worker not initialized");

    setLoading(true);

    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        const { type, payload } = event.data ?? {};
        if (type === "validation") {
          cleanup();
          setLoading(false);
          resolve(payload as boolean);
        } else if (type === "error") {
          cleanup();
          setLoading(false);
          reject(new Error(String(payload)));
        }
      };

      const cleanup = () => {
        worker.removeEventListener("message", onMessage);
      };

      worker.addEventListener("message", onMessage);
      worker.postMessage({ type: "validate", prompt });
    });
  };

  async function parse(
    prompt: string,
    schema: SchemaField[],
  ): Promise<DashboardSpec> {
    const worker = workerRef.current;
    if (!worker) throw new Error("Worker not initialized");

    setLoading(true);

    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        const { type, payload } = event.data ?? {};
        if (type === "result") {
          cleanup();
          setLoading(false);
          resolve(payload as DashboardSpec);
        } else if (type === "error") {
          cleanup();
          setLoading(false);
          reject(new Error(String(payload)));
        }
      };

      const cleanup = () => {
        worker.removeEventListener("message", onMessage);
      };

      worker.addEventListener("message", onMessage);
      worker.postMessage({ type: "parse", prompt, schema });
    });
  }

  return { ready, loading, validate, parse };
}
