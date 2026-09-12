import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { AppShell } from "@/components/shell/AppShell";
import { ArtifactScreen } from "@/screens/ArtifactScreen";
import { PulseScreen } from "@/screens/PulseScreen";
import { SourcesScreen } from "@/screens/SourcesScreen";
import { Skeleton } from "@/components/state/Skeleton";

function PulseGate() {
  const hasDemo = useQuery(api.workspace.hasDemo);
  if (hasDemo === undefined) {
    return (
      <div className="p-[var(--space-6)]">
        <Skeleton label="Loading workspace" />
      </div>
    );
  }
  if (!hasDemo) {
    return <Navigate to="/setup" replace />;
  }
  return <PulseScreen />;
}

/**
 * App routes. Entry: main.tsx. `/` mounts track A PulseScreen when demo exists.
 * `/` → `/setup` only when slug `demo` is missing entirely.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<PulseGate />} />
        <Route path="/artifact/:artifactId" element={<ArtifactScreen />} />
        <Route path="/setup" element={<SourcesScreen />} />
        <Route path="/sources" element={<Navigate to="/setup" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
