import { AlertTriangle } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <div
      className="flex items-center gap-2 border-b border-[hsl(var(--band-high))]/30 bg-[hsl(var(--band-high))]/10 px-4 py-2"
      data-testid="banner-disclaimer"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--band-high))]" />
      <p className="text-xs font-medium text-foreground leading-snug">
        Internal triage tool only. Not legal advice, not an insurance recommendation, not for client-facing use.
        Every score requires sign-off from IP counsel and a licensed insurance broker before any publishing decision.
      </p>
    </div>
  );
}
