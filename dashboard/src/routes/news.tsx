import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Newspaper,
  Radio,
  AlertTriangle,
  Sparkles,
  Globe2,
  Activity,
  Flame,
  Radar,
  Filter,
  Tv,
  Play,
  Bot,
} from "lucide-react";
import { PageShell } from "@/components/vt/PageShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/news")({
  component: NewsPage,
  head: () => ({
    meta: [
      { title: "Intelligence Operations Center — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content:
          "Live outbreak intelligence, breaking health news, and 24/7 broadcast monitoring across Africa.",
      },
    ],
  }),
});

const SEV: Record<string, { color: string; label: string; ring: string }> = {
  low: { color: "#34d399", label: "LOW", ring: "ring-emerald-400/40" },
  moderate: { color: "#fbbf24", label: "MEDIUM", ring: "ring-amber-400/40" },
  high: { color: "#fb923c", label: "HIGH", ring: "ring-orange-400/50" },
  critical: { color: "#f87171", label: "CRITICAL", ring: "ring-rose-400/60" },
  extreme: { color: "#ef4444", label: "EXTREME", ring: "ring-rose-500/70" },
};

const TOPICS = [
  "All",
  "Outbreaks",
  "Variants",
  "Genomics",
  "Climate & Health",
  "Emerging Threats",
  "Africa Focus",
  "Global",
];

const STREAMS = [
  { id: "9Auq9mYxFEE", label: "Sky News Live", source: "Sky News", viewers: "12.4k" },
  { id: "F-cfYP9DGGQ", label: "Al Jazeera English", source: "Al Jazeera", viewers: "8.1k" },
  { id: "gCNeDWCI0vo", label: "DW News Live", source: "DW", viewers: "3.7k" },
  { id: "w_Ma8oQLmSM", label: "ABC News Live", source: "ABC", viewers: "21.2k" },
];

const NEWS_SOURCES = [
  {
    name: "WHO Africa",
    color: "#22d3ee",
    time: "2m",
    title: "Mpox Clade Ib detected in new DRC province",
    desc: "Genomic sequencing confirms expansion of Clade Ib lineage; cross-border surveillance heightened.",
    topics: ["Outbreaks", "Variants", "Genomics", "Africa Focus"],
  },
  {
    name: "Africa CDC",
    color: "#34d399",
    time: "11m",
    title: "Marburg containment update — Rwanda response phase 3",
    desc: "Contact tracing closes 412 chains; ring vaccination scaled to 6 districts.",
    topics: ["Outbreaks", "Africa Focus"],
  },
  {
    name: "Reuters Health",
    color: "#fbbf24",
    time: "27m",
    title: "Cholera outbreak intensifies in Sudan IDP camps",
    desc: "WHO estimates 1.2M at risk; AI early warning flagged signal 9 days prior.",
    topics: ["Outbreaks", "Climate & Health", "Africa Focus"],
  },
  {
    name: "BBC Africa",
    color: "#a78bfa",
    time: "44m",
    title: "Rift Valley fever cluster reported in southern Kenya",
    desc: "Wastewater anomaly +2.1σ; livestock surveillance ramping up.",
    topics: ["Outbreaks", "Climate & Health", "Africa Focus"],
  },
  {
    name: "WHO Emergencies",
    color: "#22d3ee",
    time: "1h",
    title: "Polio vaccination drive launched in 8 Sahel countries",
    desc: "Cross-border coordination; AI logistics model optimizes cold chain.",
    topics: ["Africa Focus"],
  },
  {
    name: "AU Health",
    color: "#34d399",
    time: "1h",
    title: "Continental Genomic Surveillance Compact signed",
    desc: "32 nations agree to real-time sequence sharing under the AMR Life Expectancy Intelligence framework.",
    topics: ["Genomics", "Africa Focus", "Global"],
  },
];

const AI_ALERTS = [
  {
    sev: "critical" as const,
    pathogen: "Mpox Clade Ib",
    country: "DRC",
    summary:
      "Mutation cluster N321K associated with increased transmissibility detected across 4 new sampling sites.",
    source: "WHO Africa · AI Anomaly Engine",
    time: "2 min ago",
    topics: ["Variants", "Outbreaks", "Africa Focus"],
  },
  {
    sev: "high" as const,
    pathogen: "Marburg virus",
    country: "Rwanda",
    summary:
      "Wastewater positivity rate +38% in Kigali district 7. Trajectory exceeds Bayesian SEIR baseline.",
    source: "Africa CDC · Sentinel Network",
    time: "14 min ago",
    topics: ["Emerging Threats", "Outbreaks", "Africa Focus"],
  },
  {
    sev: "moderate" as const,
    pathogen: "Cholera (Vibrio O1)",
    country: "Sudan",
    summary:
      "Rainfall anomaly +1.8σ combined with displacement flux raises 14-day risk index to 0.78.",
    source: "AMR Life Expectancy Intelligence Co-Pilot",
    time: "31 min ago",
    topics: ["Climate & Health", "Outbreaks", "Africa Focus"],
  },
  {
    sev: "high" as const,
    pathogen: "H5N1",
    country: "Nigeria",
    summary: "New reassortment event in poultry sector; cross-species jump probability now 0.22.",
    source: "AI Anomaly Engine",
    time: "1 h ago",
    topics: ["Variants", "Emerging Threats", "Africa Focus"],
  },
  {
    sev: "low" as const,
    pathogen: "Lassa fever",
    country: "Ghana",
    summary: "Sentinel reporting cadence improved; signal stable, no anomaly detected.",
    source: "Sentinel Network",
    time: "2 h ago",
    topics: ["Africa Focus"],
  },
];

const AFRICAN_COUNTRIES = new Set(
  [
    "algeria",
    "angola",
    "benin",
    "botswana",
    "burkina faso",
    "burundi",
    "cabo verde",
    "cameroon",
    "central african republic",
    "chad",
    "comoros",
    "congo",
    "democratic republic of congo",
    "drc",
    "djibouti",
    "egypt",
    "equatorial guinea",
    "eritrea",
    "eswatini",
    "ethiopia",
    "gabon",
    "gambia",
    "ghana",
    "guinea",
    "guinea-bissau",
    "ivory coast",
    "cote d'ivoire",
    "kenya",
    "lesotho",
    "liberia",
    "libya",
    "madagascar",
    "malawi",
    "mali",
    "mauritania",
    "mauritius",
    "morocco",
    "mozambique",
    "namibia",
    "niger",
    "nigeria",
    "rwanda",
    "sao tome and principe",
    "senegal",
    "seychelles",
    "sierra leone",
    "somalia",
    "south africa",
    "south sudan",
    "sudan",
    "tanzania",
    "togo",
    "tunisia",
    "uganda",
    "zambia",
    "zimbabwe",
  ].map((c) => c.toLowerCase()),
);

const TOPIC_KEYWORDS: Record<string, string[]> = {
  Variants: ["variant", "mutation", "lineage", "clade", "reassortment", "strain"],
  Genomics: ["genomic", "sequenc", "phylogen"],
  "Climate & Health": ["rain", "climate", "flood", "wastewater", "drought", "temperature"],
  Outbreaks: ["outbreak", "cluster", "case", "spread", "contact tracing", "containment"],
  "Emerging Threats": ["emerging", "novel", "anomaly", "reassortment"],
};

function inferAlertTopics(alert: {
  title?: string | null;
  description?: string | null;
  pathogen?: string | null;
  country?: string | null;
}): string[] {
  const haystack =
    `${alert.title ?? ""} ${alert.description ?? ""} ${alert.pathogen ?? ""}`.toLowerCase();
  const topics = Object.entries(TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => haystack.includes(k)))
    .map(([topic]) => topic);
  if (alert.country && AFRICAN_COUNTRIES.has(alert.country.trim().toLowerCase())) {
    topics.push("Africa Focus");
  }
  if (topics.length === 0) topics.push("Global");
  return topics;
}

function NewsPage() {
  const [topic, setTopic] = useState("All");
  const [activeStream, setActiveStream] = useState(0);

  const { data = [] } = useQuery({
    queryKey: ["news-feed"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(80);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const dbAlerts = useMemo(() => data ?? [], [data]);
  const active24h = dbAlerts.filter(
    (a) => Date.now() - new Date(a.detected_at).getTime() < 86_400_000,
  ).length;

  const filteredAiAlerts = useMemo(
    () => (topic === "All" ? AI_ALERTS : AI_ALERTS.filter((a) => a.topics.includes(topic))),
    [topic],
  );
  const filteredNewsSources = useMemo(
    () => (topic === "All" ? NEWS_SOURCES : NEWS_SOURCES.filter((n) => n.topics.includes(topic))),
    [topic],
  );
  const filteredDbAlerts = useMemo(
    () =>
      topic === "All" ? dbAlerts : dbAlerts.filter((a) => inferAlertTopics(a).includes(topic)),
    [dbAlerts, topic],
  );

  return (
    <PageShell>
      <div className="space-y-4">
        {/* Breaking ticker */}
        <div className="rounded-xl border border-rose-500/30 bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              <span className="text-[10px] uppercase tracking-widest text-rose-300 font-semibold">
                Breaking
              </span>
            </div>
            <div className="overflow-hidden flex-1">
              <div className="whitespace-nowrap text-sm text-foreground/90 animate-[marquee_45s_linear_infinite]">
                Mpox Clade Ib genomic expansion confirmed in DRC · Marburg ring vaccination scaled
                in Rwanda · Cholera signal rising across Sudan IDP camps · AI co-pilot flagged H5N1
                reassortment event in Nigeria · WHO AFRO emergency briefing scheduled 14:00 UTC
              </div>
            </div>
          </div>
        </div>

        {/* Hero header */}
        <div className="rounded-2xl border border-border bg-gradient-to-br from-cyan-500/[0.06] to-emerald-500/[0.04] p-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-[11px] uppercase tracking-widest text-cyan-300 mb-3">
                <Radar className="w-3 h-3 animate-pulse" /> Intelligence Operations Center
              </div>
              <h1 className="text-3xl font-light tracking-tight">
                Live News & Genomic Intelligence
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Real-time outbreak intelligence, broadcast monitoring, and AI-generated situational
                summaries from across Africa and the world.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                {
                  i: AlertTriangle,
                  l: "Active alerts",
                  v: String(active24h || AI_ALERTS.length),
                  c: "#f87171",
                },
                { i: Globe2, l: "Countries", v: "54", c: "#22d3ee" },
                { i: Activity, l: "AI signals", v: "127", c: "#34d399" },
                { i: Tv, l: "Live feeds", v: String(STREAMS.length), c: "#a78bfa" },
              ].map(({ i: Icon, l, v, c }) => (
                <div
                  key={l}
                  className="rounded-lg border border-border bg-card/60 p-3 min-w-[110px]"
                >
                  <Icon className="w-3.5 h-3.5 mb-1.5" style={{ color: c }} />
                  <div className="text-xl font-semibold">{v}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Topic filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition ${
                topic === t
                  ? "bg-cyan-500/15 border-cyan-400/50 text-cyan-300"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 3-column command grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* LEFT — AI Surveillance Feed */}
          <section className="col-span-12 lg:col-span-3 rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <h2 className="text-sm font-medium">AI Surveillance Feed</h2>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
            <div className="divide-y divide-border/50 overflow-y-auto max-h-[720px]">
              {filteredAiAlerts.length === 0 && filteredDbAlerts.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">
                  No signals tagged "{topic}" right now.
                </div>
              )}
              {filteredAiAlerts.map((a, idx) => {
                const s = SEV[a.sev];
                return (
                  <article
                    key={idx}
                    className={`p-4 hover:bg-white/[0.03] transition cursor-pointer ring-inset ${s.ring}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                        style={{
                          background: `${s.color}22`,
                          color: s.color,
                          boxShadow: `inset 0 0 0 1px ${s.color}55`,
                        }}
                      >
                        {a.sev === "critical" && "🚨 "}
                        {s.label} RISK
                      </span>
                      <span className="text-[10px] text-muted-foreground">{a.time}</span>
                    </div>
                    <h3 className="text-sm font-semibold mb-1">{a.pathogen} Alert</h3>
                    <div className="text-[11px] text-muted-foreground mb-2">
                      <span className="text-foreground/80">Country:</span> {a.country}
                    </div>
                    <p className="text-xs text-foreground/75 leading-relaxed mb-2">{a.summary}</p>
                    <div className="text-[10px] text-muted-foreground italic">
                      Source: {a.source}
                    </div>
                  </article>
                );
              })}
              {filteredDbAlerts.slice(0, 30).map((a) => {
                const s = SEV[a.severity as keyof typeof SEV] ?? SEV.moderate;
                return (
                  <article key={a.id} className="p-4 hover:bg-white/[0.03] transition">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                        style={{ background: `${s.color}22`, color: s.color }}
                      >
                        {s.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(a.detected_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold mb-1">{a.title}</h3>
                    <div className="text-[11px] text-muted-foreground">
                      {a.country} · {a.pathogen}
                    </div>
                    {a.description && (
                      <p className="text-xs text-foreground/75 mt-2 leading-relaxed">
                        {a.description}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {/* CENTER — News Intelligence Wall */}
          <section className="col-span-12 lg:col-span-6 rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper className="w-4 h-4 text-emerald-300" />
                <h2 className="text-sm font-medium">News Intelligence Wall</h2>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Bot className="w-3 h-3 text-cyan-400" /> AI summaries every 30 min
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
                  Auto-refresh
                </span>
              </div>
            </div>

            {/* AI 30-min summary */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-cyan-500/[0.08] to-transparent">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-black" />
                </div>
                <div className="text-xs font-semibold">AI Situational Summary</div>
                <span className="text-[10px] text-muted-foreground">· updated 4 min ago</span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                Across the last 6 hours, the continent recorded{" "}
                <span className="text-rose-300 font-medium">3 critical</span> and{" "}
                <span className="text-amber-300 font-medium">5 elevated</span> signals. Mpox Clade
                Ib continues geographic expansion in central Africa, while Sudan cholera trajectory
                now exceeds the 14-day Bayesian baseline. AI confidence:{" "}
                <span className="text-emerald-300 font-medium">87%</span>.
              </p>
            </div>

            <div className="divide-y divide-border/50 overflow-y-auto max-h-[640px]">
              {filteredNewsSources.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">
                  No stories tagged "{topic}" right now.
                </div>
              )}
              {filteredNewsSources.map((n, idx) => (
                <article
                  key={idx}
                  className="p-4 hover:bg-white/[0.03] transition cursor-pointer flex gap-3"
                >
                  <div
                    className="w-1 self-stretch rounded-full shrink-0"
                    style={{ background: n.color, boxShadow: `0 0 8px ${n.color}` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[10px] uppercase tracking-wider font-semibold"
                        style={{ color: n.color }}
                      >
                        {n.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">· {n.time} ago</span>
                    </div>
                    <h3 className="text-sm font-medium mb-1 leading-snug">{n.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{n.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* RIGHT — Live broadcast monitoring */}
          <section className="col-span-12 lg:col-span-3 rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-300" />
                <h2 className="text-sm font-medium">Live Broadcast Monitoring</h2>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-rose-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> On-air
              </span>
            </div>
            <div className="p-3">
              <div className="aspect-video rounded-lg overflow-hidden border border-border bg-black mb-3 relative">
                <iframe
                  key={STREAMS[activeStream].id}
                  src={`https://www.youtube.com/embed/${STREAMS[activeStream].id}?autoplay=1&mute=1`}
                  title={STREAMS[activeStream].label}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="text-xs font-medium mb-1">{STREAMS[activeStream].label}</div>
              <div className="text-[10px] text-muted-foreground mb-3 flex items-center gap-3">
                <span>{STREAMS[activeStream].source}</span>
                <span>· {STREAMS[activeStream].viewers} watching</span>
              </div>
              <div className="space-y-1.5">
                {STREAMS.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveStream(idx)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition border ${
                      idx === activeStream
                        ? "bg-rose-500/10 border-rose-400/30 text-foreground"
                        : "border-border hover:bg-white/[0.03] text-muted-foreground"
                    }`}
                  >
                    <Play className={`w-3 h-3 ${idx === activeStream ? "text-rose-400" : ""}`} />
                    <span className="flex-1 truncate">{s.label}</span>
                    <span className="text-[10px]">{s.viewers}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border text-[10px] text-muted-foreground flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-400" />4 channels monitored · last refresh just
                now
              </div>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </PageShell>
  );
}
