"use client";

import { useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundMuted, playHapticPop, setSoundMuted, subscribeSoundMuted } from "@/lib/utils/sound";
import { IconButton, Switch } from "./primitives";

/**
 * Mute is external state (localStorage), so it is read through `useSyncExternalStore`
 * rather than mirrored into component state — no effect, no hydration flash, and every
 * toggle instance stays in sync.
 */
function useMuted(): boolean {
  return useSyncExternalStore(subscribeSoundMuted, isSoundMuted, () => false);
}

/** Ledger row for the Me / profile surface. */
export function SoundToggleRow({ className }: { className?: string }) {
  const muted = useMuted();

  function toggle(next: boolean) {
    setSoundMuted(next);
    if (!next) playHapticPop(); // preview when re-enabling
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary/40 text-muted-foreground">
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Sound effects</p>
            <p className="text-[11px] text-muted-foreground">
              {muted ? "Muted — taps and reveals stay silent." : "Struck-brass pings on presses and reveals."}
            </p>
          </div>
        </div>
        <Switch checked={!muted} onCheckedChange={(on) => toggle(!on)} label="Sound effects" />
      </div>
    </div>
  );
}

/** Compact icon control for tight headers. */
export function SoundToggleIcon() {
  const muted = useMuted();
  return (
    <IconButton
      label={muted ? "Unmute sound effects" : "Mute sound effects"}
      aria-pressed={muted}
      onClick={() => {
        setSoundMuted(!muted);
        if (muted) playHapticPop();
      }}
    >
      {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
    </IconButton>
  );
}
