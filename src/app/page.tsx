"use client";

import type { ColDef } from "ag-grid-community";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, ViewTransition } from "react";
import { Content } from "@/components/Content";
import { Prompt } from "@/components/Prompt";
import type { DashboardConfig } from "@/lib/datavis/compileDashboard";
import type { Row } from "@/lib/datavis/types";

const PromptDescription = () => (
  <>
    Enter a prompt to visualize our sample (retail sales) dataset.{" "}
    <Link
      href="/data"
      target="_blank"
      className="inline-block underline underline-offset-3 hover:text-foreground"
    >
      Explore the dataset.
    </Link>
  </>
);

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

  return (
    <Content description={<PromptDescription />}>
      <ViewTransition exit="prompt-fade-out" default="none">
        <Prompt onSubmit={handlePromptSubmit} />
      </ViewTransition>
    </Content>
  );
}
