import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";
import { ArtifactPage } from "@/components/shell/ArtifactPage";
import { PulsePage } from "@/components/shell/PulsePage";
import { SourcesPage } from "@/components/shell/SourcesPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<PulsePage />} />
        <Route path="/artifact/:artifactId" element={<ArtifactPage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
