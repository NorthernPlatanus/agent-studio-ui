/**
 * Display formatters.
 *
 * The load-bearing rule lives here: several API fields are `number | null` where
 * `null` means "not reported" and is a different answer from a measured `0`
 * (`cache_hit_rate`, `*_per_completed_task` — see `devdocs/CONTRACT.md` §3).
 * Every one of those goes through a formatter that returns `DASH` for `null`,
 * so no screen can accidentally render `0%` for "unknown".
 */

export const DASH = "—";

/** `null`/`undefined`/`NaN` -> `—`. Everything else through `format`. */
export function orDash<T>(value: T | null | undefined, format: (value: T) => string): string {
  if (value === null || value === undefined) return DASH;
  if (typeof value === "number" && !Number.isFinite(value)) return DASH;
  return format(value);
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

/** Token counts, abbreviated: 402000 -> "402k", 1_240_000 -> "1.24M". */
export function formatTokens(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trimZeros((value / 1_000_000).toFixed(2))}M`;
  if (abs >= 1_000) return `${trimZeros((value / 1_000).toFixed(abs >= 10_000 ? 0 : 1))}k`;
  return formatInteger(value);
}

function trimZeros(text: string): string {
  return text.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** USD. Sub-cent spend is real here, so small values keep 4 decimals. */
export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 0.01 ? 4 : 2;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** A 0..1 ratio as a percentage. `null` -> `—`, never `0%`. */
export function formatRate(value: number | null | undefined): string {
  return orDash(value, (rate) => `${(rate * 100).toFixed(1)}%`);
}

/** Cash cost, or `—` when unreported. */
export function formatUsdOrDash(value: number | null | undefined): string {
  return orDash(value, formatUsd);
}

/** Token figure, or `—` when unreported (e.g. no completed tasks to divide by). */
export function formatTokensOrDash(value: number | null | undefined): string {
  return orDash(value, formatTokens);
}

/** Unix seconds -> local date+time. */
export function formatTimestamp(seconds: number | null | undefined): string {
  return orDash(seconds, (value) =>
    new Date(value * 1000).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
}

/** Unix seconds -> local time only, for dense event rows. */
export function formatClock(seconds: number | null | undefined): string {
  return orDash(seconds, (value) =>
    new Date(value * 1000).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  );
}

/** A span in seconds as `1d 4h`, `2h 05m`, `4m 12s`, `31s`. */
export function formatDuration(seconds: number | null | undefined): string {
  return orDash(seconds, (value) => {
    const total = Math.max(0, Math.floor(value));
    const days = Math.floor(total / 86_400);
    const hours = Math.floor((total % 86_400) / 3_600);
    const minutes = Math.floor((total % 3_600) / 60);
    const secs = total % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${pad(minutes)}m`;
    if (minutes > 0) return `${minutes}m ${pad(secs)}s`;
    return `${secs}s`;
  });
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

/**
 * Elapsed wall time since `startedAt` (unix seconds). `now` is injectable so
 * tests are not clock-dependent.
 */
export function formatElapsed(
  startedAt: number | null | undefined,
  now: number = Date.now() / 1000,
): string {
  return orDash(startedAt, (value) => formatDuration(now - value));
}

/** `needs_plan` -> `Needs plan`; used for statuses, event kinds and domains. */
export function humanize(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  if (spaced === "") return DASH;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `true` -> "Yes", `false` -> "No", `null` -> `—`. */
export function formatBool(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  return value ? "Yes" : "No";
}

/** A possibly-empty string field: blank and whitespace both read as unreported. */
export function textOrDash(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === "") return DASH;
  return value;
}
