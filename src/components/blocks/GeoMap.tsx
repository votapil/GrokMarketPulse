import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useAction, useQuery } from "convex/react";
import { MapPin } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { LoadState } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ScopeCandidate } from "./CompetitorScope";
import { BlockErrorRetry } from "./DataGrid";
import { BlockLoading, BlockShell, type BlockComponentProps } from "./registry";

/**
 * T-36 · GeoMap — schematic competitor map around the signal.
 *
 * The data has no coordinates (competitors carry name/url/kind/summary only),
 * so the map is a radar-style diagram: our business sits at the center, the
 * dashed ring is the current radius, and each competitor is placed on its
 * `distanceKm` along a deterministic bearing (golden-angle spread by distance
 * rank). Nothing here is geographic.
 *
 * Mirrors the T-40 CompetitorScope contract: same fixtures, same radius
 * constants, same `update_radius` event to `api.uiEvents.send` with payload
 * `JSON.stringify({ radius_km, signalId })` (the server reads `radius_km`).
 * CompetitorScope stays the source of truth for the list; this block only
 * draws it. Block props: `signalId`, `competitorId` (highlighted marker).
 */

const RADIUS_MIN_KM = 5;
const RADIUS_MAX_KM = 200;
const RADIUS_STEP_KM = 5;
const RADIUS_DEFAULT_KM = 50;
const RADIUS_DEBOUNCE_MS = 400;
const SENT_STATUS_MS = 2000;

const BLOCK_TITLE = "Competitor map";

// Canvas geometry (viewBox units). The ring always sits at RING_PX; markers
// rescale around it when the radius changes.
const VIEW_W = 400;
const VIEW_H = 260;
const CENTER_X = 200;
const CENTER_Y = 130;
const RING_PX = 100;
/** Out-of-radius points are parked just outside the ring, never off-canvas. */
const OUTSIDE_PAD_PX = 14;
/** Distance unknown → fixed inner orbit so the marker still reads as "near". */
const UNKNOWN_ORBIT_PX = RING_PX * 0.45;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const LABEL_MAX_CHARS = 16;
/** Stable empty list so the placement memo does not rerun on every render. */
const NO_CANDIDATES: readonly ScopeCandidate[] = [];
const MOVE_TRANSITION = "transform 240ms ease-out";

// SVG fill/stroke cannot take Tailwind classes, so tokens come with fallbacks
// (same convention as PriceChart).
const MARK_INFO = "var(--palette-info, #7eb6ff)";
const MARK_OK = "var(--palette-ok, #2ed573)";
const MARK_ACCENT = "var(--palette-accent, #ff4757)";
const INK_TEXT = "var(--color-text, #e8eef2)";
const INK_MUTED = "var(--color-text-muted, #a8b2c1)";
const GRID = "var(--color-border, #3a4450)";
const SURFACE = "var(--color-surface, #242b32)";
const RECESSED = "var(--palette-recessed, #12161a)";
const FONT_MONO = "var(--font-mono)";

// ---------------------------------------------------------------------------
// Data adapter — mirrors useScopeCandidates so map and list agree.
// ---------------------------------------------------------------------------

// Mirrors FIXTURE_CANDIDATES in CompetitorScope.tsx (T-40 owns the source of truth).
const FIXTURE_CANDIDATES: readonly ScopeCandidate[] = [
  {
    id: "fixture_scope_replydesk",
    name: "ReplyDesk",
    url: "https://replydesk.example",
    origin: "exa",
    kind: "direct",
    summary:
      "AI-first shared inbox for SMB support teams; seat pricing close to ours.",
    distanceKm: 12,
    sameProducts: true,
    region: "Berlin",
    fixture: true,
  },
  {
    id: "fixture_scope_ticketowl",
    name: "TicketOwl",
    url: "https://ticketowl.example",
    origin: "grok",
    kind: "direct",
    summary: "Ticketing with AI triage and SLA policies for mid-market teams.",
    distanceKm: 35,
    sameProducts: true,
    region: "Potsdam",
    fixture: true,
  },
  {
    id: "fixture_scope_shopchat",
    name: "ShopChat Commerce",
    url: "https://shopchat.example",
    origin: "exa",
    kind: "adjacent",
    summary: "Live chat for e-commerce stores; no ticketing or knowledge base.",
    distanceKm: 8,
    sameProducts: false,
    region: "Berlin",
    fixture: true,
  },
  {
    id: "fixture_scope_supportnova",
    name: "SupportNova",
    url: "https://supportnova.example",
    origin: "exa",
    kind: "direct",
    summary: "Helpdesk suite with an AI copilot; targets enterprise contracts.",
    distanceKm: 120,
    sameProducts: true,
    region: "Magdeburg",
    fixture: true,
  },
  {
    id: "fixture_scope_kanbanpro",
    name: "Kanban Pro",
    url: "https://kanbanpro.example",
    origin: "grok",
    kind: "adjacent",
    summary:
      "Project boards for agencies; overlaps only on a shared-inbox add-on.",
    distanceKm: 3,
    sameProducts: false,
    region: "Berlin",
    fixture: true,
  },
];

/** Same conversion as CompetitorScope: live docs carry no distance (0). */
function fromCompetitor(doc: Doc<"competitors">): ScopeCandidate {
  return {
    id: doc._id,
    name: doc.name,
    url: doc.url,
    origin: doc.origin,
    summary: doc.summary,
    distanceKm: 0,
    sameProducts: true,
    region: null,
    kind: doc.kind,
    fixture: false,
  };
}

/** `0` (live docs) and `null` both mean the distance is not known. */
function knownDistance(candidate: ScopeCandidate): number | null {
  return candidate.distanceKm !== null && candidate.distanceKm > 0
    ? candidate.distanceKm
    : null;
}

/** Unknown distance never falls out of scope — same rule as the list. */
function inScope(candidate: ScopeCandidate, radiusKm: number): boolean {
  const distance = knownDistance(candidate);
  return distance === null || distance <= radiusKm;
}

/** Same ordering as CompetitorScope's list: raw field, so live docs (0) rank first. */
function byDistance(a: ScopeCandidate, b: ScopeCandidate): number {
  const left = a.distanceKm ?? Number.POSITIVE_INFINITY;
  const right = b.distanceKm ?? Number.POSITIVE_INFINITY;
  if (left !== right) {
    return left - right;
  }
  return a.name.localeCompare(b.name);
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Every tracked candidate (live + fixtures, deduped by name, live wins),
 * sorted by distance. Radius filtering happens at draw time so out-of-radius
 * markers can still be parked outside the ring.
 */
function useMapCandidates(): LoadState<ScopeCandidate[]> {
  const demo = useQuery(api.workspace.demo);

  return useMemo<LoadState<ScopeCandidate[]>>(() => {
    if (demo === undefined) {
      return { kind: "loading" };
    }

    try {
      const live = (demo?.competitors ?? []).map(fromCompetitor);
      const liveNames = new Set(live.map((c) => normalizeName(c.name)));
      const extras = FIXTURE_CANDIDATES.filter(
        (c) => !liveNames.has(normalizeName(c.name)),
      );
      const all = [...live, ...extras].sort(byDistance);
      return all.length === 0 ? { kind: "empty" } : { kind: "ready", data: all };
    } catch (error: unknown) {
      return {
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not build the competitor map",
      };
    }
  }, [demo]);
}

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

type Placed = {
  candidate: ScopeCandidate;
  x: number;
  y: number;
  distance: number | null;
  inScope: boolean;
};

/**
 * Bearing = distance rank × golden angle: deterministic, no two neighbours
 * share a direction, and it never depends on the radius, so only the orbit
 * moves when the slider does.
 */
function placeCandidates(
  candidates: readonly ScopeCandidate[],
  radiusKm: number,
): Placed[] {
  return candidates.map((candidate, index) => {
    const distance = knownDistance(candidate);
    const scoped = inScope(candidate, radiusKm);
    const orbit =
      distance === null
        ? UNKNOWN_ORBIT_PX
        : Math.min((RING_PX * distance) / radiusKm, RING_PX + OUTSIDE_PAD_PX);
    const angle = -Math.PI / 2 + index * GOLDEN_ANGLE;
    return {
      candidate,
      distance,
      inScope: scoped,
      x: CENTER_X + orbit * Math.cos(angle),
      y: CENTER_Y + orbit * Math.sin(angle),
    };
  });
}

function truncate(name: string): string {
  return name.length > LABEL_MAX_CHARS
    ? `${name.slice(0, LABEL_MAX_CHARS - 1)}…`
    : name;
}

function describe(point: Placed): string {
  const distance = point.distance === null ? "distance n/a" : `${point.distance} km`;
  const products = point.candidate.sameProducts
    ? "same products"
    : "different products";
  return `${point.candidate.name} · ${distance} · ${products}`;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function clearTimer(ref: MutableRefObject<number | null>): void {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

type Delivery =
  | { kind: "idle" }
  | { kind: "local"; label: string }
  | { kind: "sending"; label: string }
  | { kind: "sent"; label: string }
  | { kind: "failed"; label: string; message: string };

// ---------------------------------------------------------------------------
// Styles (tokens from DESIGN.md)
// ---------------------------------------------------------------------------

const mono11Muted =
  "font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]";
const outlineButton = cn(
  "inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--palette-recessed)]",
  focusRing,
  "disabled:cursor-not-allowed disabled:opacity-50",
);
const legendDot = "inline-block h-2 w-2 shrink-0 rounded-full";

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function CompetitorMarker({
  point,
  current,
  transition,
}: {
  point: Placed;
  current: boolean;
  transition: string;
}) {
  const color = point.candidate.sameProducts ? MARK_OK : INK_MUTED;
  const hollow = point.distance === null;
  const labelLeft = point.x < CENTER_X;

  return (
    <g
      data-candidate-id={point.candidate.id}
      data-in-scope={point.inScope ? "true" : "false"}
      style={{
        transform: `translate(${point.x}px, ${point.y}px)`,
        transition,
        opacity: point.inScope ? 1 : 0.35,
      }}
    >
      <title>{describe(point)}</title>
      <circle r={7} fill={SURFACE} />
      {current ? (
        <circle r={9} fill="none" stroke={MARK_ACCENT} strokeWidth={1.5} />
      ) : null}
      {hollow ? (
        <circle r={5} fill="none" stroke={color} strokeWidth={1.5} />
      ) : (
        <circle r={5} fill={color} />
      )}
      <text
        x={labelLeft ? -10 : 10}
        y={4}
        textAnchor={labelLeft ? "end" : "start"}
        fontSize={11}
        fill={INK_TEXT}
        style={{ fontFamily: FONT_MONO }}
      >
        {truncate(point.candidate.name)}
      </text>
    </g>
  );
}

function SchematicMap({
  points,
  radiusKm,
  inScopeCount,
  currentCompetitorId,
}: {
  points: Placed[];
  radiusKm: number;
  inScopeCount: number;
  currentCompetitorId: string | undefined;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const transition = reducedMotion ? "none" : MOVE_TRANSITION;
  const summary = `Schematic map: ${inScopeCount} competitors within ${radiusKm} km`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      height={VIEW_H}
      role="img"
      aria-label={summary}
      className="block rounded-[var(--radius-md)] border border-[var(--color-border)]"
    >
      <title>{summary}</title>
      <rect width={VIEW_W} height={VIEW_H} fill={RECESSED} />

      {/* Instrument grid: faint inner circles and a crosshair. */}
      <g stroke={GRID} strokeWidth={1} fill="none" opacity={0.55} aria-hidden>
        {[0.25, 0.5, 0.75].map((share) => (
          <circle key={share} cx={CENTER_X} cy={CENTER_Y} r={RING_PX * share} />
        ))}
        <line x1={0} y1={CENTER_Y} x2={VIEW_W} y2={CENTER_Y} />
        <line x1={CENTER_X} y1={0} x2={CENTER_X} y2={VIEW_H} />
      </g>

      {/* Radius ring. */}
      <circle
        cx={CENTER_X}
        cy={CENTER_Y}
        r={RING_PX}
        fill="none"
        stroke={MARK_INFO}
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <text
        x={CENTER_X}
        y={CENTER_Y - RING_PX - 6}
        textAnchor="middle"
        fontSize={11}
        fill={INK_MUTED}
        style={{ fontFamily: FONT_MONO }}
      >
        ≤ {radiusKm} km
      </text>

      {points.map((point) => (
        <CompetitorMarker
          key={point.candidate.id}
          point={point}
          current={
            currentCompetitorId !== undefined &&
            point.candidate.id === currentCompetitorId
          }
          transition={transition}
        />
      ))}

      {/* Our position, drawn last so it stays on top. */}
      <g transform={`translate(${CENTER_X} ${CENTER_Y})`}>
        <title>You · center of the radius</title>
        <circle r={10} fill="none" stroke={MARK_INFO} strokeWidth={1} />
        <g stroke={MARK_INFO} strokeWidth={1}>
          <line x1={-14} y1={0} x2={-11} y2={0} />
          <line x1={11} y1={0} x2={14} y2={0} />
          <line x1={0} y1={-14} x2={0} y2={-11} />
          <line x1={0} y1={11} x2={0} y2={14} />
        </g>
        <circle r={6} fill={INK_TEXT} />
        <text
          x={0}
          y={26}
          textAnchor="middle"
          fontSize={11}
          fill={INK_TEXT}
          style={{ fontFamily: FONT_MONO }}
        >
          You
        </text>
      </g>
    </svg>
  );
}

const LEGEND: readonly { label: string; dot: string }[] = [
  { label: "same products", dot: "bg-[var(--palette-ok)]" },
  { label: "different products", dot: "bg-[var(--color-text-muted)]" },
  { label: "distance n/a", dot: "border border-[var(--color-text-muted)]" },
  {
    label: "outside radius",
    dot: "border border-dashed border-[var(--color-text-muted)] opacity-50",
  },
];

function MapLegend({
  inScopeCount,
  total,
}: {
  inScopeCount: number;
  total: number;
}) {
  return (
    <div className="mt-[var(--space-2)] flex flex-wrap items-center justify-between gap-x-[var(--space-3)] gap-y-[var(--space-1)]">
      <ul className="flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-1)]">
        {LEGEND.map((entry) => (
          <li
            key={entry.label}
            className={cn("inline-flex items-center gap-[var(--space-2)]", mono11Muted)}
          >
            <span className={cn(legendDot, entry.dot)} aria-hidden />
            {entry.label}
          </li>
        ))}
      </ul>
      <span className={mono11Muted}>
        {inScopeCount} in scope · {total} tracked
      </span>
    </div>
  );
}

function RadiusControl({
  radiusKm,
  onRadiusChange,
}: {
  radiusKm: number;
  onRadiusChange: (next: number) => void;
}) {
  // useId, not block.id: the same layout id can appear on the canvas and in chat.
  const rangeId = `${useId()}-radius`;

  return (
    <fieldset className="mt-[var(--space-3)] flex flex-col gap-[var(--space-1)]">
      <legend className="sr-only">Map radius</legend>
      <div className="flex items-center justify-between gap-[var(--space-2)]">
        <label
          htmlFor={rangeId}
          className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]"
        >
          Radius
        </label>
        <output
          htmlFor={rangeId}
          className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]"
        >
          ≤ {radiusKm} km
        </output>
      </div>
      <input
        id={rangeId}
        type="range"
        min={RADIUS_MIN_KM}
        max={RADIUS_MAX_KM}
        step={RADIUS_STEP_KM}
        value={radiusKm}
        aria-valuetext={`${radiusKm} km`}
        onChange={(event) => onRadiusChange(Number(event.target.value))}
        className={cn("w-full cursor-pointer accent-[var(--palette-info)]", focusRing)}
      />
    </fieldset>
  );
}

function MapEmpty({
  noCandidates,
  radiusKm,
  onWiden,
}: {
  noCandidates: boolean;
  radiusKm: number;
  onWiden: () => void;
}) {
  const canWiden = radiusKm < RADIUS_MAX_KM;

  return (
    <div
      data-map-state="empty"
      className="mt-[var(--space-3)] rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
    >
      <div className="flex items-start gap-[var(--space-3)]">
        <MapPin
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]"
          aria-hidden
        />
        <div>
          <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text-muted)]">
            {noCandidates
              ? "Only your position is known yet. Run Scan to place competitors on the map."
              : `No competitors inside ${radiusKm} km. Widen the radius.`}
          </p>
          {noCandidates ? null : (
            <>
              {!canWiden ? (
                <p className={cn("mt-[var(--space-1)]", mono11Muted)}>
                  Radius is already {RADIUS_MAX_KM} km
                </p>
              ) : null}
              <button
                type="button"
                onClick={onWiden}
                disabled={!canWiden}
                className={cn(outlineButton, "mt-[var(--space-3)]")}
              >
                Widen to {RADIUS_MAX_KM} km
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryStatus({ delivery }: { delivery: Delivery }) {
  if (delivery.kind === "idle") {
    return null;
  }

  if (delivery.kind === "failed") {
    return (
      <div
        role="alert"
        className="mt-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--palette-accent)] bg-[var(--color-surface)] p-[var(--space-3)]"
      >
        <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
          Grok did not receive {delivery.label}
        </p>
        <p className={cn("mt-[var(--space-1)]", mono11Muted)}>{delivery.message}</p>
      </div>
    );
  }

  const text =
    delivery.kind === "sending"
      ? `Sending to Grok · ${delivery.label}…`
      : delivery.kind === "sent"
        ? `Sent to Grok · ${delivery.label}`
        : `Applied locally · ${delivery.label}`;

  return (
    <p role="status" aria-live="polite" className={cn("mt-[var(--space-3)]", mono11Muted)}>
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

export function GeoMapBlock({ block }: BlockComponentProps) {
  const props: Partial<Record<string, string>> = block.props ?? {};
  const signalId = props.signalId;
  const currentCompetitorId = props.competitorId;
  const blockId = block.id;

  const demo = useQuery(api.workspace.demo);
  const sendUiEvent = useAction(api.uiEvents.send);
  const workspaceId = demo?.workspace._id;

  const [radiusKm, setRadiusKm] = useState(RADIUS_DEFAULT_KM);
  const [delivery, setDelivery] = useState<Delivery>({ kind: "idle" });

  const state = useMapCandidates();
  const candidates = state.kind === "ready" ? state.data : NO_CANDIDATES;
  const points = useMemo(
    () => placeCandidates(candidates, radiusKm),
    [candidates, radiusKm],
  );
  const inScopeCount = points.filter((point) => point.inScope).length;

  const radiusTimer = useRef<number | null>(null);
  const statusTimer = useRef<number | null>(null);
  // Only the latest response updates the status: a stale send never wins.
  const sendSeq = useRef(0);
  // A response landing after unmount must not touch state or start timers.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimer(radiusTimer);
      clearTimer(statusTimer);
    };
  }, []);

  const dispatchRadius = useCallback(
    (nextRadiusKm: number) => {
      const label = `radius ${nextRadiusKm} km`;
      // Keys match what describeEvent reads in convex/uiEvents.ts.
      const payload = JSON.stringify({ radius_km: nextRadiusKm, signalId });

      clearTimer(statusTimer);

      if (!workspaceId) {
        setDelivery({ kind: "local", label });
        return;
      }

      sendSeq.current += 1;
      const seq = sendSeq.current;
      setDelivery({ kind: "sending", label });

      sendUiEvent({ workspaceId, blockId, action: "update_radius", payload })
        .then(() => {
          if (!mounted.current || seq !== sendSeq.current) {
            return;
          }
          setDelivery({ kind: "sent", label });
          statusTimer.current = window.setTimeout(() => {
            statusTimer.current = null;
            setDelivery({ kind: "idle" });
          }, SENT_STATUS_MS);
        })
        .catch((error: unknown) => {
          if (!mounted.current || seq !== sendSeq.current) {
            return;
          }
          setDelivery({
            kind: "failed",
            label,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        });
    },
    [blockId, sendUiEvent, signalId, workspaceId],
  );

  // The debounce timer calls the current dispatch, not the drag-time closure.
  const dispatchRef = useRef(dispatchRadius);
  useEffect(() => {
    dispatchRef.current = dispatchRadius;
  }, [dispatchRadius]);

  const handleRadiusChange = (next: number) => {
    setRadiusKm(next);
    clearTimer(radiusTimer);
    radiusTimer.current = window.setTimeout(() => {
      radiusTimer.current = null;
      dispatchRef.current(next);
    }, RADIUS_DEBOUNCE_MS);
  };

  const widen = () => {
    clearTimer(radiusTimer);
    setRadiusKm(RADIUS_MAX_KM);
    dispatchRadius(RADIUS_MAX_KM);
  };

  if (state.kind === "loading") {
    return <BlockLoading title={BLOCK_TITLE} />;
  }

  if (state.kind === "error") {
    return (
      <BlockErrorRetry
        title={BLOCK_TITLE}
        headline="Map data unavailable"
        message={state.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <BlockShell title={BLOCK_TITLE} state="ready">
      <SchematicMap
        points={points}
        radiusKm={radiusKm}
        inScopeCount={inScopeCount}
        currentCompetitorId={currentCompetitorId}
      />

      {/* role="img" flattens the SVG for assistive tech, so per-marker
          details live in a visually hidden list. */}
      {points.length > 0 ? (
        <ul className="sr-only" aria-label="Competitors on the map">
          {points.map((point) => (
            <li key={point.candidate.id}>
              {describe(point)}
              {point.inScope ? "" : " · outside radius"}
            </li>
          ))}
        </ul>
      ) : null}

      <MapLegend inScopeCount={inScopeCount} total={candidates.length} />

      {inScopeCount === 0 ? (
        <MapEmpty
          noCandidates={candidates.length === 0}
          radiusKm={radiusKm}
          onWiden={widen}
        />
      ) : null}

      <RadiusControl radiusKm={radiusKm} onRadiusChange={handleRadiusChange} />

      <DeliveryStatus delivery={delivery} />

      <p className={cn("mt-[var(--space-3)]", mono11Muted)}>
        {workspaceId
          ? "Move the radius and Grok reshapes the canvas"
          : "Radius stays local until the workspace connects"}
      </p>
    </BlockShell>
  );
}

export default GeoMapBlock;
