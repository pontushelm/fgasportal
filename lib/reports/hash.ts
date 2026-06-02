import { createHash } from "crypto"

export function hashString(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export function hashBuffer(value: Buffer | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}
