"use client";

import type { ColDef } from "ag-grid-community";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Prompt } from "@/components/Prompt";
import type { DashboardConfig } from "@/lib/datavis/compileDashboard";
import type { Row } from "@/lib/datavis/types";

export default function Home() {
  const router = useRouter();

  const handlePromptSubmit = useCallback(
    (
      prompt: string,
      config: DashboardConfig,
      rowData: Row[],
      columnDefs: ColDef<Row>[],
    ) => {
      sessionStorage.setItem("userPrompt", prompt);
      sessionStorage.setItem("dashboardConfig", JSON.stringify(config));
      sessionStorage.setItem("rowData", JSON.stringify(rowData));
      sessionStorage.setItem("columnDefs", JSON.stringify(columnDefs));
      router.push("/dashboard");
    },
    [router],
  );

  return <Prompt onSubmit={handlePromptSubmit} />;
}
