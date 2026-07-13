import { FieldDefinition } from "./fieldDefinition.js";
import { FieldValue } from "./record.js";

export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Validation failed: ${issues.join("; ")}`);
    this.name = "ValidationError";
  }
}

function isCorrectType(value: FieldValue, type: FieldDefinition["type"]): boolean {
  if (type === "date") return value instanceof Date;
  return typeof value === type;
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

    if (!isCorrectType(value, definition.type)) {
      issues.push(`${definition.name} invalid type: expected ${definition.type}, got ${typeof value}`);
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
