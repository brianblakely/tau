"use client";

import type { ColDef } from "ag-grid-community";
import {
  AllCommunityModule,
  colorSchemeDarkBlue,
  themeQuartz,
} from "ag-grid-community";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import type { Field } from "apache-arrow";
import { DataType, tableFromIPC } from "apache-arrow";
import { useEffect, useMemo, useState } from "react";
import data from "superstore-arrow";

type Row = Record<string, unknown>;

const tauTheme = themeQuartz.withPart(colorSchemeDarkBlue).withParams({
  spacing: 3,
  rowHeight: 24,
  headerHeight: 26,
  listItemHeight: 24,
  fontSize: 12,
});

type AgGridCellDataType = ColDef<Row>["cellDataType"];

const arrowFieldToAgGridType = (field: Field): AgGridCellDataType => {
  const { type } = field;

  console.log(field.name, type.toString());

  if (field.name.toLowerCase().includes("postal code")) {
    return "text";
  }

  if (DataType.isBool(type)) return "boolean";
  if (DataType.isUtf8(type)) return "text";
  if (DataType.isFloat(type)) return "number";

  if (DataType.isInt(type)) {
    return "number";
  }

  if (DataType.isDate(type)) return "date";
  if (DataType.isTimestamp(type)) return "dateTime";

  return "object";
};

export default function Data() {
  const [rowData, setRowData] = useState<Row[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef<Row>[]>([]);

  const defaultColDef = useMemo<ColDef<Row>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
      floatingFilter: false,
    }),
    [],
  );

  const autoSizeStrategy = useMemo(
    () => ({
      type: "fitCellContents" as const,
    }),
    [],
  );

  useEffect(() => {
    (async () => {
      const response = await fetch(data);
      const table = await tableFromIPC(response);

      setColumnDefs(
        table.schema.fields.map((field) => ({
          field: field.name,
          headerName: field.name,
          cellDataType: arrowFieldToAgGridType(field),
        })),
      );
      setRowData(
        table.toArray().map((row) => {
          row["Order Date"] = new Date(row["Order Date"]);
          row["Ship Date"] = new Date(row["Ship Date"]);
          return row;
        }),
      );
    })();
  }, []);

  return (
    <AgGridProvider modules={[AllCommunityModule]}>
      <div className="flex-1">
        <AgGridReact<Row>
          theme={tauTheme}
          rowData={rowData}
          rowBuffer={50}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          suppressColumnVirtualisation={true}
          autoSizeStrategy={autoSizeStrategy}
        />
      </div>
    </AgGridProvider>
  );
}
