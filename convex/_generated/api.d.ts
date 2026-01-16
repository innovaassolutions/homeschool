/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as childProfiles from "../childProfiles.js";
import type * as conversations from "../conversations.js";
import type * as dailyProgress from "../dailyProgress.js";
import type * as families from "../families.js";
import type * as ixlData from "../ixlData.js";
import type * as notifications from "../notifications.js";
import type * as sessions from "../sessions.js";
import type * as weeklyPlans from "../weeklyPlans.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  auth: typeof auth;
  childProfiles: typeof childProfiles;
  conversations: typeof conversations;
  dailyProgress: typeof dailyProgress;
  families: typeof families;
  ixlData: typeof ixlData;
  notifications: typeof notifications;
  sessions: typeof sessions;
  weeklyPlans: typeof weeklyPlans;
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
