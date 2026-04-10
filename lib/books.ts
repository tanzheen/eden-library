/**
 * Parses "SELECTED_IDS: [1, 2, 3]" from the end of the LLM response.
 * Returns an array of book IDs that the LLM recommended.
 */
export function parseSelectedIds(content: string): number[] {
  const match = content.match(/SELECTED_IDS:\s*\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id));
}

/**
 * Strips the SELECTED_IDS line from displayed message text.
 * This removes the machine-readable tag so users see clean responses.
 */
export function stripSelectedIds(content: string): string {
  return content.replace(/\n?SELECTED_IDS:\s*\[[^\]]*\]/, "").trim();
}
