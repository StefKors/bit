import { createHash } from "crypto"

/**
 * Generate a deterministic UUID v5-like ID from a composite key.
 * Uses SHA-1 truncated to 128 bits and formatted as a UUID,
 * with version/variant bits set per RFC 4122.
 */
export function deterministicId(...parts: string[]): string {
  const key = parts.join(":")
  const hash = createHash("sha1").update(key).digest()

  // Set version 5 (bits 4-7 of byte 6)
  hash[6] = (hash[6] & 0x0f) | 0x50
  // Set variant (bits 6-7 of byte 8)
  hash[8] = (hash[8] & 0x3f) | 0x80

  const hex = hash.toString("hex").slice(0, 32)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-")
}
