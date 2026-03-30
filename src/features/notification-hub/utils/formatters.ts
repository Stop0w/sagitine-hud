// src/features/notification-hub/utils/formatters.ts

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function formatConfidence(value: number): string {
  return Math.round(value * 100).toString();
}

export function getUrgencyColor(urgency: "low" | "medium" | "high"): string {
  switch (urgency) {
    case "high": return "bg-tertiary";
    case "medium": return "bg-secondary";
    case "low": return "bg-outline-variant";
    default: return "bg-outline-variant";
  }
}