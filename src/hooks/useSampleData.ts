import type { ColDef } from "ag-grid-community";
import type { Field } from "apache-arrow";
import { DataType, tableFromIPC } from "apache-arrow";
import { useEffect, useState } from "react";
import type { Row } from "@/lib/datavis/types";
import {
  arrowColumnDescriptors,
  type DatasetColumnDescriptor,
} from "@/lib/ml/descriptors";

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
  const [schemaSpec, setSchemaSpec] = useState<DatasetColumnDescriptor[]>([]);

  useEffect(() => {
    (async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH}/superstore.lz4.arrow`,
      );
      const table = await tableFromIPC(response);

      const descriptors = await arrowColumnDescriptors(table);

      setSchemaSpec(descriptors);
      setColumnDefs(
        descriptors.map((descriptor) => ({
          field: descriptor.name,
          headerName: descriptor.name,
          cellDataType: descriptor.name.toLowerCase().includes("postal code")
            ? "text"
            : descriptor.kind,
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

  return { rowData, columnDefs, schemaSpec };
};
