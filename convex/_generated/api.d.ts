/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bloodWork from "../bloodWork.js";
import type * as checkIns from "../checkIns.js";
import type * as continuity from "../continuity.js";
import type * as devSeed from "../devSeed.js";
import type * as doctorVisits from "../doctorVisits.js";
import type * as dosageChanges from "../dosageChanges.js";
import type * as extractAttempts from "../extractAttempts.js";
import type * as intakeEvents from "../intakeEvents.js";
import type * as medications from "../medications.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bloodWork: typeof bloodWork;
  checkIns: typeof checkIns;
  continuity: typeof continuity;
  devSeed: typeof devSeed;
  doctorVisits: typeof doctorVisits;
  dosageChanges: typeof dosageChanges;
  extractAttempts: typeof extractAttempts;
  intakeEvents: typeof intakeEvents;
  medications: typeof medications;
  waitlist: typeof waitlist;
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
