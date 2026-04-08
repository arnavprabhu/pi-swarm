/**
 * Shared helpers for agent tool implementations.
 */

/** Create a standard text tool result. */
export function toolResult(t: string) {
  return { content: [{ type: "text" as const, text: t }], details: undefined };
}
