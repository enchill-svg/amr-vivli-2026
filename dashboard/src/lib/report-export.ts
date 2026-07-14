// Real PDF / Word (.docx) / CSV / Excel (.xlsx) generation for the Reports page.
// PDF uses jspdf + jspdf-autotable, Word uses `docx`, Excel uses `write-excel-file`,
// CSV is hand-rolled (RFC 4180 quoting). All four run entirely client-side against
// whatever section data the caller passes in — no fabricated content.

const REPORT_FOOTER =
  "AMR Life Expectancy Intelligence — Vivli AMR Surveillance Data Challenge 2026";

export type ExportSection =
  | { title: string; kind: "table"; rows: Record<string, unknown>[] }
  | { title: string; kind: "fields"; fields: Record<string, unknown> };

const FRIENDLY_TITLES: Record<string, string> = {
  bundle_version: "Bundle Version",
  generated_at: "Generated At",
  pipeline_run: "Pipeline Run",
  pipelineSummary: "Pipeline Summary",
  countryRiskBacterial: "Country Risk — Bacterial",
  countryRiskFungal: "Country Risk — Fungal",
  clusterTypologyBacterial: "Cluster Typology — Bacterial",
  clusterTypologyFungal: "Cluster Typology — Fungal",
  interventions: "Interventions",
  fundingGap: "Funding Gap Analysis",
  gatingComparison: "Gating Comparison",
  identifiabilityLedger: "Identifiability Ledger",
  q2DriverSummary: "Q2 Driver Summary",
  associationSensitivity: "Association Sensitivity",
  deliverablesIndex: "Deliverables Index",
};

export function friendlyTitle(key: string): string {
  if (FRIENDLY_TITLES[key]) return FRIENDLY_TITLES[key];
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function buildSections(data: Record<string, unknown>): ExportSection[] {
  const sections: ExportSection[] = [];
  for (const [key, value] of Object.entries(data)) {
    const title = friendlyTitle(key);
    if (Array.isArray(value)) {
      sections.push({ title, kind: "table", rows: value as Record<string, unknown>[] });
    } else if (value && typeof value === "object") {
      sections.push({ title, kind: "fields", fields: value as Record<string, unknown> });
    } else {
      sections.push({ title, kind: "fields", fields: { [title]: value } });
    }
  }
  return sections;
}

export function countRecords(sections: ExportSection[]): number {
  return sections.reduce((n, s) => n + (s.kind === "table" ? s.rows.length : 0), 0);
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "—";
    return Number.isInteger(v) ? String(v) : trimFloat(v);
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function trimFloat(v: number): string {
  return v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function toCellValue(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") return v;
  return JSON.stringify(v);
}

function tableColumns(rows: Record<string, unknown>[]): string[] {
  const cols = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) cols.add(k);
  return [...cols];
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- PDF ----------

export async function exportSectionsToPdf(docTitle: string, sections: ExportSection[]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(docTitle, margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Generated ${new Date().toISOString()} · ${REPORT_FOOTER}`, margin, y);
  doc.setTextColor(20);
  y += 16;
  doc.setDrawColor(190);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  for (const section of sections) {
    if (y > pageHeight - 100) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(section.title, margin, y);
    y += 6;

    if (section.kind === "table") {
      if (section.rows.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        y += 14;
        doc.text("No records in this dataset.", margin, y);
        y += 18;
        continue;
      }
      const columns = tableColumns(section.rows);
      autoTable(doc, {
        startY: y + 6,
        margin: { left: margin, right: margin, bottom: 30 },
        head: [columns.map((c) => friendlyTitle(c))],
        body: section.rows.map((r) => columns.map((c) => formatCell(r[c]))),
        styles: {
          fontSize: 6.5,
          cellPadding: 2.5,
          overflow: "linebreak",
          lineColor: [210, 214, 219],
          lineWidth: 0.5,
        },
        headStyles: { fillColor: [12, 74, 110], textColor: 255, fontStyle: "bold", fontSize: 6.5 },
        alternateRowStyles: { fillColor: [242, 247, 250] },
        theme: "grid",
        horizontalPageBreak: true,
        horizontalPageBreakBehaviour: "afterAllRows",
      });
      const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
      y = (lastTable?.finalY ?? y + 6) + 18;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      y += 14;
      for (const [k, v] of Object.entries(section.fields)) {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(`${friendlyTitle(k)}:  ${formatCell(v)}`, margin, y);
        y += 13;
      }
      y += 10;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: "right" });
  }

  doc.save(`${slugify(docTitle)}.pdf`);
}

// ---------- Word (.docx) ----------

export async function exportSectionsToDocx(docTitle: string, sections: ExportSection[]) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ShadingType,
    VerticalAlign,
    PageOrientation,
  } = await import("docx");

  type Block = InstanceType<typeof Paragraph> | InstanceType<typeof Table>;
  const children: Block[] = [];

  children.push(
    new Paragraph({ text: docTitle, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated ${new Date().toISOString()} · ${REPORT_FOOTER}`,
          italics: true,
          size: 18,
          color: "666666",
        }),
      ],
      spacing: { after: 300 },
    }),
  );

  for (const section of sections) {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
      }),
    );

    if (section.kind === "table") {
      if (section.rows.length === 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: "No records in this dataset.", italics: true })],
          }),
        );
        continue;
      }
      const columns = tableColumns(section.rows);
      const headerRow = new TableRow({
        tableHeader: true,
        children: columns.map(
          (c) =>
            new TableCell({
              shading: { fill: "0C4A6E", type: ShadingType.CLEAR, color: "auto" },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 60, bottom: 60, left: 80, right: 80 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: friendlyTitle(c), bold: true, color: "FFFFFF", size: 16 }),
                  ],
                }),
              ],
            }),
        ),
      });
      const bodyRows = section.rows.map(
        (r, i) =>
          new TableRow({
            children: columns.map(
              (c) =>
                new TableCell({
                  shading:
                    i % 2 === 1
                      ? { fill: "F2F7FA", type: ShadingType.CLEAR, color: "auto" }
                      : undefined,
                  margins: { top: 50, bottom: 50, left: 80, right: 80 },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: formatCell(r[c]), size: 16 })],
                    }),
                  ],
                }),
            ),
          }),
      );
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...bodyRows],
        }),
        new Paragraph({ text: "", spacing: { after: 200 } }),
      );
    } else {
      for (const [k, v] of Object.entries(section.fields)) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${friendlyTitle(k)}:  `, bold: true }),
              new TextRun({ text: formatCell(v) }),
            ],
            spacing: { after: 60 },
          }),
        );
      }
      children.push(new Paragraph({ text: "", spacing: { after: 160 } }));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${slugify(docTitle)}.docx`);
}

// ---------- CSV ----------

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function sectionToCsvBlock(section: ExportSection): string {
  const lines: string[] = [`# ${section.title}`];
  if (section.kind === "table") {
    if (section.rows.length === 0) {
      lines.push("(no records)");
    } else {
      const columns = tableColumns(section.rows);
      lines.push(columns.map((c) => csvEscape(friendlyTitle(c))).join(","));
      for (const row of section.rows) {
        lines.push(columns.map((c) => csvEscape(formatCell(row[c]))).join(","));
      }
    }
  } else {
    lines.push("Field,Value");
    for (const [k, v] of Object.entries(section.fields)) {
      lines.push(`${csvEscape(friendlyTitle(k))},${csvEscape(formatCell(v))}`);
    }
  }
  return lines.join("\r\n");
}

export function exportSectionsToCsv(docTitle: string, sections: ExportSection[]) {
  const blockText = sections.map(sectionToCsvBlock).join("\r\n\r\n");
  const blob = new Blob([blockText], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${slugify(docTitle)}.csv`);
}

// ---------- Excel (.xlsx) ----------

function uniqueSheetName(base: string, used: Set<string>): string {
  const clean = base.replace(/[\\/*?:[\]]/g, " ").trim() || "Sheet";
  let name = clean.slice(0, 31);
  let i = 2;
  while (used.has(name)) {
    const suffix = ` (${i})`;
    name = `${clean.slice(0, 31 - suffix.length)}${suffix}`;
    i++;
  }
  used.add(name);
  return name;
}

export async function exportSectionsToXlsx(docTitle: string, sections: ExportSection[]) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");

  const usedNames = new Set<string>();
  const sheets = sections.map((section) => {
    const rows: (string | number | boolean | null)[][] = [];
    if (section.kind === "table") {
      const columns = tableColumns(section.rows);
      rows.push(columns.map((c) => friendlyTitle(c)));
      if (section.rows.length === 0) {
        rows.push(["(no records)"]);
      } else {
        for (const r of section.rows) {
          rows.push(columns.map((c) => toCellValue(r[c])));
        }
      }
    } else {
      rows.push(["Field", "Value"]);
      for (const [k, v] of Object.entries(section.fields)) {
        rows.push([friendlyTitle(k), toCellValue(v)]);
      }
    }
    return {
      sheet: uniqueSheetName(section.title, usedNames),
      data: rows,
    };
  });

  await writeXlsxFile(sheets).toFile(`${slugify(docTitle)}.xlsx`);
}
