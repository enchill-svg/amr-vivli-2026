import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const NCBI_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

type NcbiEsummaryRecord = {
  uid?: string;
  accessionversion?: string;
  caption?: string;
  title?: string;
  organism?: string;
  slen?: string | number;
  updatedate?: string;
  source?: string;
  fulljournalname?: string;
};

function withKey(url: string) {
  const key = process.env.NCBI_API_KEY;
  return key ? `${url}&api_key=${key}` : url;
}

// Search NCBI Nucleotide / Virus database for a pathogen, optionally country-scoped.
export const ncbiSearch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().min(1).max(200),
        db: z.enum(["nuccore", "protein", "pubmed"]).default("nuccore"),
        retmax: z.number().int().min(1).max(50).default(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const esearchUrl = withKey(
      `${NCBI_BASE}/esearch.fcgi?db=${data.db}&term=${encodeURIComponent(
        data.query,
      )}&retmax=${data.retmax}&retmode=json&sort=relevance`,
    );

    const esearchRes = await fetch(esearchUrl, {
      headers: { "User-Agent": "AMR-Life-Expectancy-Intelligence/1.0" },
    });
    if (!esearchRes.ok) {
      return { ids: [], summaries: [], error: `NCBI esearch failed (${esearchRes.status})` };
    }
    const esearch = (await esearchRes.json()) as {
      esearchresult?: { idlist?: string[]; count?: string };
    };
    const ids = esearch.esearchresult?.idlist ?? [];
    if (!ids.length) return { ids: [], summaries: [], total: 0 };

    const esummaryUrl = withKey(
      `${NCBI_BASE}/esummary.fcgi?db=${data.db}&id=${ids.join(",")}&retmode=json`,
    );
    const esumRes = await fetch(esummaryUrl, {
      headers: { "User-Agent": "AMR-Life-Expectancy-Intelligence/1.0" },
    });
    if (!esumRes.ok) {
      return { ids, summaries: [], error: `NCBI esummary failed (${esumRes.status})` };
    }
    const esum = (await esumRes.json()) as { result?: Record<string, NcbiEsummaryRecord> };
    const result = esum.result ?? {};
    const summaries = ids
      .map((id) => result[id])
      .filter(Boolean)
      .map((r: NcbiEsummaryRecord) => ({
        uid: r.uid as string,
        accession: (r.accessionversion ?? r.caption ?? r.uid) as string,
        title: (r.title ?? "") as string,
        organism: (r.organism ?? "") as string,
        length: Number(r.slen ?? 0),
        update_date: (r.updatedate ?? "") as string,
        source: (r.source ?? r.fulljournalname ?? "") as string,
      }));

    return {
      ids,
      summaries,
      total: Number(esearch.esearchresult?.count ?? ids.length),
    };
  });

// Fetch a single FASTA sequence for a given NCBI accession.
export const ncbiFetchFasta = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().min(1).max(64),
        db: z.enum(["nuccore", "protein"]).default("nuccore"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const url = withKey(
      `${NCBI_BASE}/efetch.fcgi?db=${data.db}&id=${encodeURIComponent(
        data.id,
      )}&rettype=fasta&retmode=text`,
    );
    const res = await fetch(url, {
      headers: { "User-Agent": "AMR-Life-Expectancy-Intelligence/1.0" },
    });
    if (!res.ok) {
      return { fasta: "", error: `NCBI efetch failed (${res.status})` };
    }
    const fasta = await res.text();
    return { fasta };
  });

// Weekly outbreak/lineage summary — counts of recent NCBI submissions per pathogen.
// Combines NCBI Virus + EBI ENA presence checks.
export const weeklyOutbreakSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        pathogens: z.array(z.string().min(1)).min(1).max(20),
        days: z.number().int().min(1).max(60).default(7),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const since = new Date(Date.now() - data.days * 86400_000);
    const yyyymmdd = (d: Date) =>
      `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    const dateRange = `${yyyymmdd(since)}:${yyyymmdd(new Date())}[PDAT]`;

    const results = await Promise.all(
      data.pathogens.map(async (p) => {
        const term = `${p}[Organism] AND ${dateRange}`;
        const url = withKey(
          `${NCBI_BASE}/esearch.fcgi?db=nuccore&term=${encodeURIComponent(term)}&retmode=json&retmax=0`,
        );
        try {
          const r = await fetch(url, {
            headers: { "User-Agent": "AMR-Life-Expectancy-Intelligence/1.0" },
          });
          if (!r.ok) return { pathogen: p, count: 0, error: `HTTP ${r.status}` };
          const j = (await r.json()) as { esearchresult?: { count?: string } };
          return { pathogen: p, count: Number(j.esearchresult?.count ?? 0) };
        } catch (e) {
          return { pathogen: p, count: 0, error: e instanceof Error ? e.message : "fetch failed" };
        }
      }),
    );

    return {
      generated_at: new Date().toISOString(),
      window_days: data.days,
      sources: ["NCBI Nucleotide (Entrez)"],
      results: results.sort((a, b) => b.count - a.count),
    };
  });
