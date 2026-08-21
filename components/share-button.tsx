"use client";

import { useEffect, useState } from "react";
import type { Scenario } from "@/lib/waterfall/types";
import { Button } from "./ui/controls";

type State =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "ready"; url: string; copied: boolean }
  | { kind: "error"; message: string };

/**
 * Saves the current scenario and hands back a permalink. Nothing leaves the
 * browser until this is pressed — everything else runs client-side.
 */
export function ShareButton({
  scenario,
  save,
}: {
  scenario: Scenario;
  save: (scenario: Scenario) => Promise<{ ok: boolean; slug?: string; error?: string }>;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  // Any edit invalidates the link that was just generated — it points at a
  // snapshot, not at the live scenario.
  useEffect(() => {
    setState((prev) => (prev.kind === "ready" ? { kind: "idle" } : prev));
  }, [scenario]);

  const onShare = async () => {
    if (state.kind === "ready") {
      await copy(state.url);
      setState({ ...state, copied: true });
      return;
    }

    setState({ kind: "saving" });
    try {
      const result = await save(scenario);
      if (!result.ok || !result.slug) {
        setState({ kind: "error", message: result.error ?? "Could not share." });
        return;
      }
      const url = `${window.location.origin}/s/${result.slug}`;
      const copied = await copy(url);
      setState({ kind: "ready", url, copied });
    } catch {
      setState({ kind: "error", message: "Could not share." });
    }
  };

  const label =
    state.kind === "saving"
      ? "Saving…"
      : state.kind === "ready"
        ? state.copied
          ? "Link copied"
          : "Copy link"
        : state.kind === "error"
          ? "Try again"
          : "Share";

  return (
    <div className="flex items-center gap-2">
      {state.kind === "error" ? (
        <span className="text-[12.5px]" style={{ color: "var(--neg)" }}>
          {state.message}
        </span>
      ) : null}
      <Button
        onClick={onShare}
        disabled={state.kind === "saving"}
        variant={state.kind === "ready" ? "secondary" : "primary"}
        title="Save this scenario and copy a link to it"
      >
        {label}
      </Button>
    </div>
  );
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard permission denied, or an insecure origin. The link is still
    // shown in the address bar of the opened page, so this is not fatal.
    return false;
  }
}
