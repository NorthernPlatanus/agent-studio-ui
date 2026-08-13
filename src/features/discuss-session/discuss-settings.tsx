/**
 * Session settings, changeable mid-conversation.
 *
 * Every control here maps to an argument the next `plan_or_ask` call actually
 * takes — the loop re-reads its settings at the top of each turn, so a change
 * lands on the next planner call rather than the next session. Nothing on this
 * panel is a preference the server merely stores, which is the rule that keeps a
 * settings screen from filling up with knobs that do nothing.
 *
 * The two that cost real money are labelled as such:
 *
 *  - **effort** is the reasoning budget for the planner role. Higher effort
 *    spends more subscription tokens per call, and subscription tokens are the
 *    binding constraint on this harness — not cash.
 *  - **session reuse** decides whether turn 2+ re-sends the whole payload
 *    (backlog + project map + every current spec, tens of thousands of tokens)
 *    or just the newest human turn against a live provider conversation. It is
 *    off by default because a dropped session silently falls back to the full
 *    payload, which is correct but not free.
 *
 * The defaults are shown next to each control rather than pre-filled, so
 * "unset" stays visibly distinct from "set to the same value the config has" —
 * they behave identically today but read differently, and only one of them
 * follows the config if it changes.
 */

import { useEffect, useState } from "react";
import type { DiscussOptions, DiscussSettings } from "@/entities/discuss";
import { Button } from "@/shared/ui/button";
import { ControlLabel, SelectInput, TextInput } from "@/shared/ui/control";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/panel";

const UNSET = "";

/** `null` and `""` are the same intent from a `<select>`; the API wants `null`. */
function orNull(value: string): string | null {
  return value === UNSET ? null : value;
}

export function DiscussSettingsPanel({
  settings,
  options,
  disabled = false,
  pending = false,
  onApply,
}: {
  settings: DiscussSettings;
  options: DiscussOptions;
  /** A finished session's settings are history — readable, not editable. */
  disabled?: boolean;
  pending?: boolean;
  onApply: (next: DiscussSettings) => void;
}) {
  const [draft, setDraft] = useState<DiscussSettings>(settings);

  // The server is the source of truth: another tab, or the start form, can have
  // set these. Re-sync whenever the session's copy changes underneath.
  useEffect(() => setDraft(settings), [settings]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);
  const set = <K extends keyof DiscussSettings>(key: K, value: DiscussSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <Panel>
      <PanelHeader
        title="Session settings"
        meta="applied to the next planner turn"
        actions={
          dirty ? (
            <Button size="xs" onClick={() => onApply(draft)} disabled={disabled || pending}>
              {pending ? "Applying…" : "Apply"}
            </Button>
          ) : null
        }
      />
      <PanelBody className="space-y-3.5">
        <div className="space-y-1.5">
          <ControlLabel htmlFor="discuss-note">Steer</ControlLabel>
          <TextInput
            id="discuss-note"
            value={draft.note ?? ""}
            disabled={disabled}
            active={(draft.note ?? "") !== ""}
            onChange={(event) => set("note", event.target.value)}
            placeholder="e.g. keep each task under a day of work"
            className="w-full"
          />
          <p className="text-[11px] text-muted-foreground">
            Folded into <em>every</em> turn as the human note — not just the next one.
          </p>
        </div>

        <div className="grid gap-3 @md:grid-cols-2">
          <div className="space-y-1.5">
            <ControlLabel htmlFor="discuss-effort">Reasoning effort</ControlLabel>
            <SelectInput
              id="discuss-effort"
              value={draft.effort ?? UNSET}
              disabled={disabled}
              active={draft.effort != null}
              onChange={(event) =>
                set("effort", orNull(event.target.value) as DiscussSettings["effort"])
              }
              className="w-full"
            >
              <option value={UNSET}>
                config default{options.configured_effort ? ` (${options.configured_effort})` : ""}
              </option>
              {options.efforts.map((effort) => (
                <option key={effort} value={effort}>
                  {effort}
                </option>
              ))}
            </SelectInput>
            <p className="text-[11px] text-muted-foreground">
              Spends more subscription tokens per call — the binding constraint here.
            </p>
          </div>

          <div className="space-y-1.5">
            <ControlLabel htmlFor="discuss-model">Planner model</ControlLabel>
            <SelectInput
              id="discuss-model"
              value={draft.model ?? UNSET}
              disabled={disabled}
              active={draft.model != null}
              onChange={(event) => set("model", orNull(event.target.value))}
              className="w-full"
            >
              <option value={UNSET}>
                config default{options.configured_model ? ` (${options.configured_model})` : ""}
              </option>
              {options.models.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </SelectInput>
            <p className="text-[11px] text-muted-foreground">
              On <span className="font-mono">{options.configured_provider}</span>.
            </p>
          </div>
        </div>

        <div className="grid gap-3 @md:grid-cols-2">
          <div className="space-y-1.5">
            <ControlLabel htmlFor="discuss-reuse">Provider session reuse</ControlLabel>
            <SelectInput
              id="discuss-reuse"
              value={draft.session_reuse === null ? UNSET : String(draft.session_reuse)}
              disabled={disabled}
              active={draft.session_reuse != null}
              onChange={(event) =>
                set(
                  "session_reuse",
                  orNull(event.target.value) === null ? null : event.target.value === "true",
                )
              }
              className="w-full"
            >
              <option value={UNSET}>
                config default ({options.configured_session_reuse ? "on" : "off"})
              </option>
              <option value="true">on — send only the newest turn</option>
              <option value="false">off — resend the full payload each turn</option>
            </SelectInput>
            <p className="text-[11px] text-muted-foreground">
              On is far cheaper per turn; if the provider drops the session the next turn silently
              costs full price again.
            </p>
          </div>

          <div className="space-y-1.5">
            <ControlLabel htmlFor="discuss-rounds">Max clarify rounds</ControlLabel>
            <TextInput
              id="discuss-rounds"
              inputMode="numeric"
              value={draft.max_question_rounds === 0 ? "" : String(draft.max_question_rounds)}
              disabled={disabled}
              active={draft.max_question_rounds > 0}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                set(
                  "max_question_rounds",
                  event.target.value === "" || Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                );
              }}
              placeholder="no limit"
              className="w-full"
            />
            <p className="text-[11px] text-muted-foreground">
              Forces a proposal after this many question rounds. Unanswered questions are reported
              in the transcript, not dropped.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <ControlLabel htmlFor="discuss-scope">Backlog scope</ControlLabel>
          <TextInput
            id="discuss-scope"
            value={(draft.only_ids ?? []).join(", ")}
            disabled={disabled}
            active={(draft.only_ids ?? []).length > 0}
            onChange={(event) => {
              const ids = event.target.value
                .split(/[,\s]+/)
                .map((id) => id.trim())
                .filter((id) => id !== "");
              set("only_ids", ids.length === 0 ? null : ids);
            }}
            placeholder="whole backlog — or T-131, T-140"
            className="w-full"
          />
          <p className="text-[11px] text-muted-foreground">
            Narrows the backlog excerpt the planner is shown. Smaller scope, cheaper turn, less
            context for it to get deps right.
          </p>
        </div>
      </PanelBody>
    </Panel>
  );
}
