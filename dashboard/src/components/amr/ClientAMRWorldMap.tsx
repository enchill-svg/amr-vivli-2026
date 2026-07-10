import { useEffect, useState, type ComponentType } from "react";

type Props = { compact?: boolean };
type MapComponent = ComponentType<Props>;

export function ClientAMRWorldMap(props: Props) {
  const [Component, setComponent] = useState<MapComponent | null>(null);

  useEffect(() => {
    let alive = true;
    import("./LiveAMRWorldMap").then((mod) => {
      if (alive) setComponent(() => mod.LiveAMRWorldMap);
    });
    return () => { alive = false; };
  }, []);

  if (!Component) {
    return (
      <div className="grid h-full min-h-[420px] place-items-center rounded-2xl vt-glass">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-full border border-[color:var(--accent)]/50 bg-[color:var(--accent)]/15" />
          <div className="mt-3 text-sm text-muted-foreground">Loading AMR map engine…</div>
        </div>
      </div>
    );
  }

  return <Component {...props} />;
}
