import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(input?: string | number | Date | null) {
  if (!input) return "Not available";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(input));
}

/** Compact relative time ("just now", "4h ago", "2d ago") for freshness labels. */
export function formatTimeAgo(input?: string | number | Date | null) {
  if (!input) return "unknown";
  const then = new Date(input).getTime();
  if (Number.isNaN(then)) return "unknown";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function normalizeList(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function toTitleCase(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

export function makeId(prefix = "move") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function withoutEmDash(value: string) {
  return value.replace(/\s*—\s*/g, ", ");
}

/**
 * Recursively replace em dashes in every string of a generated payload.
 * The proposal guide bans em dashes in all generated text, so this runs on
 * every LLM and fallback output before it reaches the UI.
 */
export function scrubEmDashes<T>(value: T): T {
  if (typeof value === "string") return withoutEmDash(value) as T;
  if (Array.isArray(value)) return value.map((item) => scrubEmDashes(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, scrubEmDashes(item)]),
    ) as T;
  }
  return value;
}
