export type Level = "low" | "medium" | "high" | "critical";
export type SignalStatus =
  | "detected" | "verifying" | "verified" | "assessed" | "recommendations_ready"
  | "action_selected" | "artifact_generated" | "resolved" | "low_confidence" | "error";

export type BlockType =
  | "SignalCard" | "DiffView" | "EvidenceCard" | "MetricCards" | "RecommendationCards"
  | "SourceList" | "Timeline" | "Chart" | "FeatureMatrix" | "ActionPreview" | "DataGrid" | "GeoMap";

export type UiBlock = { id: string; type: BlockType; props: Record<string, string> };

export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: T };
