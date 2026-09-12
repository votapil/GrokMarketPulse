import { useCallback, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { AlertTriangle, Building2, RefreshCw, ScanSearch } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";

/**
 * T-39: точка входа «моя компания» — одна полоса сверху Pulse, не визард.
 * Поле предзаполнено companies.url из демо-воркспейса: ноль обязательного ввода,
 * результат виден до любого действия. Analyze → api.onboarding.analyze,
 * прогресс читается из companies.contextStatus реактивно, экран не блокируется.
 * Callers: PulseScreen (первая строка экрана).
 */

type Company = Doc<"companies">;
type CompanyContext = NonNullable<Company["context"]>;
type Plan = CompanyContext["plans"][number];
type BarState = "loading" | "empty" | "pending" | "ready" | "error";

const outlineButton = cn(
  "inline-flex shrink-0 items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--palette-recessed)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/** Валидация на границе: пускаем только http(s) и хост с точкой. */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (!parsed.hostname.includes(".")) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Основной тариф: сперва Pro с ценой, иначе первый платный, иначе первый вообще. */
function primaryPlan(plans: readonly Plan[]): Plan | null {
  const priced = plans.filter((plan) => plan.usd !== null);
  const pro = priced.find((plan) => /pro/i.test(plan.name));
  return pro ?? priced[0] ?? plans[0] ?? null;
}

/** «Helpdesk AI · Pro $45 · SMB» — название, тариф, сегмент. */
function contextSummary(company: Company): string | null {
  const context = company.context;
  if (!context) {
    return null;
  }

  const parts: string[] = [
    company.name || context.keyProducts[0] || context.category,
  ];
  const plan = primaryPlan(context.plans);
  if (plan) {
    parts.push(plan.usd !== null ? `${plan.name} $${plan.usd}` : plan.name);
  }
  const segment = context.targetSegments[0];
  if (segment) {
    parts.push(segment);
  }

  return parts.filter((part) => part.length > 0).join(" · ");
}

function PlaqueShell({
  children,
  dashed = false,
  accent = false,
}: {
  children: React.ReactNode;
  dashed?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-w-0 items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)]",
        accent
          ? "border-[var(--palette-accent)] bg-[var(--color-surface)]"
          : dashed
            ? "border-dashed border-[var(--color-border)] bg-[var(--color-surface)]"
            : "border-[var(--color-border)] bg-[var(--color-surface)]",
      )}
    >
      {children}
    </div>
  );
}

function PlaqueSkeleton({ label }: { label: string }) {
  return (
    <PlaqueShell dashed>
      <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </span>
      <span
        className="h-3 w-[180px] animate-pulse rounded bg-[var(--palette-border)]"
        aria-hidden
      />
    </PlaqueShell>
  );
}

export function CompanyBar() {
  const demo = useQuery(api.workspace.demo);
  const analyze = useAction(api.onboarding.analyze);

  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const company = demo?.company ?? null;
  // Пока пользователь не печатал — показываем companies.url как есть.
  const url = draftUrl ?? company?.url ?? "";
  const competitorUrls = demo?.competitors.map((competitor) => competitor.url) ?? [];

  const handleAnalyze = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    const companyUrl = normalizeUrl(url);
    if (companyUrl === null) {
      setSubmitError("Enter a site like helpdesk-ai.example");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    void analyze({ companyUrl, competitorUrls })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Analyze failed to start";
        setSubmitError(message);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  }, [analyze, competitorUrls, isSubmitting, url]);

  const state: BarState =
    demo === undefined
      ? "loading"
      : isSubmitting || company?.contextStatus === "pending"
        ? "pending"
        : submitError !== null || company?.contextStatus === "error"
          ? "error"
          : company && company.context && company.contextStatus === "ready"
            ? "ready"
            : "empty";

  const summary = company ? contextSummary(company) : null;
  const errorMessage = submitError ?? company?.error ?? "Could not read your site";

  return (
    <section
      className="flex shrink-0 flex-wrap items-center gap-x-[var(--space-4)] gap-y-[var(--space-2)] border-b border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-4)] py-[var(--space-2)]"
      aria-label="Your company"
    >
      <form
        className="flex min-w-0 flex-1 items-center gap-[var(--space-2)]"
        onSubmit={(event) => {
          event.preventDefault();
          handleAnalyze();
        }}
      >
        <label
          htmlFor="company-url-input"
          className="flex shrink-0 items-center gap-[var(--space-2)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]"
        >
          <Building2 className="h-4 w-4" aria-hidden />
          Your company
        </label>
        <input
          id="company-url-input"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          value={url}
          placeholder="helpdesk-ai.example"
          onChange={(event) => setDraftUrl(event.target.value)}
          className={cn(
            "min-w-0 max-w-[320px] flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--palette-recessed)] px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]",
          )}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className={outlineButton}
        >
          <ScanSearch className="h-3.5 w-3.5" aria-hidden />
          {isSubmitting ? "Analyzing…" : "Analyze"}
        </button>
      </form>

      {state === "loading" ? <PlaqueSkeleton label="Context" /> : null}

      {state === "pending" ? <PlaqueSkeleton label="Analyzing" /> : null}

      {state === "empty" ? (
        <PlaqueShell dashed>
          <span className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--color-text-muted)]">
            Analyze your site to personalize signals
          </span>
        </PlaqueShell>
      ) : null}

      {state === "ready" && summary ? (
        <PlaqueShell>
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-[var(--palette-ok)]"
            aria-hidden
          />
          <span className="truncate font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]">
            {summary}
          </span>
        </PlaqueShell>
      ) : null}

      {state === "error" ? (
        <PlaqueShell accent>
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]"
            aria-hidden
          />
          <span className="truncate font-[family-name:var(--font-sans)] text-[13px] text-[var(--color-text)]">
            {errorMessage}
          </span>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isSubmitting}
            className={cn(outlineButton, "ml-[var(--space-2)] py-[var(--space-1)]")}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </PlaqueShell>
      ) : null}
    </section>
  );
}
