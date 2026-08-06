import { FieldDefinition, NumberFormat } from "../field-definitions/FieldDefinition.js";
import { FieldValue } from "../types.js";

export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Validation failed: ${issues.join("; ")}`);
    this.name = "ValidationError";
  }
}

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

function matchesFormat(value: number, format: NumberFormat): boolean {
  switch (format) {
    case "int":
    case "int64":
      return Number.isSafeInteger(value);
    case "int32":
      return Number.isInteger(value) && value >= INT32_MIN && value <= INT32_MAX;
    case "float":
    case "double":
      return true;
  }
}

function isCorrectType(value: FieldValue, definition: FieldDefinition): boolean {
  const { type } = definition;
  if (type === "date") return value instanceof Date;
  if (type === "enum") return typeof value === "string";
  if (type === "number") {
    return (
      typeof value === "number" && (!definition.format || matchesFormat(value, definition.format))
    );
  }
  return typeof value === type;
}

function describeExpectedType(definition: FieldDefinition): string {
  if (definition.type === "number" && definition.format) return definition.format;
  return definition.type;
}

export function validateFields(fields: Map<string, FieldValue>, definitions: FieldDefinition[]) {
  const issues: string[] = [];

  for (const definition of definitions) {
    const value = fields.get(definition.id);

    if (value === undefined || value === null) {
      if (definition.required) {
        issues.push(`${definition.name} is missing`);
      }
      continue;
    }

    if (!isCorrectType(value, definition)) {
      issues.push(
        `${definition.name} invalid type: expected ${describeExpectedType(definition)}, got ${typeof value}`,
      );
      continue;
    }

    if (definition.type === "enum" && !(definition.values ?? []).includes(value as string)) {
      issues.push(
        `${definition.name} invalid value: expected one of [${(definition.values ?? []).join(", ")}], got "${value}"`,
      );
    }
  }

  const validIds = new Set(definitions.map((d) => d.id));
  for (const fieldId of fields.keys()) {
    if (!validIds.has(fieldId)) {
      issues.push(`Unknown field id "${fieldId}" — no matching active field definition`);
    }
  }

  if (issues.length > 0) {
    throw new ValidationError(issues);
  }
}
