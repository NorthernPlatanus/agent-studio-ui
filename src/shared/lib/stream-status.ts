/**
 * How the live stream's connection state is described, in one place.
 *
 * The top bar and the settings screen both render it, and they had grown
 * separate copies of the same two lookup tables — which is how "Stream down" in
 * one place becomes "error" in the other.
 */

import type { StreamStatus } from "@/shared/store/ui-store";

export type StreamTone = "neutral" | "good" | "warn" | "bad";

const DESCRIPTION: Record<StreamStatus, { tone: StreamTone; label: string }> = {
  open: { tone: "good", label: "Live" },
  connecting: { tone: "warn", label: "Connecting" },
  error: { tone: "bad", label: "Stream down" },
  closed: { tone: "neutral", label: "Offline" },
  idle: { tone: "neutral", label: "Offline" },
};

export function describeStream(status: StreamStatus): { tone: StreamTone; label: string } {
  return DESCRIPTION[status] ?? { tone: "neutral", label: status };
}
