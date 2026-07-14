import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NCBI_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function withKey(url: string) {
  const key = process.env.NCBI_API_KEY;
  return key ? `${url}&api_key=${key}` : url;
}

export const importNcbiHit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        uid: z.string().min(1).max(64),
        accession: z.string().min(1).max(64),
        organism: z.string().max(256).default(""),
        title: z.string().max(1024).default(""),
        length: z.number().int().min(0).max(5_000_000).default(0),
        pathogen: z.string().min(1).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch FASTA so we can store length / use as preview later.
    const url = withKey(
      `${NCBI_BASE}/efetch.fcgi?db=nuccore&id=${encodeURIComponent(data.uid)}&rettype=fasta&retmode=text`,
    );
    const res = await fetch(url, { headers: { "User-Agent": "ViralTrack-Afrika/1.0" } });
    let fasta = "";
    if (res.ok) fasta = await res.text();

    const seqBp = fasta
      ? fasta
          .split("\n")
          .filter((l) => l && !l.startsWith(">"))
          .join("").length
      : data.length;

    const { data: row, error } = await supabase
      .from("sequences")
      .insert({
        accession: data.accession,
        pathogen: data.pathogen,
        lineage: data.organism || null,
        length_bp: seqBp || null,
        quality_score: 0.95,
        sequenced_at: new Date().toISOString(),
        created_by: userId,
      })
      .select()
      .single();

    if (error) return { ok: false, error: error.message };

    return { ok: true, id: row.id, length_bp: seqBp };
  });
