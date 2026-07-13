import { FieldDefinition } from "../field-definitions/FieldDefinition.js";
import { FieldValue, FlatRecord, StoredRecord } from "../types.js";

const SYSTEM_KEYS = new Set(["id", "entityType"]);

export function toFlatRecord(record: StoredRecord, definitions: FieldDefinition[]): FlatRecord {
  const flat: FlatRecord = {
    id: record.id,
    entityType: record.entityType,
  };

  const defsById = new Map(definitions.map((d) => [d.id, d]));

  for (const [fieldId, value] of record.fields) {
    const def = defsById.get(fieldId);
    if (!def) continue; // TODO: Figure how to handle orphaned definitions

    if (SYSTEM_KEYS.has(def.name)) {
      throw new Error(`Field name "${def.name}" collides with a reserved system key`);
    }
    flat[def.name] = value;
  }

  return flat;
}

export function fromFlatRecord(flat: FlatRecord, definitions: FieldDefinition[]): StoredRecord {
  const fields = new Map<string, FieldValue>();
  const defsByName = new Map(definitions.map((d) => [d.name, d]));

  for (const [key, value] of Object.entries(flat)) {
    if (SYSTEM_KEYS.has(key)) continue;
    const def = defsByName.get(key);
    if (!def) {
      throw new Error(`Unknown field "${key}" — no matching field definition`);
    }
    fields.set(def.id, value as FieldValue);
  }

  return {
    id: flat.id as string,
    entityType: flat.entityType as string,
    fields,
  };
}
