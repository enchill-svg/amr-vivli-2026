import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Mail, MessageSquare, Smartphone, Moon, Globe, Plus, X, Save } from "lucide-react";
import { PageShell, SectionCard } from "@/components/vt/PageShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/notifications")({
  component: NotificationPrefsPage,
  head: () => ({
    meta: [
      { title: "Notification Preferences — ViralTrack-Afrika" },
      { name: "description", content: "Channels, quiet hours, and subscriptions." },
    ],
  }),
});

type Prefs = {
  channels: { inApp: boolean; email: boolean; sms: boolean; push: boolean };
  email: string;
  phone: string;
  quietHours: { enabled: boolean; start: string; end: string; tz: string };
  severityFloor: "low" | "moderate" | "high" | "critical";
  outbreaks: string[];
  regions: string[];
  digest: "off" | "daily" | "weekly";
};

const STORAGE = "vt.notif.prefs";
const ALL_PATHOGENS = [
  "SARS-CoV-2",
  "Mpox",
  "Ebola",
  "Marburg",
  "Cholera",
  "Lassa",
  "RVF",
  "H5N1",
  "Yellow Fever",
  "Dengue",
];
const ALL_REGIONS = [
  "West Africa",
  "East Africa",
  "Central Africa",
  "Southern Africa",
  "North Africa",
  "Horn of Africa",
  "Sahel",
];

const DEFAULTS: Prefs = {
  channels: { inApp: true, email: true, sms: false, push: false },
  email: "",
  phone: "",
  quietHours: { enabled: true, start: "22:00", end: "06:30", tz: "Africa/Lagos" },
  severityFloor: "high",
  outbreaks: ["Mpox", "Cholera", "Ebola"],
  regions: ["West Africa", "Central Africa"],
  digest: "daily",
};

function NotificationPrefsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  function save() {
    localStorage.setItem(STORAGE, JSON.stringify(prefs));
    toast.success("Notification preferences saved");
  }

  function toggleArr(key: "outbreaks" | "regions", v: string) {
    setPrefs((p) => ({
      ...p,
      [key]: p[key].includes(v) ? p[key].filter((x) => x !== v) : [...p[key], v],
    }));
  }

  return (
    <PageShell>
      <div className="space-y-5 max-w-5xl mx-auto">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-[color:var(--accent)]" />
            <div>
              <h1 className="text-2xl font-light tracking-tight">Notification Preferences</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Channels, quiet hours, and outbreak/region subscriptions
              </p>
            </div>
          </div>
          <Button onClick={save}>
            <Save className="w-4 h-4" /> Save preferences
          </Button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Delivery channels" subtitle="Pick how you want to be reached.">
            <div className="space-y-3">
              <ChannelRow
                icon={Bell}
                label="In-app notifications"
                desc="Live bell + alert center stream"
                checked={prefs.channels.inApp}
                onChange={(v) => setPrefs((p) => ({ ...p, channels: { ...p.channels, inApp: v } }))}
              />
              <ChannelRow
                icon={Mail}
                label="Email"
                desc="Summarized digests + critical alerts"
                checked={prefs.channels.email}
                onChange={(v) => setPrefs((p) => ({ ...p, channels: { ...p.channels, email: v } }))}
              >
                {prefs.channels.email && (
                  <Input
                    placeholder="you@institution.org"
                    value={prefs.email}
                    onChange={(e) => setPrefs((p) => ({ ...p, email: e.target.value }))}
                    className="mt-2 h-8 text-xs"
                  />
                )}
              </ChannelRow>
              <ChannelRow
                icon={MessageSquare}
                label="SMS"
                desc="Critical alerts only, charges may apply"
                checked={prefs.channels.sms}
                onChange={(v) => setPrefs((p) => ({ ...p, channels: { ...p.channels, sms: v } }))}
              >
                {prefs.channels.sms && (
                  <Input
                    placeholder="+234 ..."
                    value={prefs.phone}
                    onChange={(e) => setPrefs((p) => ({ ...p, phone: e.target.value }))}
                    className="mt-2 h-8 text-xs"
                  />
                )}
              </ChannelRow>
              <ChannelRow
                icon={Smartphone}
                label="Push (mobile)"
                desc="ViralTrack mobile app push notifications"
                checked={prefs.channels.push}
                onChange={(v) => setPrefs((p) => ({ ...p, channels: { ...p.channels, push: v } }))}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Quiet hours"
            subtitle="Suppress non-critical alerts during these hours. Critical outbreaks always alert."
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Moon className="w-4 h-4 text-[color:var(--accent)]" /> Enable quiet hours
                </div>
                <Switch
                  checked={prefs.quietHours.enabled}
                  onCheckedChange={(v) =>
                    setPrefs((p) => ({ ...p, quietHours: { ...p.quietHours, enabled: v } }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Start</Label>
                  <Input
                    type="time"
                    value={prefs.quietHours.start}
                    disabled={!prefs.quietHours.enabled}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        quietHours: { ...p.quietHours, start: e.target.value },
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">End</Label>
                  <Input
                    type="time"
                    value={prefs.quietHours.end}
                    disabled={!prefs.quietHours.enabled}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        quietHours: { ...p.quietHours, end: e.target.value },
                      }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Timezone
                </Label>
                <Input
                  value={prefs.quietHours.tz}
                  disabled={!prefs.quietHours.enabled}
                  onChange={(e) =>
                    setPrefs((p) => ({
                      ...p,
                      quietHours: { ...p.quietHours, tz: e.target.value },
                    }))
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">
                  Minimum severity to break quiet hours
                </Label>
                <div className="grid grid-cols-4 gap-1 mt-1">
                  {(["low", "moderate", "high", "critical"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setPrefs((p) => ({ ...p, severityFloor: s }))}
                      className={`text-[11px] py-1.5 rounded-md border capitalize ${
                        prefs.severityFloor === s
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
                          : "border-border bg-background/40 text-muted-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Outbreak subscriptions"
            subtitle="Pick which pathogens you want alerts for."
          >
            <ChipPicker
              all={ALL_PATHOGENS}
              selected={prefs.outbreaks}
              onToggle={(v) => toggleArr("outbreaks", v)}
            />
          </SectionCard>

          <SectionCard
            title="Region subscriptions"
            subtitle="Geographic scope for outbreak + signal alerts."
          >
            <ChipPicker
              all={ALL_REGIONS}
              selected={prefs.regions}
              onToggle={(v) => toggleArr("regions", v)}
            />
            <div className="mt-5 pt-4 border-t border-border/60">
              <Label className="text-[11px] text-muted-foreground">Summary digest</Label>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {(["off", "daily", "weekly"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setPrefs((p) => ({ ...p, digest: d }))}
                    className={`text-[11px] py-1.5 rounded-md border capitalize ${
                      prefs.digest === d
                        ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
                        : "border-border bg-background/40 text-muted-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  );
}

function ChannelRow({
  icon: Icon,
  label,
  desc,
  checked,
  onChange,
  children,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 rounded-md bg-[color:var(--accent)]/15 text-[color:var(--accent)] p-1.5">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">{label}</div>
            <div className="text-[11px] text-muted-foreground">{desc}</div>
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
      {children}
    </div>
  );
}

function ChipPicker({
  all,
  selected,
  onToggle,
}: {
  all: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((v) => {
        const on = selected.includes(v);
        return (
          <button
            key={v}
            onClick={() => onToggle(v)}
            className={`text-[11px] px-2.5 py-1 rounded-full border inline-flex items-center gap-1 transition-colors ${
              on
                ? "border-[color:var(--accent)] bg-[color:var(--accent)]/15 text-[color:var(--accent)]"
                : "border-border bg-background/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {on ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
            {v}
          </button>
        );
      })}
    </div>
  );
}
