/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as billing from "../billing.js";
import type * as cadenceHelpers from "../cadenceHelpers.js";
import type * as callJobs from "../callJobs.js";
import type * as callSettings from "../callSettings.js";
import type * as constant from "../constant.js";
import type * as crons from "../crons.js";
import type * as dailyPlanner from "../dailyPlanner.js";
import type * as diaries from "../diaries.js";
import type * as emailNotify from "../emailNotify.js";
import type * as http from "../http.js";
import type * as index from "../index.js";
import type * as music from "../music.js";
import type * as musicActions from "../musicActions.js";
import type * as revenueCatBilling from "../revenueCatBilling.js";
import type * as sharing from "../sharing.js";
import type * as timezoneHelpers from "../timezoneHelpers.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";
import type * as vapiIntegration from "../vapiIntegration.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  billing: typeof billing;
  cadenceHelpers: typeof cadenceHelpers;
  callJobs: typeof callJobs;
  callSettings: typeof callSettings;
  constant: typeof constant;
  crons: typeof crons;
  dailyPlanner: typeof dailyPlanner;
  diaries: typeof diaries;
  emailNotify: typeof emailNotify;
  http: typeof http;
  index: typeof index;
  music: typeof music;
  musicActions: typeof musicActions;
  revenueCatBilling: typeof revenueCatBilling;
  sharing: typeof sharing;
  timezoneHelpers: typeof timezoneHelpers;
  usage: typeof usage;
  users: typeof users;
  vapiIntegration: typeof vapiIntegration;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
