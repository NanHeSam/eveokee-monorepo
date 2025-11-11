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
import type * as callDiaryWorkflow from "../callDiaryWorkflow.js";
import type * as callJobs from "../callJobs.js";
import type * as callSettings from "../callSettings.js";
import type * as crons from "../crons.js";
import type * as deleteAccount from "../deleteAccount.js";
import type * as diaries from "../diaries.js";
import type * as emailNotify from "../emailNotify.js";
import type * as http from "../http.js";
import type * as index from "../index.js";
import type * as integrations_kie_client from "../integrations/kie/client.js";
import type * as integrations_openai_client from "../integrations/openai/client.js";
import type * as integrations_revenuecat_client from "../integrations/revenuecat/client.js";
import type * as integrations_suno_client from "../integrations/suno/client.js";
import type * as integrations_vapi_client from "../integrations/vapi/client.js";
import type * as integrations_vapi_helpers from "../integrations/vapi/helpers.js";
import type * as integrations_vapi_integration from "../integrations/vapi/integration.js";
import type * as integrations_vapi_systemPrompt from "../integrations/vapi/systemPrompt.js";
import type * as models_webhooks_clerk from "../models/webhooks/clerk.js";
import type * as models_webhooks_index from "../models/webhooks/index.js";
import type * as models_webhooks_kie from "../models/webhooks/kie.js";
import type * as models_webhooks_revenuecat from "../models/webhooks/revenuecat.js";
import type * as models_webhooks_suno from "../models/webhooks/suno.js";
import type * as models_webhooks_vapi from "../models/webhooks/vapi.js";
import type * as music from "../music.js";
import type * as musicActions from "../musicActions.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as revenueCatBilling from "../revenueCatBilling.js";
import type * as service_vapi_executor from "../service/vapi/executor.js";
import type * as sharing from "../sharing.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";
import type * as utils_cadenceHelpers from "../utils/cadenceHelpers.js";
import type * as utils_constants_general from "../utils/constants/general.js";
import type * as utils_constants_index from "../utils/constants/index.js";
import type * as utils_constants_music from "../utils/constants/music.js";
import type * as utils_constants_plans from "../utils/constants/plans.js";
import type * as utils_constants_query from "../utils/constants/query.js";
import type * as utils_constants_revenuecat from "../utils/constants/revenuecat.js";
import type * as utils_constants_sharing from "../utils/constants/sharing.js";
import type * as utils_constants_vapi from "../utils/constants/vapi.js";
import type * as utils_constants_video from "../utils/constants/video.js";
import type * as utils_constants_webhooks from "../utils/constants/webhooks.js";
import type * as utils_contextHelpers from "../utils/contextHelpers.js";
import type * as utils_envValidation from "../utils/envValidation.js";
import type * as utils_logger from "../utils/logger.js";
import type * as utils_phoneHelpers from "../utils/phoneHelpers.js";
import type * as utils_timezoneHelpers from "../utils/timezoneHelpers.js";
import type * as videoActions from "../videoActions.js";
import type * as videos from "../videos.js";
import type * as webhooks_handlers_clerk from "../webhooks/handlers/clerk.js";
import type * as webhooks_handlers_kie from "../webhooks/handlers/kie.js";
import type * as webhooks_handlers_revenuecat from "../webhooks/handlers/revenuecat.js";
import type * as webhooks_handlers_suno from "../webhooks/handlers/suno.js";
import type * as webhooks_handlers_vapi from "../webhooks/handlers/vapi.js";
import type * as webhooks_handlers_vapiAssistantRequest from "../webhooks/handlers/vapiAssistantRequest.js";
import type * as webhooks_shared from "../webhooks/shared.js";

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
  callDiaryWorkflow: typeof callDiaryWorkflow;
  callJobs: typeof callJobs;
  callSettings: typeof callSettings;
  crons: typeof crons;
  deleteAccount: typeof deleteAccount;
  diaries: typeof diaries;
  emailNotify: typeof emailNotify;
  http: typeof http;
  index: typeof index;
  "integrations/kie/client": typeof integrations_kie_client;
  "integrations/openai/client": typeof integrations_openai_client;
  "integrations/revenuecat/client": typeof integrations_revenuecat_client;
  "integrations/suno/client": typeof integrations_suno_client;
  "integrations/vapi/client": typeof integrations_vapi_client;
  "integrations/vapi/helpers": typeof integrations_vapi_helpers;
  "integrations/vapi/integration": typeof integrations_vapi_integration;
  "integrations/vapi/systemPrompt": typeof integrations_vapi_systemPrompt;
  "models/webhooks/clerk": typeof models_webhooks_clerk;
  "models/webhooks/index": typeof models_webhooks_index;
  "models/webhooks/kie": typeof models_webhooks_kie;
  "models/webhooks/revenuecat": typeof models_webhooks_revenuecat;
  "models/webhooks/suno": typeof models_webhooks_suno;
  "models/webhooks/vapi": typeof models_webhooks_vapi;
  music: typeof music;
  musicActions: typeof musicActions;
  pushNotifications: typeof pushNotifications;
  revenueCatBilling: typeof revenueCatBilling;
  "service/vapi/executor": typeof service_vapi_executor;
  sharing: typeof sharing;
  usage: typeof usage;
  users: typeof users;
  "utils/cadenceHelpers": typeof utils_cadenceHelpers;
  "utils/constants/general": typeof utils_constants_general;
  "utils/constants/index": typeof utils_constants_index;
  "utils/constants/music": typeof utils_constants_music;
  "utils/constants/plans": typeof utils_constants_plans;
  "utils/constants/query": typeof utils_constants_query;
  "utils/constants/revenuecat": typeof utils_constants_revenuecat;
  "utils/constants/sharing": typeof utils_constants_sharing;
  "utils/constants/vapi": typeof utils_constants_vapi;
  "utils/constants/video": typeof utils_constants_video;
  "utils/constants/webhooks": typeof utils_constants_webhooks;
  "utils/contextHelpers": typeof utils_contextHelpers;
  "utils/envValidation": typeof utils_envValidation;
  "utils/logger": typeof utils_logger;
  "utils/phoneHelpers": typeof utils_phoneHelpers;
  "utils/timezoneHelpers": typeof utils_timezoneHelpers;
  videoActions: typeof videoActions;
  videos: typeof videos;
  "webhooks/handlers/clerk": typeof webhooks_handlers_clerk;
  "webhooks/handlers/kie": typeof webhooks_handlers_kie;
  "webhooks/handlers/revenuecat": typeof webhooks_handlers_revenuecat;
  "webhooks/handlers/suno": typeof webhooks_handlers_suno;
  "webhooks/handlers/vapi": typeof webhooks_handlers_vapi;
  "webhooks/handlers/vapiAssistantRequest": typeof webhooks_handlers_vapiAssistantRequest;
  "webhooks/shared": typeof webhooks_shared;
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
