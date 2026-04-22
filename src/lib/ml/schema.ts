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
