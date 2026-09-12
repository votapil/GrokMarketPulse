/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as act from "../act.js";
import type * as artifacts from "../artifacts.js";
import type * as assess from "../assess.js";
import type * as chat from "../chat.js";
import type * as costs from "../costs.js";
import type * as detect from "../detect.js";
import type * as diff from "../diff.js";
import type * as exa from "../exa.js";
import type * as fal from "../fal.js";
import type * as firecrawl from "../firecrawl.js";
import type * as grok from "../grok.js";
import type * as history from "../history.js";
import type * as http from "../http.js";
import type * as layout from "../layout.js";
import type * as mock from "../mock.js";
import type * as mockHtml from "../mockHtml.js";
import type * as onboarding from "../onboarding.js";
import type * as prompts_artifacts from "../prompts/artifacts.js";
import type * as prompts_reasoning from "../prompts/reasoning.js";
import type * as recommend from "../recommend.js";
import type * as runs from "../runs.js";
import type * as scan from "../scan.js";
import type * as seed from "../seed.js";
import type * as seedData from "../seedData.js";
import type * as signals from "../signals.js";
import type * as snapshots from "../snapshots.js";
import type * as uiEvents from "../uiEvents.js";
import type * as usage from "../usage.js";
import type * as verify from "../verify.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  act: typeof act;
  artifacts: typeof artifacts;
  assess: typeof assess;
  chat: typeof chat;
  costs: typeof costs;
  detect: typeof detect;
  diff: typeof diff;
  exa: typeof exa;
  fal: typeof fal;
  firecrawl: typeof firecrawl;
  grok: typeof grok;
  history: typeof history;
  http: typeof http;
  layout: typeof layout;
  mock: typeof mock;
  mockHtml: typeof mockHtml;
  onboarding: typeof onboarding;
  "prompts/artifacts": typeof prompts_artifacts;
  "prompts/reasoning": typeof prompts_reasoning;
  recommend: typeof recommend;
  runs: typeof runs;
  scan: typeof scan;
  seed: typeof seed;
  seedData: typeof seedData;
  signals: typeof signals;
  snapshots: typeof snapshots;
  uiEvents: typeof uiEvents;
  usage: typeof usage;
  verify: typeof verify;
  workspace: typeof workspace;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
