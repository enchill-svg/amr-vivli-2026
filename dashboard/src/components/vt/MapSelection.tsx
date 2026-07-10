import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type SelectedAlert = {
  id: string;
  country: string;
  pathogen: string;
  title: string;
  severity: string;
  detected_at: string;
  description?: string | null;
};

type Ctx = {
  selected: SelectedAlert[];
  toggle: (a: SelectedAlert) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
};

const MapSelectionCtx = createContext<Ctx | null>(null);

export function MapSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<SelectedAlert[]>([]);
  const toggle = useCallback((a: SelectedAlert) => {
    setSelected((prev) =>
      prev.find((s) => s.id === a.id) ? prev.filter((s) => s.id !== a.id) : [...prev, a],
    );
  }, []);
  const clear = useCallback(() => setSelected([]), []);
  const isSelected = useCallback((id: string) => selected.some((s) => s.id === id), [selected]);
  const value = useMemo(() => ({ selected, toggle, clear, isSelected }), [selected, toggle, clear, isSelected]);
  return <MapSelectionCtx.Provider value={value}>{children}</MapSelectionCtx.Provider>;
}

export function useMapSelection() {
  const ctx = useContext(MapSelectionCtx);
  if (!ctx) throw new Error("useMapSelection must be used inside MapSelectionProvider");
  return ctx;
}

// Persist current phylogeny tree string + parsed stats so /reports can include it.
export type PhyloSnapshot = {
  newick: string;
  leaf_count: number;
  max_depth: number;
  clusters: { id: number; size: number; lineage: string }[];
  svg?: string;
};

const PHYLO_KEY = "vt:phylo-snapshot";

export function savePhyloSnapshot(s: PhyloSnapshot) {
  try {
    sessionStorage.setItem(PHYLO_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadPhyloSnapshot(): PhyloSnapshot | null {
  try {
    const raw = sessionStorage.getItem(PHYLO_KEY);
    return raw ? (JSON.parse(raw) as PhyloSnapshot) : null;
  } catch {
    return null;
  }
}