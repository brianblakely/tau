"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Prompt } from "@/components/Prompt";
import type { DashboardConfig } from "@/lib/datavis/compileDashboard";

export default function Home() {
  const router = useRouter();

  const handlePromptSubmit = useCallback(
    (prompt: string, config: DashboardConfig) => {
      sessionStorage.setItem("userPrompt", prompt);
      sessionStorage.setItem("dashboardConfig", JSON.stringify(config));
      router.push("/dashboard");
    },
    [router],
  );

  return <Prompt onSubmit={handlePromptSubmit} />;
}
