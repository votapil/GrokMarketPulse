import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";
import { ArtifactScreen } from "@/screens/ArtifactScreen";
import { PulseScreen } from "@/screens/PulseScreen";
import { SourcesScreen } from "@/screens/SourcesScreen";

/**
 * App routes. Entry: main.tsx. `/` mounts track A PulseScreen.
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
