/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as billing from "../billing.js";
import type * as constant from "../constant.js";
import type * as diaries from "../diaries.js";
import type * as emailNotify from "../emailNotify.js";
import type * as http from "../http.js";
import type * as music from "../music.js";
import type * as musicActions from "../musicActions.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";

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
  constant: typeof constant;
  diaries: typeof diaries;
  emailNotify: typeof emailNotify;
  http: typeof http;
  music: typeof music;
  musicActions: typeof musicActions;
  usage: typeof usage;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
