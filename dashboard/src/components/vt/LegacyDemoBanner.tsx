import { AlertTriangle } from "lucide-react";

export function LegacyDemoBanner({ detail }: { detail?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <p className="text-xs text-amber-100/90 leading-relaxed">
        <span className="font-semibold text-amber-300">Legacy demo page.</span> Retained from an
        earlier product direction (wastewater / viral genomic surveillance) and{" "}
        <span className="font-medium">
          not part of the Vivli 2026 AMR Surveillance Data Challenge submission.
        </span>{" "}
        {detail ? `${detail} ` : ""}
        Figures shown here are illustrative only, not derived from this submission's AMR pipeline.
      </p>
    </div>
  );
}
