type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

function normalizeForStableJson(value: unknown): JsonValue {
  if (value === null) {
    return null
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForStableJson(item))
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))

    return entries.reduce<Record<string, JsonValue>>((normalized, [key, entryValue]) => {
      normalized[key] = normalizeForStableJson(entryValue)
      return normalized
    }, {})
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value
  }

  return null
}

export function toStableJsonValue(value: unknown): JsonValue {
  return normalizeForStableJson(value)
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForStableJson(value))
}
