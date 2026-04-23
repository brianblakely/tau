import type { ColumnMeta } from "@/components/DataVis";
import type { SchemaContext, SchemaField } from "./types";

export function fieldToDescriptor(field: SchemaField): string {
  const parts = [
    `field: ${field.name}`,
    `type: ${field.kind}`,
    field.description ? `description: ${field.description}` : "",
    field.sampleValues?.length
      ? `sample values: ${field.sampleValues.slice(0, 8).join(", ")}`
      : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

export function numericFields(schema: SchemaContext) {
  return schema.fields.filter((f) => f.kind === "number");
}

export function groupableFields(schema: SchemaContext) {
  return schema.fields.filter((f) => f.kind === "string" || f.kind === "date");
}

export const sampleDataSchemaSpec: SchemaContext = {
  datasetName: "Big box retail store orders/sales",
  fields: [
    {
      name: "Row ID",
      kind: "number",
      description: "Unique identifier for each row in the dataset",
      sampleValues: ["1", "2", "3", "4", "5"],
    },
    {
      name: "Order ID",
      kind: "string",
      description: "Unique identifier for each order",
      sampleValues: [
        "CA-2016-152156",
        "CA-2016-152156",
        "CA-2016-138688",
        "US-2015-108966",
        "US-2015-108966",
      ],
    },
    {
      name: "Order Date",
      kind: "date",
      description: "Date when the order was placed",
      sampleValues: [
        "2023-01-15",
        "2023-02-20",
        "2023-03-10",
        "2023-04-05",
        "2023-05-25",
      ],
    },
    {
      name: "Ship Date",
      kind: "date",
      description: "Date when the order was shipped",
      sampleValues: [
        "2023-01-20",
        "2023-02-25",
        "2023-03-15",
        "2023-04-10",
        "2023-05-30",
      ],
    },
    {
      name: "Ship Mode",
      kind: "string",
      description: "Mode of shipping for the order",
      sampleValues: ["Standard Class", "First Class", "Second Class"],
    },
    {
      name: "Customer ID",
      kind: "string",
      description: "Unique identifier for each customer",
      sampleValues: [
        "CG-12520",
        "DV-13045",
        "SO-20335",
        "BH-11710",
        "AA-10480",
      ],
    },
    {
      name: "Customer Name",
      kind: "string",
      description: "Name of the customer who placed the order",
      sampleValues: [
        "Claire Gute",
        "Darrin Van Huff",
        "Sean O'Donnell",
        "Brosina Hoffman",
        "Andrew Allen",
      ],
    },
    {
      name: "Segment",
      kind: "string",
      description: "Customer segment for the order",
      sampleValues: ["Consumer", "Corporate", "Home Office"],
    },
    {
      name: "Country",
      kind: "string",
      description: "Country where the order is to be delivered",
      sampleValues: ["United States"],
    },
    {
      name: "City",
      kind: "string",
      description: "City where the order is to be delivered",
      sampleValues: [
        "Henderson",
        "Los Angeles",
        "San Francisco",
        "Chicago",
        "Houston",
      ],
    },
    {
      name: "State",
      kind: "string",
      description: "US state where the order is to be delivered",
      sampleValues: [
        "California",
        "Texas",
        "Florida",
        "New York",
        "Illinois",
        "New Jersey",
      ],
    },
    {
      name: "Postal Code",
      kind: "string",
      description: "Postal code for the delivery address",
      sampleValues: ["10001", "90001", "94101", "60601", "77001"],
    },
    {
      name: "Region",
      kind: "string",
      description: "Region where the order is to be delivered",
      sampleValues: ["East", "West", "Central", "South"],
    },
    {
      name: "Category",
      kind: "string",
      description: "Product category",
      sampleValues: ["Furniture", "Office Supplies", "Technology"],
    },
    {
      name: "Sub-Category",
      kind: "string",
      description: "Product sub-category",
      sampleValues: [
        "Bookcases",
        "Chairs",
        "Phones",
        "Storage",
        "Tables",
        "Binders",
      ],
    },
    {
      name: "Product Name",
      kind: "string",
      description: "Name of the product ordered",
      sampleValues: [
        "Bush Somerset Collection Bookcase",
        "Hon Deluxe Fabric Upholstered Stacking Chairs, Rounded Back",
        "Apple iPhone 6s Plus",
        "Lorell Executive Office Chair, Leather",
        "Steelcase Gesture Chair",
      ],
    },
    {
      name: "Sales",
      kind: "number",
      description: "Total sales amount in dollars for the order",
      sampleValues: ["100.0", "250.5", "75.25", "300.0", "50.0"],
    },
    {
      name: "Quantity",
      kind: "number",
      description: "Number of items in the order",
      sampleValues: ["1", "2", "3", "4", "5"],
    },
    {
      name: "Discount",
      kind: "number",
      description:
        "Discount applied to the order (as a decimal, e.g. 0.2 for 20%)",
      sampleValues: ["0.0", "0.1", "0.2", "0.3", "0.4"],
    },
    {
      name: "Profit",
      kind: "number",
      description: "Profit amount in dollars for the order",
      sampleValues: ["20.0", "50.5", "10.25", "80.0", "5.0"],
    },
  ],
};

export const columnMeta: ColumnMeta = sampleDataSchemaSpec.fields.reduce(
  (acc, field) => {
    acc[field.name] = { kind: field.kind === "string" ? "text" : "number" };
    return acc;
  },
  {} as ColumnMeta,
);
