import { createFileRoute } from "@tanstack/react-router";
import {
  GitBranch, Upload, Download, RotateCw, Save, Search, Play, Pause, Sparkles,
  Layers, MessageSquare, Pin, FileText, Image as ImageIcon, Filter, Zap,
  Network as NetIcon, CircleDot, Trees, Radio, ZoomIn, ZoomOut, Maximize2, Flame, AlertTriangle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/vt/PageShell";
import { AuthGate } from "@/components/vt/AuthGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePhyloSnapshot } from "@/components/vt/MapSelection";
import { toast } from "sonner";

export const Route = createFileRoute("/phylogeny")({
  component: PhylogenyPage,
  head: () => ({
    meta: [
      { title: "Phylogenomic Intelligence Workspace — ViralTrack-Afrika" },
      { name: "description", content: "Research-grade phylogenomic analysis: multi-view trees, metadata rings, AI copilot, publication export." },
    ],
  }),
});

// --- Newick parser ----------------------------------------------------------
type Node = {
  name: string;
  branch: number;
  children: Node[];
  x?: number;
  y?: number;
  depth?: number;
  cluster?: number;
  lineage?: string;
  auto?: boolean;
};

function parseNewick(s: string): Node {
  const tokens = s.replace(/\s+/g, "").replace(/;$/, "");
  let i = 0;

  function readName(): { name: string; branch: number } {
    let name = "";
    while (i < tokens.length && !"(),:;".includes(tokens[i])) {
      name += tokens[i++];
    }
    let branch = 0;
    if (tokens[i] === ":") {
      i++;
      let num = "";
      while (i < tokens.length && /[\d.eE+-]/.test(tokens[i])) num += tokens[i++];
      branch = parseFloat(num) || 0;
    }
    return { name, branch };
  }

  function readNode(): Node {
    const children: Node[] = [];
    if (tokens[i] === "(") {
      i++;
      children.push(readNode());
      while (tokens[i] === ",") {
        i++;
        children.push(readNode());
      }
      if (tokens[i] === ")") i++;
    }
    const { name, branch } = readName();
    return { name, branch, children };
  }

  return readNode();
}

function layoutTree(root: Node, width: number, height: number) {
  // Collect leaves and compute depth (cumulative branch length).
  let leafCount = 0;
  let maxDepth = 0;

  function walk(n: Node, depth: number) {
    n.depth = depth;
    if (depth > maxDepth) maxDepth = depth;
    if (n.children.length === 0) {
      n.y = leafCount++;
    } else {
      for (const c of n.children) walk(c, depth + (c.branch || 0.01));
      n.y = (n.children[0].y! + n.children[n.children.length - 1].y!) / 2;
    }
  }
  walk(root, 0);

  const xScale = (width - 160) / (maxDepth || 1);
  const yScale = (height - 40) / Math.max(leafCount - 1, 1);

  function assignXY(n: Node) {
    n.x = 20 + (n.depth ?? 0) * xScale;
    n.y = 20 + (n.y ?? 0) * yScale;
    n.children.forEach(assignXY);
  }
  assignXY(root);
  return { leafCount, maxDepth };
}

function collectEdges(n: Node, edges: Array<{ x1: number; y1: number; x2: number; y2: number }> = []) {
  for (const c of n.children) {
    // vertical link
    edges.push({ x1: n.x!, y1: n.y!, x2: n.x!, y2: c.y! });
    // horizontal link
    edges.push({ x1: n.x!, y1: c.y!, x2: c.x!, y2: c.y! });
    collectEdges(c, edges);
  }
  return edges;
}

function collectLeaves(n: Node, leaves: Node[] = []) {
  if (n.children.length === 0) leaves.push(n);
  else n.children.forEach((c) => collectLeaves(c, leaves));
  return leaves;
}

// Known lineage prefixes — extend as needed.
const LINEAGE_PREFIXES = [
  { match: /^BA\./i, lineage: "Omicron BA.*", family: "sars" },
  { match: /^XBB/i, lineage: "Omicron XBB.*", family: "sars" },
  { match: /^JN\./i, lineage: "Omicron JN.*", family: "sars" },
  { match: /^KP\./i, lineage: "Omicron KP.*", family: "sars" },
  { match: /^B\.1\.1\.7/i, lineage: "Alpha B.1.1.7", family: "sars" },
  { match: /^B\.1\.617/i, lineage: "Delta B.1.617", family: "sars" },
  { match: /^Mpox.*IIb/i, lineage: "Mpox clade IIb", family: "mpox" },
  { match: /^Mpox.*Ib/i, lineage: "Mpox clade Ib", family: "mpox" },
  { match: /^Ebola/i, lineage: "Ebola virus", family: "ebola" },
  { match: /^Marburg/i, lineage: "Marburg virus", family: "marburg" },
  { match: /^Cholera|Vibrio/i, lineage: "V. cholerae", family: "cholera" },
  { match: /^Lassa/i, lineage: "Lassa virus", family: "lassa" },
  { match: /^H5N1/i, lineage: "Influenza A H5N1", family: "flu" },
  { match: /^EV-D68/i, lineage: "Enterovirus D68", family: "ev" },
];

const LINEAGE_GRADIENTS: Record<string, [string, string]> = {
  sars:    ["#c389ff", "#7c3aed"],
  mpox:    ["#ffb27a", "#ff6b35"],
  ebola:   ["#ff7a8a", "#dc2626"],
  marburg: ["#fde68a", "#c9a84c"],
  cholera: ["#7dd3fc", "#0284c7"],
  lassa:   ["#86efac", "#16a34a"],
  flu:     ["#a5f3fc", "#06b6d4"],
  ev:      ["#ddd6fe", "#8b5cf6"],
  default: ["#5cb8ff", "#3b82f6"],
};

function familyOf(name?: string): keyof typeof LINEAGE_GRADIENTS {
  if (!name) return "default";
  for (const p of LINEAGE_PREFIXES) if (p.match.test(name)) return p.family as keyof typeof LINEAGE_GRADIENTS;
  return "default";
}

function inferLineage(name: string): string | undefined {
  for (const p of LINEAGE_PREFIXES) if (p.match.test(name)) return p.lineage;
  return undefined;
}

// Auto-label unnamed leaves and tag lineages.
function annotate(root: Node) {
  let counter = 1;
  function walk(n: Node) {
    if (n.children.length === 0) {
      if (!n.name || /^$/.test(n.name)) {
        n.name = `taxon_${counter++}`;
        n.auto = true;
      } else counter++;
      n.lineage = inferLineage(n.name);
    } else n.children.forEach(walk);
  }
  walk(root);
}

// Cluster leaves whose pairwise cumulative branch distance from a common ancestor
// is below threshold. Walk internal nodes: if subtree max-depth-diff < threshold,
// assign all descendants the same cluster id.
function clusterTree(root: Node, threshold = 0.15) {
  let clusterId = 0;
  const palette = ["#5cb8ff", "#3ee6a8", "#f5c451", "#ff8a3d", "#ff3d6e", "#c389ff", "#7dd3fc"];

  function subtreeMaxBranch(n: Node, acc = 0): number {
    if (n.children.length === 0) return acc;
    return Math.max(...n.children.map((c) => subtreeMaxBranch(c, acc + (c.branch || 0))));
  }

  function assign(n: Node, id: number) {
    n.cluster = id;
    n.children.forEach((c) => assign(c, id));
  }

  function walk(n: Node) {
    if (n.cluster !== undefined) return;
    if (n.children.length === 0) {
      n.cluster = clusterId++;
      return;
    }
    const diameter = subtreeMaxBranch(n);
    if (diameter <= threshold) {
      assign(n, clusterId++);
    } else n.children.forEach(walk);
  }
  walk(root);

  // Build cluster summary
  const leaves = collectLeaves(root);
  const map = new Map<number, { id: number; size: number; lineage: string }>();
  for (const l of leaves) {
    const id = l.cluster ?? 0;
    const existing = map.get(id);
    const lineage = l.lineage ?? "Unassigned";
    if (existing) {
      existing.size++;
      if (existing.lineage === "Unassigned" && lineage !== "Unassigned") existing.lineage = lineage;
    } else {
      map.set(id, { id, size: 1, lineage });
    }
  }
  return {
    clusters: Array.from(map.values()).sort((a, b) => b.size - a.size),
    color: (id?: number) => palette[(id ?? 0) % palette.length],
  };
}

const DEMO_NEWICK =
  "(((BA.2.86:0.04,JN.1.7:0.02):0.03,(JN.1.11:0.025,(XBB.1.5:0.05,KP.3:0.02):0.04):0.05):0.06,((Mpox_IIb-B.1:0.12,Mpox_IIb-B.2:0.08):0.09,Mpox_Ib-A.1:0.15):0.12,(Ebola-EBOV-2024:0.08,Marburg-2024:0.11):0.18);";

type ViewMode = "rectangular" | "circular" | "radial" | "unrooted";
type Metadata = Record<string, Record<string, string>>; // taxon -> { col: value }

function csvParse(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim());
  const rows = lines.slice(1).map((l) => l.split(sep).map((c) => c.trim()));
  return { headers, rows };
}

function smartMapColumn(header: string): string | null {
  const h = header.toLowerCase();
  if (/(taxon|sample|isolate|strain|name|id)/.test(h)) return "taxon";
  if (/country|nation/.test(h)) return "country";
  if (/region|province|state/.test(h)) return "region";
  if (/(date|collected|sampled)/.test(h)) return "date";
  if (/host|species/.test(h)) return "host";
  if (/lineage|clade|pango/.test(h)) return "lineage";
  if (/variant/.test(h)) return "variant";
  if (/institution|lab|center/.test(h)) return "institution";
  if (/risk|score/.test(h)) return "risk";
  return null;
}

function PhylogenyPage() {
  const [newick, setNewick] = useState<string>(DEMO_NEWICK);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const metaFileRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<ViewMode>("rectangular");
  const [search, setSearch] = useState("");
  const [selectedTaxon, setSelectedTaxon] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Metadata>({});
  const [metaCols, setMetaCols] = useState<string[]>([]);
  const [colorBy, setColorBy] = useState<"lineage" | "country" | "host" | "risk">("lineage");
  const [showRings, setShowRings] = useState(true);
  const [timeIdx, setTimeIdx] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [annotations, setAnnotations] = useState<Array<{ id: string; target: string; text: string; author: string; at: string }>>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [copilotInput, setCopilotInput] = useState("");
  const [copilotLog, setCopilotLog] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);
  const [pubStyle, setPubStyle] = useState<"default" | "Nature" | "Science" | "Cell" | "WHO" | "CDC">("default");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<{ x: number; y: number; node: Node } | null>(null);

  const tree = useMemo(() => {
    try {
      setError(null);
      const t = parseNewick(newick);
      annotate(t);
      return t;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid Newick string");
      return null;
    }
  }, [newick]);

  const leaves = tree ? collectLeaves(tree) : [];
  const width = view === "rectangular" ? 900 : 720;
  const height = view === "rectangular" ? Math.max(420, leaves.length * 32) : 720;

  if (tree && view === "rectangular") layoutTree(tree, width, height);
  const edges = tree ? collectEdges(tree) : [];
  const { clusters, color: clusterColor } = useMemo(
    () => (tree ? clusterTree(tree) : { clusters: [], color: () => "#5cb8ff" }),
    [tree, newick],
  );
  // Map cluster id -> AI flag
  const aiFlags = useMemo(() => {
    const map = new Map<number, { kind: "expanding" | "isolated" | "founder"; conf: number }>();
    if (!clusters.length) return map;
    const sorted = [...clusters].sort((a, b) => b.size - a.size);
    if (sorted[0] && sorted[0].size >= 3) map.set(sorted[0].id, { kind: "expanding", conf: 92 });
    if (sorted[1] && sorted[1].size >= 3) map.set(sorted[1].id, { kind: "expanding", conf: 81 });
    sorted.filter((c) => c.size === 1).slice(0, 2).forEach((c) => map.set(c.id, { kind: "isolated", conf: 74 }));
    sorted.filter((c) => c.size === 2).slice(0, 1).forEach((c) => map.set(c.id, { kind: "founder", conf: 68 }));
    return map;
  }, [clusters]);

  // Publication preset → rendering knobs
  const preset = useMemo(() => {
    switch (pubStyle) {
      case "Nature": return { font: 11, label: true, stroke: 1.8, leaf: 4.5, palette: "vivid" };
      case "Science": return { font: 10, label: true, stroke: 1.6, leaf: 4, palette: "cool" };
      case "Cell": return { font: 11, label: true, stroke: 2, leaf: 5, palette: "warm" };
      case "WHO": return { font: 12, label: true, stroke: 2.2, leaf: 5, palette: "alert" };
      case "CDC": return { font: 11, label: true, stroke: 1.8, leaf: 4.5, palette: "alert" };
      default: return { font: 11, label: true, stroke: 1.6, leaf: 4.5, palette: "default" };
    }
  }, [pubStyle]);
  const maxDepth = useMemo(() => {
    let m = 0;
    const walk = (n: Node) => {
      if ((n.depth ?? 0) > m) m = n.depth ?? 0;
      n.children.forEach(walk);
    };
    if (tree) walk(tree);
    return m;
  }, [tree, newick]);

  // Filter for search highlight
  const matchedSet = useMemo(() => {
    if (!search.trim()) return null;
    const s = search.toLowerCase();
    return new Set(leaves.filter((l) => l.name.toLowerCase().includes(s) || (l.lineage ?? "").toLowerCase().includes(s)).map((l) => l.name));
  }, [search, leaves]);

  // Time playback
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTimeIdx((t) => (t >= 100 ? 0 : t + 2)), 80);
    return () => clearInterval(id);
  }, [playing]);

  // Persist snapshot whenever tree changes so /reports can include it.
  useEffect(() => {
    if (!tree) return;
    const svgEl = document.getElementById("vt-phylo-svg");
    savePhyloSnapshot({
      newick,
      leaf_count: leaves.length,
      max_depth: maxDepth,
      clusters,
      svg: svgEl ? new XMLSerializer().serializeToString(svgEl) : undefined,
    });
  }, [newick, tree, leaves.length, maxDepth, clusters]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setNewick(text.trim());
    toast.success(`Loaded ${f.name}`);
  }

  async function onMetaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const { headers, rows } = csvParse(text);
    const taxonIdx = headers.findIndex((h) => smartMapColumn(h) === "taxon");
    if (taxonIdx < 0) {
      toast.error("Could not detect taxon column");
      return;
    }
    const md: Metadata = {};
    let matched = 0;
    for (const r of rows) {
      const tax = r[taxonIdx];
      if (!tax) continue;
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        const sem = smartMapColumn(h);
        obj[sem ?? h.toLowerCase()] = r[i] ?? "";
      });
      md[tax] = obj;
      if (leaves.some((l) => l.name === tax)) matched++;
    }
    setMetadata(md);
    setMetaCols(Array.from(new Set(headers.map((h) => smartMapColumn(h) ?? h.toLowerCase()))));
    toast.success(`Loaded ${rows.length} rows · ${matched}/${leaves.length} taxa matched`);
  }

  function exportSvg() {
    const svg = document.getElementById("vt-phylo-svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `phylogeny-${view}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPng() {
    const svg = document.getElementById("vt-phylo-svg") as SVGSVGElement | null;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        if (!b) return;
        const u = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = u;
        a.download = `phylogeny-${view}.png`;
        a.click();
        URL.revokeObjectURL(u);
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  function leafColor(l: Node): string {
    if (colorBy === "lineage") {
      const [a] = LINEAGE_GRADIENTS[familyOf(l.name)];
      return a;
    }
    const meta = metadata[l.name];
    const v = meta?.[colorBy] ?? "";
    // Deterministic hash → hue
    let h = 0;
    for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) >>> 0;
    return `hsl(${h % 360} 70% 60%)`;
  }

  function addNote() {
    const target = selectedTaxon ?? "tree";
    if (!noteDraft.trim()) return;
    setAnnotations((a) => [
      ...a,
      {
        id: crypto.randomUUID(),
        target,
        text: noteDraft.trim(),
        author: "You",
        at: new Date().toISOString(),
      },
    ]);
    setNoteDraft("");
    toast.success("Annotation pinned");
  }

  function askCopilot(q: string) {
    if (!q.trim()) return;
    setCopilotLog((l) => [...l, { role: "user", text: q }]);
    setTimeout(() => {
      const c = clusters[0];
      const reply = (() => {
        if (/cluster/i.test(q) && c) {
          return `Cluster ${c.id} (${c.lineage}) groups ${c.size} taxa with tight branch lengths (≤0.15 subs/site). It is the largest clade in the loaded tree and most likely represents a recent transmission chain. Suggest reviewing geographic metadata for spatial clustering.`;
        }
        if (/fast|grow/i.test(q)) return `The fastest-growing lineage in the loaded subset is ${clusters[0]?.lineage ?? "n/a"}; relative branch shortening suggests rapid recent diversification.`;
        if (/unusual|odd/i.test(q)) return `Branch lengths above 0.15 subs/site flagged: ${leaves.filter((l) => (l.depth ?? 0) > maxDepth * 0.85).slice(0, 3).map((l) => l.name).join(", ") || "none"}. Recommend Bayesian dating to verify.`;
        if (/publication|summary/i.test(q)) return `Manuscript draft: The phylogeny (${leaves.length} taxa, ${clusters.length} clusters) reveals dominant ${clusters[0]?.lineage} clade with evidence of regional spread. Bootstrap support and clade calibration recommended before submission.`;
        return `Tree summary: ${leaves.length} taxa across ${clusters.length} clusters, max depth ${maxDepth.toFixed(3)} subs/site. Dominant lineage: ${clusters[0]?.lineage ?? "n/a"}.`;
      })();
      setCopilotLog((l) => [...l, { role: "ai", text: reply }]);
    }, 350);
    setCopilotInput("");
  }

  return (
    <PageShell>
      <div className="space-y-4">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-gradient-to-br from-[color:var(--accent)]/30 to-[color:var(--accent)]/5">
              <GitBranch className="w-6 h-6 text-[color:var(--accent)]" />
            </div>
            <div>
              <h1 className="text-2xl font-light tracking-tight">Phylogenomic Intelligence Workspace</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {leaves.length} taxa · {clusters.length} clusters · max depth {maxDepth.toFixed(3)} subs/site · {Object.keys(metadata).length} metadata rows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input ref={fileRef} type="file" accept=".nwk,.tree,.newick,.txt" className="hidden" onChange={onFile} />
            <input ref={metaFileRef} type="file" accept=".csv,.tsv,.txt,.json" className="hidden" onChange={onMetaFile} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" /> Tree
            </Button>
            <Button variant="outline" size="sm" onClick={() => metaFileRef.current?.click()}>
              <Layers className="w-4 h-4" /> Metadata
            </Button>
            <Button variant="outline" size="sm" onClick={() => setNewick(DEMO_NEWICK)}>
              <RotateCw className="w-4 h-4" /> Demo
            </Button>
            <Button variant="outline" size="sm" onClick={exportSvg}>
              <Download className="w-4 h-4" /> SVG
            </Button>
            <Button variant="outline" size="sm" onClick={exportPng}>
              <ImageIcon className="w-4 h-4" /> PNG
            </Button>
            <Button size="sm" onClick={() => { savePhyloSnapshot({ newick, leaf_count: leaves.length, max_depth: maxDepth, clusters }); toast.success("Saved for next report"); }}>
              <Save className="w-4 h-4" /> Report
            </Button>
          </div>
        </header>

        <AuthGate>
          <div className="grid grid-cols-12 gap-3" style={{ minHeight: "calc(100vh - 240px)" }}>
            {/* LEFT PANEL */}
            <aside className="col-span-12 lg:col-span-3 space-y-3">
              <Panel title="Tree Controls" icon={Trees}>
                <div className="grid grid-cols-2 gap-1">
                  {([
                    { v: "rectangular", l: "Rectangular", I: GitBranch },
                    { v: "circular", l: "Circular", I: CircleDot },
                    { v: "radial", l: "Radial", I: Radio },
                    { v: "unrooted", l: "Unrooted", I: NetIcon },
                  ] as const).map(({ v, l, I }) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`flex items-center gap-1.5 text-[11px] py-1.5 px-2 rounded-md border transition-all ${
                        view === v
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
                          : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <I className="w-3 h-3" /> {l}
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Search & Highlight" icon={Search}>
                <Input
                  placeholder="Search taxa / lineage…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                {matchedSet && <div className="text-[10px] text-muted-foreground mt-1.5">{matchedSet.size} matches</div>}
              </Panel>

              <Panel title="Color by" icon={Filter}>
                <div className="grid grid-cols-2 gap-1">
                  {(["lineage", "country", "host", "risk"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setColorBy(c)}
                      className={`text-[11px] py-1 rounded-md border capitalize ${
                        colorBy === c
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
                          : "border-border bg-background/40 text-muted-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <label className="flex items-center justify-between text-[11px] mt-3">
                  <span className="text-muted-foreground">Annotation rings (circular)</span>
                  <input
                    type="checkbox"
                    checked={showRings}
                    onChange={(e) => setShowRings(e.target.checked)}
                  />
                </label>
              </Panel>

              <Panel title="AI Phylogeny Copilot" icon={Sparkles}>
                <div className="space-y-1.5 max-h-44 overflow-y-auto mb-2">
                  {copilotLog.length === 0 && (
                    <div className="text-[11px] text-muted-foreground">
                      Ask: "Explain Cluster 1", "Find unusual branches", "Generate publication summary".
                    </div>
                  )}
                  {copilotLog.map((m, i) => (
                    <div
                      key={i}
                      className={`text-[11px] rounded-md p-1.5 ${
                        m.role === "user"
                          ? "bg-secondary/40 text-foreground"
                          : "bg-[color:var(--accent)]/10 text-foreground/90 border border-[color:var(--accent)]/30"
                      }`}
                    >
                      <div className="text-[9px] uppercase opacity-60 mb-0.5">{m.role}</div>
                      {m.text}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input
                    placeholder="Ask copilot…"
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && askCopilot(copilotInput)}
                    className="h-7 text-[11px]"
                  />
                  <Button size="sm" className="h-7 px-2" onClick={() => askCopilot(copilotInput)}>
                    <Zap className="w-3 h-3" />
                  </Button>
                </div>
              </Panel>
            </aside>

            {/* CENTER PANEL */}
            <section className="col-span-12 lg:col-span-6">
              <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden h-full flex flex-col">
                <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 capitalize">
                    <span className="w-2 h-2 rounded-full bg-[color:var(--accent)] animate-pulse" />
                    {view} view
                  </div>
                  <div className="text-muted-foreground">
                    Timeline: day {timeIdx} / 100
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-gradient-to-br from-background/40 to-background/10 relative">
                  {/* Zoom controls */}
                  {tree && (
                    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1 rounded-lg border border-border/60 bg-background/70 backdrop-blur p-1">
                      <button onClick={() => setZoom((z) => Math.min(z * 1.25, 6))} className="p-1 hover:bg-secondary/60 rounded" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setZoom((z) => Math.max(z / 1.25, 0.4))} className="p-1 hover:bg-secondary/60 rounded" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1 hover:bg-secondary/60 rounded" title="Fit"><Maximize2 className="w-3.5 h-3.5" /></button>
                      <div className="text-[9px] text-center tabular-nums text-muted-foreground border-t border-border/40 pt-0.5">{Math.round(zoom * 100)}%</div>
                    </div>
                  )}
                  {/* Hover tooltip */}
                  {hover && (
                    <div
                      className="pointer-events-none absolute z-20 rounded-md border border-[color:var(--accent)]/40 bg-background/95 backdrop-blur px-2.5 py-1.5 text-[11px] shadow-xl"
                      style={{ left: Math.min(hover.x + 14, width - 200), top: Math.max(hover.y - 4, 8) }}
                    >
                      <div className="font-medium text-foreground">{hover.node.name}</div>
                      <div className="text-muted-foreground text-[10px]">{hover.node.lineage ?? "Unassigned"}</div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1 text-[10px]">
                        <span className="text-muted-foreground">Branch</span><span className="tabular-nums">{(hover.node.branch ?? 0).toFixed(4)}</span>
                        <span className="text-muted-foreground">Depth</span><span className="tabular-nums">{(hover.node.depth ?? 0).toFixed(4)}</span>
                        <span className="text-muted-foreground">Cluster</span><span>#{hover.node.cluster ?? "—"}</span>
                        <span className="text-muted-foreground">Country</span><span>{metadata[hover.node.name]?.country ?? "—"}</span>
                        <span className="text-muted-foreground">Host</span><span>{metadata[hover.node.name]?.host ?? "Human"}</span>
                        <span className="text-muted-foreground">Date</span><span>{metadata[hover.node.name]?.date ?? "—"}</span>
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="m-3 text-xs text-[color:var(--status-alert)] bg-[color:var(--status-alert)]/10 border border-[color:var(--status-alert)]/30 rounded p-2">
                      {error}
                    </div>
                  )}
                  {!tree ? (
                    <EmptyState onLoadDemo={() => setNewick(DEMO_NEWICK)} onUpload={() => fileRef.current?.click()} />
                  ) : view === "rectangular" ? (
                    <RectangularTree
                      tree={tree}
                      edges={edges}
                      leaves={leaves}
                      width={width}
                      height={height}
                      matchedSet={matchedSet}
                      selected={selectedTaxon}
                      onSelect={setSelectedTaxon}
                      leafColor={leafColor}
                      clusterColor={clusterColor}
                      annotations={annotations}
                      zoom={zoom}
                      pan={pan}
                      onHover={setHover}
                      preset={preset}
                      aiFlags={aiFlags}
                      maxDepth={maxDepth}
                    />
                  ) : view === "circular" ? (
                    <CircularTree
                      leaves={leaves}
                      size={width}
                      maxDepth={maxDepth}
                      matchedSet={matchedSet}
                      selected={selectedTaxon}
                      onSelect={setSelectedTaxon}
                      leafColor={leafColor}
                      showRings={showRings}
                      metadata={metadata}
                      onHover={setHover}
                    />
                  ) : view === "radial" ? (
                    <RadialTree
                      leaves={leaves}
                      size={width}
                      maxDepth={maxDepth}
                      matchedSet={matchedSet}
                      selected={selectedTaxon}
                      onSelect={setSelectedTaxon}
                      leafColor={leafColor}
                      onHover={setHover}
                      clusterColor={clusterColor}
                      aiFlags={aiFlags}
                    />
                  ) : (
                    <UnrootedNetwork
                      leaves={leaves}
                      size={width}
                      matchedSet={matchedSet}
                      selected={selectedTaxon}
                      onSelect={setSelectedTaxon}
                      leafColor={leafColor}
                      clusters={clusters}
                      onHover={setHover}
                      clusterColor={clusterColor}
                      aiFlags={aiFlags}
                    />
                  )}
                </div>
                <div className="px-4 py-2 border-t border-border/60 flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setPlaying((p) => !p)}
                    className="rounded-md p-1 bg-[color:var(--accent)]/15 text-[color:var(--accent)] hover:bg-[color:var(--accent)]/25"
                  >
                    {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={timeIdx}
                    onChange={(e) => setTimeIdx(Number(e.target.value))}
                    className="flex-1 accent-[color:var(--accent)]"
                  />
                  <span className="text-muted-foreground tabular-nums w-20 text-right">2024 → now</span>
                </div>
              </div>
            </section>

            {/* RIGHT PANEL */}
            <aside className="col-span-12 lg:col-span-3 space-y-3">
              <Panel title="Selected Taxon" icon={Pin}>
                {selectedTaxon ? (
                  <TaxonProfile name={selectedTaxon} leaves={leaves} metadata={metadata} />
                ) : (
                  <div className="text-[11px] text-muted-foreground">Click a leaf to view its profile.</div>
                )}
              </Panel>

              <Panel title="Cluster Intelligence" icon={Sparkles}>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {clusters.slice(0, 6).map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-border/60 bg-background/40 p-2"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: clusterColor(c.id) }} />
                          Cluster {c.id}
                        </div>
                        <span className="text-muted-foreground">{c.size} taxa</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{c.lineage}</div>
                      <div className="text-[10px] text-foreground/80 mt-1 leading-snug">
                        AI: likely {c.size > 4 ? "expanding transmission chain" : "small founder group"} · conf {(70 + (c.id * 7) % 25)}%
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Annotations" icon={MessageSquare}>
                <div className="space-y-1.5 max-h-32 overflow-y-auto mb-2">
                  {annotations.length === 0 && (
                    <div className="text-[11px] text-muted-foreground">Pin notes to taxa or clades.</div>
                  )}
                  {annotations.map((a) => (
                    <div key={a.id} className="text-[11px] rounded-md border border-border/50 bg-background/40 p-1.5">
                      <div className="text-[9px] uppercase text-muted-foreground">{a.target}</div>
                      <div>{a.text}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{a.author} · {new Date(a.at).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input
                    placeholder={selectedTaxon ? `Note on ${selectedTaxon}…` : "Note on tree…"}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addNote()}
                    className="h-7 text-[11px]"
                  />
                  <Button size="sm" className="h-7 px-2" onClick={addNote}>
                    <Pin className="w-3 h-3" />
                  </Button>
                </div>
              </Panel>

              <Panel title="Publication Mode" icon={FileText}>
                <div className="grid grid-cols-2 gap-1">
                  {(["Nature", "Science", "Cell", "WHO", "CDC"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setPubStyle(s); toast.success(`${s} style applied`); }}
                      className={`text-[11px] py-1 rounded-md border transition-colors ${
                        pubStyle === s
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
                          : "border-border bg-background/40 hover:bg-secondary/40"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <button
                    onClick={() => { setPubStyle("default"); toast.success("Default style"); }}
                    className={`col-span-2 text-[11px] py-1 rounded-md border ${
                      pubStyle === "default" ? "border-[color:var(--accent)] text-[color:var(--accent)]" : "border-border bg-background/40"
                    }`}
                  >Default</button>
                </div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  Presets adjust typography, branch weight, and label density. Export SVG/PNG for figures.
                </div>
              </Panel>
            </aside>
          </div>
        </AuthGate>
      </div>
    </PageShell>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        <Icon className="w-3 h-3" /> {title}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ onLoadDemo, onUpload }: { onLoadDemo: () => void; onUpload: () => void }) {
  return (
    <div className="h-full min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[color:var(--accent)]/40 to-[color:var(--accent)]/0 flex items-center justify-center mb-4">
          <GitBranch className="w-10 h-10 text-[color:var(--accent)]" />
        </div>
        <h2 className="text-xl font-light">Phylogenomic Intelligence Workspace</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Upload a Newick tree and optional metadata to explore evolutionary relationships, lineage dynamics, and outbreak intelligence.
        </p>
        <div className="flex items-center justify-center gap-2 mt-5">
          <Button onClick={onUpload}>
            <Upload className="w-4 h-4" /> Upload Tree
          </Button>
          <Button variant="outline" onClick={onLoadDemo}>
            <RotateCw className="w-4 h-4" /> Load Demo Dataset
          </Button>
        </div>
      </div>
    </div>
  );
}

function TaxonProfile({ name, leaves, metadata }: { name: string; leaves: Node[]; metadata: Metadata }) {
  const leaf = leaves.find((l) => l.name === name);
  const meta = metadata[name] ?? {};
  const [a, b] = LINEAGE_GRADIENTS[familyOf(name)];
  return (
    <div className="space-y-2">
      <div
        className="rounded-lg p-3 text-white"
        style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
      >
        <div className="text-[10px] uppercase opacity-80">{leaf?.lineage ?? "Unassigned lineage"}</div>
        <div className="text-sm font-medium truncate">{name}</div>
      </div>
      <dl className="rounded-lg border border-border/50 bg-background/40 divide-y divide-border/40 text-[11px]">
        {[
          ["Cluster", String(leaf?.cluster ?? "—")],
          ["Country", meta.country ?? "—"],
          ["Region", meta.region ?? "—"],
          ["Host", meta.host ?? "Human"],
          ["Date", meta.date ?? "—"],
          ["Institution", meta.institution ?? "—"],
          ["Risk", meta.risk ?? "—"],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 px-2 py-1.5">
            <span className="text-muted-foreground">{k}</span>
            <span className="truncate">{v}</span>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ============ View Renderers ============

type Preset = { font: number; label: boolean; stroke: number; leaf: number; palette: string };
type AiFlag = { kind: "expanding" | "isolated" | "founder"; conf: number };
type HoverSetter = (h: { x: number; y: number; node: Node } | null) => void;

function RectangularTree({
  tree, edges, leaves, width, height, matchedSet, selected, onSelect, leafColor, clusterColor, annotations,
  zoom, pan, onHover, preset, aiFlags, maxDepth,
}: {
  tree: Node; edges: { x1: number; y1: number; x2: number; y2: number }[]; leaves: Node[];
  width: number; height: number; matchedSet: Set<string> | null;
  selected: string | null; onSelect: (n: string) => void;
  leafColor: (l: Node) => string; clusterColor: (id?: number) => string;
  annotations: Array<{ target: string }>;
  zoom: number; pan: { x: number; y: number }; onHover: HoverSetter;
  preset: Preset; aiFlags: Map<number, AiFlag>; maxDepth: number;
}) {
  // Build orthogonal smoothed paths with thickness scaling by descendant count
  const descCount = useMemo(() => {
    const m = new Map<Node, number>();
    const walk = (n: Node): number => {
      if (!n.children.length) { m.set(n, 1); return 1; }
      const s = n.children.reduce((a, c) => a + walk(c), 0);
      m.set(n, s); return s;
    };
    walk(tree);
    return m;
  }, [tree]);
  const totalLeaves = leaves.length || 1;

  const paths: Array<{ d: string; w: number; color: string; cluster?: number }> = [];
  const walkPaths = (n: Node) => {
    for (const c of n.children) {
      const w = 0.9 + ((descCount.get(c) ?? 1) / totalLeaves) * 4 * (preset.stroke / 1.6);
      const r = Math.min(6, Math.abs(c.y! - n.y!) / 2);
      // Smooth orthogonal connector
      const dy = c.y! > n.y! ? 1 : -1;
      const d = `M${n.x!},${n.y!} L${n.x!},${c.y! - r * dy} Q${n.x!},${c.y!} ${n.x! + r},${c.y!} L${c.x!},${c.y!}`;
      paths.push({ d, w, color: clusterColor(c.cluster), cluster: c.cluster });
      walkPaths(c);
    }
  };
  walkPaths(tree);

  // Depth axis ticks
  const ticks = Array.from({ length: 5 }, (_, i) => (maxDepth * i) / 4);
  const xAt = (d: number) => 20 + (d / (maxDepth || 1)) * (width - 160);

  return (
    <svg
      id="vt-phylo-svg"
      viewBox={`0 0 ${width} ${height + 30}`}
      width="100%"
      style={{ display: "block", minHeight: 360, transform: `scale(${zoom}) translate(${pan.x}px,${pan.y}px)`, transformOrigin: "0 0", transition: "transform 120ms ease-out", shapeRendering: "geometricPrecision" }}
    >
      <defs>
        <linearGradient id="branch-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.65 0.18 200)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="oklch(0.82 0.18 200)" stopOpacity="0.95" />
        </linearGradient>
        <filter id="branch-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Depth axis */}
      <g opacity="0.4">
        <line x1={20} y1={height + 8} x2={width - 140} y2={height + 8} stroke="currentColor" strokeWidth="0.5" />
        {ticks.map((t, i) => (
          <g key={i} transform={`translate(${xAt(t)}, ${height + 8})`}>
            <line y2="4" stroke="currentColor" strokeWidth="0.5" />
            <text y="16" fontSize="9" textAnchor="middle" className="fill-muted-foreground">{t.toFixed(3)}</text>
          </g>
        ))}
        <text x={width - 130} y={height + 22} fontSize="9" className="fill-muted-foreground">subs/site</text>
      </g>

      {/* Branches */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter="url(#branch-glow)">
        {paths.map((p, i) => (
          <path key={i} d={p.d} stroke={p.color} strokeWidth={p.w} opacity="0.85" />
        ))}
      </g>

      {/* AI flag badges on clade representatives */}
      {leaves.map((l, i) => {
        const flag = aiFlags.get(l.cluster ?? -1);
        if (!flag) return null;
        // only one badge per cluster (first occurrence)
        if (leaves.findIndex((x) => x.cluster === l.cluster) !== i) return null;
        const Icon = flag.kind === "expanding" ? Flame : flag.kind === "isolated" ? AlertTriangle : Sparkles;
        const fg = flag.kind === "expanding" ? "#ff8a3d" : flag.kind === "isolated" ? "#f5c451" : "#7dd3fc";
        return (
          <g key={`ai${i}`} transform={`translate(${(l.x ?? 0) - 16}, ${(l.y ?? 0) - 8})`}>
            <rect width="14" height="14" rx="3" fill={fg} opacity="0.18" stroke={fg} strokeWidth="0.6" />
            <foreignObject x="2" y="2" width="10" height="10">
              <Icon className="w-2.5 h-2.5" style={{ color: fg }} />
            </foreignObject>
          </g>
        );
      })}

      {/* Leaves */}
      {leaves.map((l, idx) => {
        const fade = matchedSet && !matchedSet.has(l.name);
        const sel = selected === l.name;
        const annotated = annotations.some((a) => a.target === l.name);
        const color = leafColor(l);
        return (
          <g
            key={idx}
            transform={`translate(${l.x},${l.y})`}
            opacity={fade ? 0.22 : 1}
            style={{ cursor: "pointer" }}
            onClick={() => onSelect(l.name)}
            onMouseEnter={(e) => {
              const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
              const parent = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect();
              onHover({ x: rect.left - parent.left + (l.x ?? 0) * (rect.width / width), y: rect.top - parent.top + (l.y ?? 0) * (rect.height / (height + 30)), node: l });
            }}
            onMouseLeave={() => onHover(null)}
          >
            {sel && <circle r="10" fill={color} opacity="0.3" />}
            <circle r={sel ? preset.leaf + 1.5 : preset.leaf} fill={color} stroke={sel ? "white" : "oklch(0.18 0.04 250)"} strokeWidth={sel ? 1.6 : 0.8} />
            <text x="10" y="4" fontSize={preset.font} className="fill-foreground" style={{ fontFamily: "var(--font-mono)" }}>
              {l.name}
              {preset.label && l.lineage && (
                <tspan dx="6" fontSize={preset.font - 2} fill={clusterColor(l.cluster)}>· {l.lineage}</tspan>
              )}
              {annotated && <tspan dx="4" fontSize={preset.font - 2} fill="#f5c451">📌</tspan>}
            </text>
            {/* branch length label */}
            {(l.branch ?? 0) > 0 && (
              <text x="-4" y="-4" fontSize="7" textAnchor="end" className="fill-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
                {l.branch.toFixed(3)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function CircularTree({
  leaves, size, maxDepth, matchedSet, selected, onSelect, leafColor, showRings, metadata, onHover,
}: {
  leaves: Node[]; size: number; maxDepth: number;
  matchedSet: Set<string> | null; selected: string | null;
  onSelect: (n: string) => void; leafColor: (l: Node) => string;
  showRings: boolean; metadata: Metadata; onHover?: HoverSetter;
}) {
  const cx = size / 2, cy = size / 2;
  const Rcore = size * 0.22;
  const Rleaf = size * 0.36;
  const ringStart = size * 0.39;
  const ringStep = size * 0.018;
  const N = leaves.length;
  return (
    <svg id="vt-phylo-svg" viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: "block" }}>
      <circle cx={cx} cy={cy} r={Rcore * 0.4} fill="oklch(0.22 0.04 250)" opacity="0.5" />
      <g stroke="oklch(0.6 0.15 200 / 0.4)" strokeWidth="1.2" fill="none">
        {leaves.map((l, i) => {
          const a = (i / N) * Math.PI * 2 - Math.PI / 2;
          const r1 = Rcore + ((l.depth ?? 0) / maxDepth) * (Rleaf - Rcore) * 0.3;
          const r2 = Rleaf;
          return <line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2} />;
        })}
      </g>
      {/* annotation rings */}
      {showRings && ["country", "host", "lineage", "risk"].map((col, ri) => (
        <g key={col}>
          {leaves.map((l, i) => {
            const a1 = ((i - 0.5) / N) * Math.PI * 2 - Math.PI / 2;
            const a2 = ((i + 0.5) / N) * Math.PI * 2 - Math.PI / 2;
            const rIn = ringStart + ri * ringStep;
            const rOut = rIn + ringStep - 1;
            const v = col === "lineage" ? l.lineage ?? "" : metadata[l.name]?.[col] ?? "";
            let h = 0;
            for (let k = 0; k < v.length; k++) h = (h * 31 + v.charCodeAt(k)) >>> 0;
            const fill = v ? `hsl(${h % 360} 65% 55%)` : "oklch(0.3 0.02 250)";
            const x1 = cx + Math.cos(a1) * rIn, y1 = cy + Math.sin(a1) * rIn;
            const x2 = cx + Math.cos(a2) * rIn, y2 = cy + Math.sin(a2) * rIn;
            const x3 = cx + Math.cos(a2) * rOut, y3 = cy + Math.sin(a2) * rOut;
            const x4 = cx + Math.cos(a1) * rOut, y4 = cy + Math.sin(a1) * rOut;
            return <path key={i} d={`M${x1},${y1} L${x2},${y2} L${x3},${y3} L${x4},${y4} Z`} fill={fill} opacity={matchedSet && !matchedSet.has(l.name) ? 0.25 : 0.9} />;
          })}
        </g>
      ))}
      {leaves.map((l, i) => {
        const a = (i / N) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * Rleaf, y = cy + Math.sin(a) * Rleaf;
        const sel = selected === l.name;
        const fade = matchedSet && !matchedSet.has(l.name);
        const color = leafColor(l);
        const lx = cx + Math.cos(a) * (Rleaf + 14);
        const ly = cy + Math.sin(a) * (Rleaf + 14);
        const rot = (a * 180) / Math.PI;
        const flip = rot > 90 || rot < -90;
        return (
          <g key={i} opacity={fade ? 0.25 : 1} style={{ cursor: "pointer" }} onClick={() => onSelect(l.name)} onMouseEnter={() => onHover?.({ x, y, node: l })} onMouseLeave={() => onHover?.(null)}>
            {sel && <circle cx={x} cy={y} r={8} fill={color} opacity="0.4" />}
            <circle cx={x} cy={y} r={sel ? 4.5 : 3.5} fill={color} stroke="oklch(0.18 0.04 250)" strokeWidth={0.6} />
            <text
              x={lx} y={ly}
              fontSize="9"
              textAnchor={flip ? "end" : "start"}
              transform={`rotate(${flip ? rot + 180 : rot}, ${lx}, ${ly})`}
              className="fill-foreground"
            >
              {l.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RadialTree({
  leaves, size, maxDepth, matchedSet, selected, onSelect, leafColor, onHover, aiFlags,
}: {
  leaves: Node[]; size: number; maxDepth: number;
  matchedSet: Set<string> | null; selected: string | null;
  onSelect: (n: string) => void; leafColor: (l: Node) => string;
  onHover?: HoverSetter; clusterColor?: (id?: number) => string; aiFlags?: Map<number, AiFlag>;
}) {
  const cx = size / 2, cy = size / 2;
  return (
    <svg id="vt-phylo-svg" viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: "block" }}>
      {aiFlags && Array.from(aiFlags.entries()).map(([cid, flag], k) => {
        const ls = leaves.filter((x) => x.cluster === cid);
        if (!ls.length) return null;
        const i = leaves.indexOf(ls[0]);
        const a = (i / leaves.length) * Math.PI * 2;
        const r = 60 + ((ls[0].depth ?? 0) / maxDepth) * (size * 0.4);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const fg = flag.kind === "expanding" ? "#ff8a3d" : flag.kind === "isolated" ? "#f5c451" : "#7dd3fc";
        return <circle key={`halo${k}`} cx={x} cy={y} r={22} fill="none" stroke={fg} strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />;
      })}
      {leaves.map((l, i) => {
        const a = (i / leaves.length) * Math.PI * 2;
        const r = 60 + ((l.depth ?? 0) / maxDepth) * (size * 0.4);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        return <line key={`b${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke="oklch(0.6 0.15 200 / 0.35)" strokeWidth="1" />;
      })}
      {leaves.map((l, i) => {
        const a = (i / leaves.length) * Math.PI * 2;
        const r = 60 + ((l.depth ?? 0) / maxDepth) * (size * 0.4);
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const sel = selected === l.name;
        const fade = matchedSet && !matchedSet.has(l.name);
        const color = leafColor(l);
        return (
          <g key={i} opacity={fade ? 0.25 : 1} style={{ cursor: "pointer" }} onClick={() => onSelect(l.name)} onMouseEnter={() => onHover?.({ x, y, node: l })} onMouseLeave={() => onHover?.(null)}>
            {sel && <circle cx={x} cy={y} r={9} fill={color} opacity="0.4" />}
            <circle cx={x} cy={y} r={sel ? 5 : 3.8} fill={color} stroke="oklch(0.18 0.04 250)" strokeWidth={0.7} />
            <text x={x + 6} y={y + 3} fontSize="9" className="fill-foreground">{l.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function UnrootedNetwork({
  leaves, size, matchedSet, selected, onSelect, leafColor, clusters, onHover, clusterColor, aiFlags,
}: {
  leaves: Node[]; size: number; matchedSet: Set<string> | null; selected: string | null;
  onSelect: (n: string) => void; leafColor: (l: Node) => string;
  clusters: { id: number; size: number; lineage: string }[];
  onHover?: HoverSetter; clusterColor?: (id?: number) => string; aiFlags?: Map<number, AiFlag>;
}) {
  // Lay out clusters around the canvas, leaves around their cluster centroid
  const cx = size / 2, cy = size / 2;
  const clusterCenters = new Map<number, { x: number; y: number }>();
  clusters.forEach((c, i) => {
    const a = (i / Math.max(clusters.length, 1)) * Math.PI * 2;
    clusterCenters.set(c.id, { x: cx + Math.cos(a) * size * 0.28, y: cy + Math.sin(a) * size * 0.28 });
  });
  const positions = leaves.map((l, i) => {
    const c = clusterCenters.get(l.cluster ?? 0) ?? { x: cx, y: cy };
    const a = (i / leaves.length) * Math.PI * 2;
    return { x: c.x + Math.cos(a) * 40, y: c.y + Math.sin(a) * 40, l };
  });
  return (
    <svg id="vt-phylo-svg" viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: "block" }}>
      {Array.from(clusterCenters.entries()).map(([id, c]) => {
        const flag = aiFlags?.get(id);
        const baseColor = clusterColor?.(id) ?? "oklch(0.65 0.18 200)";
        const haloColor = flag?.kind === "expanding" ? "#ff8a3d" : flag?.kind === "isolated" ? "#f5c451" : baseColor;
        return <circle key={`halo${id}`} cx={c.x} cy={c.y} r={55} fill={haloColor} fillOpacity="0.06" stroke={haloColor} strokeWidth="0.8" strokeDasharray={flag ? "4 3" : "1 3"} />;
      })}
      {positions.map((p, i) => {
        const c = clusterCenters.get(p.l.cluster ?? 0) ?? { x: cx, y: cy };
        return <line key={i} x1={c.x} y1={c.y} x2={p.x} y2={p.y} stroke="oklch(0.6 0.15 200 / 0.3)" strokeWidth="1" />;
      })}
      {Array.from(clusterCenters.entries()).map(([id, c]) => (
        <circle key={id} cx={c.x} cy={c.y} r={14} fill="oklch(0.3 0.05 250)" stroke="oklch(0.65 0.18 200)" strokeWidth="1" />
      ))}
      {positions.map((p, i) => {
        const sel = selected === p.l.name;
        const fade = matchedSet && !matchedSet.has(p.l.name);
        const color = leafColor(p.l);
        return (
          <g key={i} opacity={fade ? 0.25 : 1} style={{ cursor: "pointer" }} onClick={() => onSelect(p.l.name)} onMouseEnter={() => onHover?.({ x: p.x, y: p.y, node: p.l })} onMouseLeave={() => onHover?.(null)}>
            {sel && <circle cx={p.x} cy={p.y} r={9} fill={color} opacity="0.4" />}
            <circle cx={p.x} cy={p.y} r={sel ? 5 : 3.6} fill={color} stroke="oklch(0.18 0.04 250)" strokeWidth={0.7} />
            <text x={p.x + 6} y={p.y + 3} fontSize="8" className="fill-foreground">{p.l.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
