"use client";

import type { ColDef } from "ag-grid-community";
import { Astroid, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  ViewTransition,
} from "react";
import type { DashboardConfig } from "@/lib/datavis/compileDashboard";
import type { Row } from "@/lib/datavis/types";
import { Content } from "../Content";
import { type ColumnMeta, DataVis } from "../DataVis";
import { Prompt } from "../Prompt";
import { Button } from "../ui/button";

export const Output = () => {
  const [prompt, setPrompt] = useState("");
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>();
  const [rowData, setRowData] = useState<Row[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef<Row>[]>([]);
  const [dataVisDisplayed, setDataVisDisplayed] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

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
  }, [columnDefs]);

  const handleDataVisDisplayed = useCallback(() => {
    setDataVisDisplayed(true);
  }, []);

  const handleRefineToggle = useCallback(() => {
    setIsRefining((current) => !current);
  }, []);

  const handlePromptSubmit = useCallback(
    (
      nextPrompt: string,
      config: DashboardConfig,
      nextRowData: Row[],
      nextColumnDefs: ColDef<Row>[],
    ) => {
      sessionStorage.setItem("userPrompt", nextPrompt);
      sessionStorage.setItem("dashboardConfig", JSON.stringify(config));
      sessionStorage.setItem("rowData", JSON.stringify(nextRowData));
      sessionStorage.setItem("columnDefs", JSON.stringify(nextColumnDefs));

      setPrompt(nextPrompt);
      setDashboardConfig(config);
      setRowData(nextRowData);
      setColumnDefs(nextColumnDefs);
      setIsRefining(false);
    },
    [],
  );

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
    <Content
      description={
        dataVisDisplayed && (
          <span className="fade-wipe delay-100">{`"${prompt}"`}</span>
        )
      }
      action={
        dataVisDisplayed && (
          <Button
            type="button"
            size="sm"
            className="cursor-pointer fade-wipe delay-200"
            onClick={handleRefineToggle}
          >
            {!isRefining ? (
              <>
                <Astroid /> Refine
              </>
            ) : (
              <>
                <X className="fade-wipe fade-wipe-down" />{" "}
                <span className="fade-wipe fade-wipe-down">Close</span>
              </>
            )}
          </Button>
        )
      }
    >
      {isRefining && (
        <Prompt
          className="mb-4 fade-wipe fade-wipe-down delay-200"
          onSubmit={handlePromptSubmit}
        />
      )}
      <ViewTransition enter="output-fade-in" default="none">
        {dashboardConfig && rowData.length && (
          <div className="flex h-75">
            <DataVis
              rowData={rowData}
              columnDefs={columnDefs}
              spec={dashboardConfig}
              columnMeta={columnMeta}
              onDisplayed={handleDataVisDisplayed}
            />
          </div>
        )}
      </ViewTransition>
    </Content>
  );
};
