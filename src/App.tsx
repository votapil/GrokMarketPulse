import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";
import { ArtifactScreen } from "@/screens/ArtifactScreen";
import { SourcesScreen } from "@/screens/SourcesScreen";

function PulseRoute() {
  // Track A owns src/screens/PulseScreen.tsx — import it when it lands on main.
  return <div>{/* TODO: src/screens/PulseScreen.tsx (track A) */}</div>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<PulseRoute />} />
        <Route path="/artifact/:artifactId" element={<ArtifactScreen />} />
        <Route path="/sources" element={<SourcesScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
