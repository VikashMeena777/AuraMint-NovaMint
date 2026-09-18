/**
 * Custom events used by the app shell to talk to the (app) layout's singletons.
 *
 * `open-submit-modal` is owned by `src/components/aura/submit-event-modal.tsx`,
 * which listens for it and is mounted once in `src/app/(app)/layout.tsx`; the
 * string is duplicated here deliberately (not imported) so the shell keeps
 * working if that module is refactored — it is a broadcast contract, not a dep.
 *
 * `auramint:open-palette` is owned by this folder: the sidebar and the mobile
 * sheet ask the mounted CommandPalette to open, so the palette is reachable by
 * tap and not only by ⌘/Ctrl-K.
 */
export const OPEN_LOG_EVENT = "open-submit-modal";
export const OPEN_PALETTE_EVENT = "auramint:open-palette";
