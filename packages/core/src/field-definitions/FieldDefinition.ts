/**
 * Refines a `"number"` field beyond "any JS number". JS has a single
 * floating-point number type, so these are validation constraints, not
 * distinct storage representations:
 * - `"int"` / `"int32"` / `"int64"` require an integer value; `"int32"` also
 *   enforces the 32-bit signed range. `"int64"` can only validate up to
 *   `Number.MAX_SAFE_INTEGER` (2^53 - 1) — JS numbers can't exactly represent
 *   the full 64-bit range, so values beyond that are rejected rather than
 *   silently losing precision.
 * - `"float"` / `"double"` are both plain JS numbers (IEEE 754 double
 *   precision) — no extra runtime constraint is enforced, they're purely
 *   documentation of intent.
 */
export type NumberFormat = "int" | "int32" | "int64" | "float" | "double";

export interface FieldDefinition {
  id: string;
  entityType: string;
  name: string;
  type: "string" | "number" | "boolean" | "date" | "enum";
  required: boolean;
  /** Only meaningful when `type` is `"number"`. */
  format?: NumberFormat;
  /** Only meaningful when `type` is `"enum"` — the allowed values. */
  values?: string[];
}
