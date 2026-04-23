"use client";

import { useEffect, useState, ViewTransition } from "react";
import { useSampleData } from "@/hooks/useSampleData";
import type { DashboardConfig } from "@/lib/datavis/compileDashboard";
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
        {/* <code className="p-4 text-sm leading-6">
          {JSON.stringify(dashboardConfig)}
        </code> */}
        {dashboardConfig && (
          <div className="h-[300px]">
            <DataVis
              rowData={rowData}
              columnDefs={columnDefs}
              spec={dashboardConfig}
              columnMeta={{}}
            />
          </div>
        )}
      </ViewTransition>
    </Content>
  );
};
