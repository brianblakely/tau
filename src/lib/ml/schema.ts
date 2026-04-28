import type { SchemaField } from "./types";

export function fieldToDescriptor(field: SchemaField): string {
  const parts = [
    `field: ${field.name}`,
    `type: ${field.kind}`,
    field.sampleValues?.length
      ? `sample values: ${field.sampleValues.join(", ")}`
      : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

export function numericFields(schema: SchemaField[]) {
  return schema.filter((f) => f.kind === "number");
}

export function groupableFields(schema: SchemaField[]) {
  return schema.filter((f) => f.kind === "string" || f.kind === "date");
}
