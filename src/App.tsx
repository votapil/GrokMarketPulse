import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";
import { ArtifactScreen } from "@/screens/ArtifactScreen";
import { PulseScreen } from "@/screens/PulseScreen";
import { SourcesScreen } from "@/screens/SourcesScreen";

/**
 * App routes. Entry: main.tsx. `/` mounts track A PulseScreen (B T-05 left TODO;
 * A fills it as part of T-15 contract after handoff).
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<PulseScreen />} />
        <Route path="/artifact/:artifactId" element={<ArtifactScreen />} />
        <Route path="/sources" element={<SourcesScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
