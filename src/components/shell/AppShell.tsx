import { Outlet } from "react-router-dom";
import { AppHeader } from "./AppHeader";
import { useDemoWorkspace } from "./useDemoWorkspace";

const FALLBACK = {
  companyName: "Helpdesk AI",
  planLabel: "…",
  segment: "…",
  competitorName: "AcmeFlow",
  fromConvex: false,
};

export function AppShell() {
  const workspace = useDemoWorkspace();
  const header =
    workspace.kind === "ready" ? workspace.data : FALLBACK;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <AppHeader workspace={header} />
      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
