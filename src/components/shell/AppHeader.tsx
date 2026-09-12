import { NavLink } from "react-router-dom";
import { ScanLine } from "lucide-react";
import type { DemoWorkspaceView } from "./useDemoWorkspace";

const NAV = [
  { to: "/setup", label: "Setup", end: true },
  { to: "/", label: "Pulse", end: true },
  { to: "/artifact/fixture_artifact_battlecard", label: "Artifact", end: false },
];

export function AppHeader({
  workspace,
  onRunScan,
}: {
  workspace: DemoWorkspaceView;
  onRunScan?: () => void;
}) {
  return (
    <header className="flex h-[var(--size-header)] shrink-0 items-center gap-[var(--space-4)] border-b border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)]">
      <p className="shrink-0 font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]">
        {workspace.companyName} · {workspace.planLabel} · {workspace.segment}
      </p>
      <nav aria-label="Primary" className="flex items-center gap-[var(--space-4)]">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive
                ? "font-[family-name:var(--font-sans)] text-[14px] font-[number:var(--weight-bold)] text-[var(--color-text)]"
                : "font-[family-name:var(--font-sans)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text-muted)]"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button
        type="button"
        disabled
        onClick={onRunScan}
        className="ml-auto inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-accent)] px-[var(--space-4)] py-[var(--space-2)] text-[18px] font-[number:var(--weight-bold)] text-white disabled:cursor-not-allowed"
      >
        <ScanLine aria-hidden="true" className="h-5 w-5" />
        Run Scan
      </button>
    </header>
  );
}
