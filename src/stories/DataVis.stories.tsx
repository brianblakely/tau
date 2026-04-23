import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DataVis, type DataVisProps } from "@/components/DataVis";

const meta = {
  title: "DataVis",
  component: DataVis,
  decorators: [
    (Story) => (
      <div className="flex flex-col h-screen w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DataVis>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleSpec: DataVisProps = {
  rowData: [
    { name: "John", age: 30, salary: 50000 },
    { name: "Jane", age: 25, salary: 60000 },
  ],
  columnDefs: [{ field: "name" }, { field: "age" }, { field: "salary" }],
  spec: {
    visType: "table",
    query: {
      groupBy: ["name"],
      metrics: [
        {
          field: "salary",
          aggregation: "sum",
        },
      ],
      filters: [],
      sort: [],
    },
    title: "Employee Data",
    warnings: ["This is a warning message."],
  },
  columnMeta: {
    name: { kind: "text" },
    age: { kind: "number" },
    salary: { kind: "number" },
  },
};

export const Grid: Story = {
  args: sampleSpec,
};

export const Pie: Story = {
  args: {
    ...sampleSpec,
    spec: {
      ...sampleSpec.spec,
      visType: "pie",
    },
  },
};
