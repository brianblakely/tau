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
      name: "Sales",
      kind: "number",
      description: "Total sales amount in dollars for the order",
      sampleValues: ["100.0", "250.5", "75.25", "300.0", "50.0"],
    },
    {
      name: "Profit",
      kind: "number",
      description: "Profit amount in dollars for the order",
      sampleValues: ["20.0", "50.5", "10.25", "80.0", "5.0"],
    },
    {
      name: "Quantity",
      kind: "number",
      description: "Number of items in the order",
      sampleValues: ["1", "2", "3", "4", "5"],
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
  ],
};
