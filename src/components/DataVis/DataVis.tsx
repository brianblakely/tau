"use client";

import { AgChartsEnterpriseModule } from "ag-charts-enterprise";
import type {
  ChartCreatedEvent,
  ChartType,
  ColDef,
  ColumnState,
  CreateRangeChartParams,
  FirstDataRenderedEvent,
  GridApi,
  GridReadyEvent,
} from "ag-grid-community";
import {
  AllCommunityModule,
  colorSchemeDarkBlue,
  themeQuartz,
} from "ag-grid-community";
import {
  IntegratedChartsModule,
  PivotModule,
  RowGroupingModule,
  TreeDataModule,
} from "ag-grid-enterprise";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { DashboardConfig } from "@/lib/datavis/compileDashboard";
import type { Row } from "@/lib/datavis/types";
import type { VisType } from "@/lib/ml/types";

type FilterOp =
  | "="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "contains"
  | "startsWith";

export type ColumnMeta = Record<
  string,
  {
    kind: "text" | "number";
  }
>;

export type DataVisProps = {
  rowData: Row[];
  columnDefs: ColDef<Row>[];
  spec: DashboardConfig;
  columnMeta: ColumnMeta;
  onDisplayed?: () => void;
};

function isChartVisType(
  visType: VisType,
): visType is Exclude<VisType, "table"> {
  return visType !== "table";
}

function mapChartType(visType: Exclude<VisType, "table">): ChartType {
  switch (visType) {
    case "bar":
      return "groupedColumn" as const;
    case "line":
      return "line" as const;
    case "area":
      return "area" as const;
    case "pie":
      return "pie" as const;
  }

  return "groupedBar" as const;
}

function buildTextFilter(op: FilterOp, value: string) {
  switch (op) {
    case "=":
      return { filterType: "text", type: "equals", filter: value };
    case "!=":
      return { filterType: "text", type: "notEqual", filter: value };
    case "contains":
      return { filterType: "text", type: "contains", filter: value };
    case "startsWith":
      return { filterType: "text", type: "startsWith", filter: value };
    default:
      throw new Error(`Unsupported text filter op: ${op}`);
  }
}

function buildNumberFilter(op: FilterOp, value: number) {
  switch (op) {
    case "=":
      return { filterType: "number", type: "equals", filter: value };
    case "!=":
      return { filterType: "number", type: "notEqual", filter: value };
    case "<":
      return { filterType: "number", type: "lessThan", filter: value };
    case "<=":
      return { filterType: "number", type: "lessThanOrEqual", filter: value };
    case ">":
      return { filterType: "number", type: "greaterThan", filter: value };
    case ">=":
      return {
        filterType: "number",
        type: "greaterThanOrEqual",
        filter: value,
      };
    default:
      throw new Error(`Unsupported number filter op: ${op}`);
  }
}

function buildFilterModel(spec: DashboardConfig, meta: ColumnMeta) {
  const model: Record<string, unknown> = {};

  for (const filter of spec.query.filters) {
    const kind = meta[filter.field]?.kind ?? "text";

    model[filter.field] =
      kind === "number"
        ? buildNumberFilter(filter.op, Number(filter.value))
        : buildTextFilter(filter.op, String(filter.value));
  }

  return model;
}

function buildColumnState(spec: DashboardConfig): ColumnState[] {
  const state: ColumnState[] = [];

  spec.query.groupBy.forEach((field, index) => {
    state.push({
      colId: field,
      rowGroupIndex: index,
    });
  });

  spec.query.metrics.forEach((metric) => {
    state.push({
      colId: metric.field,
      aggFunc: metric.aggregation,
    });
  });

  spec.query.sort.forEach((sort, index) => {
    state.push({
      colId: sort.field,
      sort: sort.direction,
      sortIndex: index,
    });
  });

  return state;
}

function applyDisplaySpec(
  api: GridApi,
  spec: DashboardConfig,
  columnMeta: ColumnMeta,
  chartContainer: HTMLDivElement | null,
  previousChartRef: { destroyChart(): void } | null,
) {
  api.applyColumnState({
    defaultState: {
      sort: null,
      rowGroup: null,
      rowGroupIndex: null,
      pivot: null,
      pivotIndex: null,
      aggFunc: null,
    },
    state: buildColumnState(spec),
  });

  api.setFilterModel(buildFilterModel(spec, columnMeta));

  previousChartRef?.destroyChart();

  if (!isChartVisType(spec.visType)) {
    return null;
  }

  if (!chartContainer) {
    return null;
  }

  const categoryField = spec.query.groupBy[0];
  const metricFields = spec.query.metrics.map((m) => m.field);

  if (!categoryField || metricFields.length === 0) {
    return null;
  }

  const groupingActive = spec.query.groupBy.length > 0;

  const chartParams: CreateRangeChartParams = {
    chartType: mapChartType(spec.visType),
    cellRange: {
      columns: groupingActive
        ? ["ag-Grid-AutoColumn", ...metricFields]
        : [categoryField, ...metricFields],
    },
    aggFunc: spec.query.metrics[0].aggregation,
    chartContainer,
    suppressChartRanges: true,
  };

  return api.createRangeChart(chartParams) ?? null;
}

const modules = [
  AllCommunityModule,
  IntegratedChartsModule.with(AgChartsEnterpriseModule),
  RowGroupingModule,
  PivotModule,
  TreeDataModule,
];

const tauTheme = themeQuartz.withPart(colorSchemeDarkBlue).withParams({
  spacing: 3,
  rowHeight: 24,
  headerHeight: 26,
  listItemHeight: 24,
  fontSize: 12,
});

const autoSizeStrategy = {
  type: "fitCellContents" as const,
};

export function DataVis({
  rowData,
  columnDefs,
  spec,
  columnMeta,
  onDisplayed,
}: DataVisProps) {
  const apiRef = useRef<GridApi | null>(null);
  const chartRef = useRef<{ destroyChart(): void } | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  const defaultColDef = useMemo<ColDef<Row>>(
    () => ({
      sortable: true,
      filter: true,
      enableRowGroup: true,
      enableValue: true,
      resizable: false,
    }),
    [],
  );

  const syncSpecIntoGrid = useCallback(() => {
    if (!apiRef.current) return;

    chartRef.current = applyDisplaySpec(
      apiRef.current,
      spec,
      columnMeta,
      chartContainerRef.current,
      chartRef.current,
    );
  }, [columnMeta, spec]);

  function onGridReady(event: GridReadyEvent) {
    apiRef.current = event.api;
    syncSpecIntoGrid();
  }

  const onFirstDataRendered = useCallback(
    (_event: FirstDataRenderedEvent<Row>) => {
      if (spec.visType === "table") {
        onDisplayed?.();
      }
    },
    [onDisplayed, spec.visType],
  );

  const onChartCreated = useCallback(
    (_event: ChartCreatedEvent<Row>) => {
      if (isChartVisType(spec.visType)) {
        onDisplayed?.();
      }
    },
    [onDisplayed, spec.visType],
  );

  useEffect(() => {
    syncSpecIntoGrid();
  }, [syncSpecIntoGrid]);

  useEffect(() => {
    return () => {
      chartRef.current?.destroyChart();
    };
  }, []);

  return (
    <AgGridProvider modules={modules}>
      {spec.visType !== "table" && (
        <div ref={chartContainerRef} className="flex-1" />
      )}

      <div className={`flex-1 ${spec.visType !== "table" ? "hidden" : ""}`}>
        <AgGridReact<Row>
          theme={tauTheme}
          rowData={rowData}
          rowBuffer={50}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          suppressColumnVirtualisation={true}
          autoSizeStrategy={autoSizeStrategy}
          onGridReady={onGridReady}
          onFirstDataRendered={onFirstDataRendered}
          onChartCreated={onChartCreated}
          enableCharts={true}
          chartThemes={["ag-vivid-dark"]}
        />
      </div>
    </AgGridProvider>
  );
}
