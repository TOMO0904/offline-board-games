export function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return crypto.randomUUID()
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  }
  // Identifies a local friendly match; it is never an authentication secret.
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
