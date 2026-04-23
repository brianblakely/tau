"use client";

import { DataVis } from "@/components/DataVis";
import { useSampleData } from "@/hooks/useSampleData";

export default function Data() {
  const { rowData, columnDefs } = useSampleData();

  return (
    <DataVis
      rowData={rowData}
      columnDefs={columnDefs}
      spec={{
        visType: "table",
        query: {
          groupBy: [],
          metrics: [],
          filters: [],
          sort: [],
        },
        title: "Sample Data",
        warnings: [],
      }}
      columnMeta={{}}
    />
  );
}
