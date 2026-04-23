"use client";

import { useEffect, useState, ViewTransition } from "react";
import { useSampleData } from "@/hooks/useSampleData";
import type { DashboardConfig } from "@/lib/datavis/compileDashboard";
import { columnMeta } from "@/lib/ml/schema";
import { Content } from "../Content";
import { DataVis } from "../DataVis";

const OutputDescription = ({ prompt }: { prompt: string }) => (
  <>{`"${prompt}"`}</>
);

export const Output = () => {
  const [prompt, setPrompt] = useState("");
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>();

  const { rowData, columnDefs } = useSampleData();

  useEffect(() => {
    const storedPrompt = sessionStorage.getItem("userPrompt");
    const storedDashboardConfig = sessionStorage.getItem("dashboardConfig");

    console.log(`Prompt: ${storedPrompt}`);
    console.log(`Dashboard Config: ${storedDashboardConfig}`);

    if (storedPrompt) {
      setPrompt(storedPrompt);
    }
    if (storedDashboardConfig) {
      setDashboardConfig(JSON.parse(storedDashboardConfig));
    }
  }, []);

  return (
    <Content description={<OutputDescription prompt={prompt} />}>
      <ViewTransition enter="output-fade-in" default="none">
        {dashboardConfig && rowData.length && (
          <div className="flex h-[300px]">
            <DataVis
              rowData={rowData}
              columnDefs={columnDefs}
              spec={dashboardConfig}
              columnMeta={columnMeta}
            />
          </div>
        )}
      </ViewTransition>
    </Content>
  );
};
