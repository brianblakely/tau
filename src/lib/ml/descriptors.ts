import { DataType, type Table, type Vector } from "apache-arrow";

export type DatasetColumnKind = "number" | "string" | "date";

export type DatasetColumnDescriptor = {
  name: string;
  kind: DatasetColumnKind;
  sampleValues: string[];
};

export const arrowColumnDescriptors = async (
  table: Table,
): Promise<DatasetColumnDescriptor[]> =>
  table.schema.fields.flatMap((field, columnIndex) => {
    const vector = table.getChildAt(columnIndex);

    if (!vector) {
      return [];
    }

    const kind = arrowTypeToColumnKind(field.type, vector);

    if (!kind) {
      return [];
    }

    const sampleValues =
      kind === "string"
        ? collectEveryUniqueValue(vector, (value) =>
            formatArrowValue(value, kind, field.type),
          )
        : collectRandomUniqueValues(vector, 5, (value) =>
            formatArrowValue(value, kind, field.type),
          );

    return [
      {
        name: field.name,
        kind,
        sampleValues,
      },
    ];
  });

function arrowTypeToColumnKind(
  type: DataType,
  vector: Vector<DataType>,
): DatasetColumnKind | null {
  const DataTypeCompat = DataType as typeof DataType & {
    isLargeUtf8?: (x: unknown) => boolean;
  };

  if (
    DataType.isInt(type) ||
    DataType.isFloat(type) ||
    DataType.isDecimal(type)
  ) {
    return "number";
  }

  if (DataType.isDate(type) || DataType.isTimestamp(type)) {
    return "date";
  }

  if (
    DataType.isUtf8(type) ||
    DataTypeCompat.isLargeUtf8?.(type) ||
    looksLikeDictionaryEncodedString(type)
  ) {
    return "string";
  }

  // Runtime fallback for dictionary-encoded values or odd Arrow producer output.
  const firstValue = firstNonNullValue(vector);

  if (typeof firstValue === "number" || typeof firstValue === "bigint") {
    return "number";
  }

  if (typeof firstValue === "string") {
    return "string";
  }

  if (firstValue instanceof Date) {
    return "date";
  }

  return null;
}

function looksLikeDictionaryEncodedString(type: DataType): boolean {
  if (!DataType.isDictionary(type)) {
    return false;
  }

  const typeText = String(type).toLowerCase();

  return (
    typeText.includes("utf8") ||
    typeText.includes("largeutf8") ||
    typeText.includes("string")
  );
}

function collectEveryUniqueValue(
  vector: Vector<DataType>,
  format: (value: unknown) => string | null,
): string[] {
  const unique = new Set<string>();

  for (let i = 0; i < vector.length; i += 1) {
    const value = format(vector.get(i));

    if (value !== null) {
      unique.add(value);
    }
  }

  return [...unique];
}

function collectRandomUniqueValues(
  vector: Vector<DataType>,
  count: number,
  format: (value: unknown) => string | null,
): string[] {
  const unique = collectEveryUniqueValue(vector, format);

  return shuffle(unique).slice(0, count);
}

function shuffle<T>(values: T[]): T[] {
  const copy = [...values];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}

function firstNonNullValue(vector: Vector<DataType>): unknown {
  for (let i = 0; i < vector.length; i += 1) {
    const value = vector.get(i);

    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
}

function formatArrowValue(
  value: unknown,
  kind: DatasetColumnKind,
  type: DataType,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (kind === "date") {
    return formatArrowDateValue(value, type);
  }

  if (kind === "number") {
    return formatArrowNumberValue(value);
  }

  return String(value);
}

function formatArrowNumberValue(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  return String(value);
}

function formatArrowDateValue(value: unknown, type: DataType): string | null {
  const date = arrowValueToDate(value, type);

  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }

  // Arrow Date32/Date64 are date-like fields; timestamps keep time.
  if (DataType.isDate(type)) {
    return date.toISOString().slice(0, 10);
  }

  return date.toISOString();
}

function arrowValueToDate(value: unknown, type: DataType): Date | null {
  if (value instanceof Date) {
    return value;
  }

  const numericValue = int64LikeToNumber(value);

  if (numericValue === null) {
    return null;
  }

  if (DataType.isDate(type)) {
    const unit = getArrowUnit(type);

    // Arrow Date32 is days since epoch. Date64 is milliseconds since epoch.
    const milliseconds =
      unit === 0 || unit === "DAY" || unit === "day"
        ? numericValue * 86_400_000
        : numericValue;

    return new Date(milliseconds);
  }

  if (DataType.isTimestamp(type)) {
    const unit = getArrowUnit(type);

    const milliseconds =
      unit === 0 || unit === "SECOND" || unit === "second"
        ? numericValue * 1_000
        : unit === 2 || unit === "MICROSECOND" || unit === "microsecond"
          ? numericValue / 1_000
          : unit === 3 || unit === "NANOSECOND" || unit === "nanosecond"
            ? numericValue / 1_000_000
            : numericValue;

    return new Date(milliseconds);
  }

  return null;
}

function getArrowUnit(type: DataType): unknown {
  return (type as DataType & { unit?: unknown }).unit;
}

function int64LikeToNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  // Some Arrow 64-bit values may appear as [low, high].
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    const low = BigInt(value[0] >>> 0);
    const high = BigInt(value[1]);

    return Number((high << 32n) + low);
  }

  return null;
}
