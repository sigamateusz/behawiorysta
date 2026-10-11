export function parseDecision(raw: string): "accepted" | "rejected" | null {
  if (raw === "accepted" || raw === "rejected") {
    return raw;
  }
  return null;
}
