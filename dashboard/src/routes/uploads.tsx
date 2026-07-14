import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Download, Trash2, FolderUp } from "lucide-react";
import { PageShell, SectionCard } from "@/components/vt/PageShell";
import { AuthGate } from "@/components/vt/AuthGate";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/uploads")({
  component: UploadsPage,
  head: () => ({
    meta: [
      { title: "My Data — ViralTrack-Afrika" },
      {
        name: "description",
        content: "Securely upload and manage your private genomic datasets, trees, and metadata.",
      },
    ],
  }),
});

function UploadsPage() {
  return (
    <PageShell showTabs={false}>
      <div className="max-w-4xl mx-auto space-y-5">
        <header className="flex items-center gap-3">
          <FolderUp className="w-6 h-6 text-[color:var(--accent)]" />
          <div>
            <h1 className="text-2xl font-light tracking-tight">My Data</h1>
            <p className="text-xs text-muted-foreground">
              Private workspace — only you can see, download or delete these files.
            </p>
          </div>
        </header>
        <AuthGate>
          <UploadsBody />
        </AuthGate>
      </div>
    </PageShell>
  );
}

function UploadsBody() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const prefix = user!.id;

  const { data: files = [], isLoading } = useQuery({
    queryKey: ["uploads", prefix],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("user-uploads").list(prefix, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setErr(null);
    const path = `${prefix}/${Date.now()}_${f.name}`;
    const { error } = await supabase.storage.from("user-uploads").upload(path, f);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    e.target.value = "";
    qc.invalidateQueries({ queryKey: ["uploads", prefix] });
  }

  async function onDownload(name: string) {
    const { data, error } = await supabase.storage
      .from("user-uploads")
      .createSignedUrl(`${prefix}/${name}`, 60);
    if (error) {
      setErr(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function onDelete(name: string) {
    if (!confirm(`Delete ${name}?`)) return;
    const { error } = await supabase.storage.from("user-uploads").remove([`${prefix}/${name}`]);
    if (error) {
      setErr(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["uploads", prefix] });
  }

  return (
    <SectionCard
      title="Your dataset library"
      subtitle="Upload FASTA, FASTQ, Newick (.nwk), CSV, JSON or PDF — up to 50 MB per file."
      action={
        <>
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={onUpload}
            accept=".fasta,.fa,.fastq,.fq,.nwk,.tree,.newick,.csv,.tsv,.json,.pdf,.txt"
          />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="w-4 h-4" /> {busy ? "Uploading…" : "Upload"}
          </Button>
        </>
      }
    >
      {err && <div className="mb-3 text-xs text-[color:var(--status-alert)]">{err}</div>}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No files yet. Upload your first dataset to keep it private and tied to your account.
        </p>
      ) : (
        <ul className="divide-y divide-border/50">
          {files
            .filter((f) => f.name !== ".emptyFolderPlaceholder")
            .map((f) => (
              <li key={f.id ?? f.name} className="flex items-center gap-3 py-2.5 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{f.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {f.metadata?.size ? `${(f.metadata.size / 1024).toFixed(1)} KB · ` : ""}
                    {f.created_at && new Date(f.created_at).toLocaleString()}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onDownload(f.name)}>
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(f.name)}>
                  <Trash2 className="w-4 h-4 text-[color:var(--status-alert)]" />
                </Button>
              </li>
            ))}
        </ul>
      )}
    </SectionCard>
  );
}
