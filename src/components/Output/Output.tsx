"use client";

import type { ColDef } from "ag-grid-community";
import { useEffect, useMemo, useState, ViewTransition } from "react";
import type { DashboardConfig } from "@/lib/datavis/compileDashboard";
import type { Row } from "@/lib/datavis/types";
import { Content } from "../Content";
import { type ColumnMeta, DataVis } from "../DataVis";

const OutputDescription = ({ prompt }: { prompt: string }) => (
  <>{`"${prompt}"`}</>
);

export const Output = () => {
  const [prompt, setPrompt] = useState("");
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>();
  const [rowData, setRowData] = useState<Row[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef<Row>[]>([]);

  const columnMeta: ColumnMeta = useMemo(() => {
    return columnDefs.reduce((acc, colDef) => {
      const colName = colDef.field ?? colDef.headerName;
      if (colName !== undefined) {
        acc[colName] = {
          kind: colDef.cellDataType === "text" ? "text" : "number",
        };
      }
      return acc;
    }, {} as ColumnMeta);
  }, [columnDefs.reduce]);

  useEffect(() => {
    const storedPrompt = sessionStorage.getItem("userPrompt");
    const storedDashboardConfig = sessionStorage.getItem("dashboardConfig");
    const storedrowData = sessionStorage.getItem("rowData");
    const storedcolumnDefs = sessionStorage.getItem("columnDefs");

    console.log(`Prompt: ${storedPrompt}`);
    console.log(`Dashboard Config: ${storedDashboardConfig}`);

    if (storedPrompt) {
      setPrompt(storedPrompt);
    }
    if (storedDashboardConfig) {
      setDashboardConfig(JSON.parse(storedDashboardConfig));
    }
    if (storedrowData) {
      setRowData(JSON.parse(storedrowData));
    }
    if (storedcolumnDefs) {
      setColumnDefs(JSON.parse(storedcolumnDefs));
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
