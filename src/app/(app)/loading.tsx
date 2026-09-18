import { Plate } from "@/components/aura/primitives";

export default function AppLoading() {
  return (
    <div className="mx-auto max-w-xl space-y-5" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-3 w-56 animate-pulse rounded bg-muted" />
      </div>
      <Plate className="p-5">
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-8 w-28 animate-pulse rounded bg-muted" />
      </Plate>
      {[0, 1, 2].map((i) => (
        <Plate key={i} className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </Plate>
      ))}
    </div>
  );
}
