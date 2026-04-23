import type { ColDef } from "ag-grid-community";
import type { Field } from "apache-arrow";
import { DataType, tableFromIPC } from "apache-arrow";
import { useEffect, useState } from "react";
import type { Row } from "@/lib/datavis/types";

type AgGridCellDataType = ColDef<Row>["cellDataType"];

const arrowFieldToAgGridType = (field: Field): AgGridCellDataType => {
  const { type } = field;

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

  return "text";
};

export const useSampleData = () => {
  const [rowData, setRowData] = useState<Row[]>([]);
  const [columnDefs, setColumnDefs] = useState<ColDef<Row>[]>([]);

  useEffect(() => {
    (async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH}/superstore.lz4.arrow`,
      );
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

  return { rowData, columnDefs };
};
