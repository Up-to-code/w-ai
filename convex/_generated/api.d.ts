/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assets from "../assets.js";
import type * as auth from "../auth.js";
import type * as beta from "../beta.js";
import type * as cms from "../cms.js";
import type * as contacts from "../contacts.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as data from "../data.js";
import type * as domainDns from "../domainDns.js";
import type * as domainFinance from "../domainFinance.js";
import type * as domainHealth from "../domainHealth.js";
import type * as domainNames from "../domainNames.js";
import type * as domainOrders from "../domainOrders.js";
import type * as domainRegistrarActions from "../domainRegistrarActions.js";
import type * as domainRegistrarFunding from "../domainRegistrarFunding.js";
import type * as domainRegistrarSessions from "../domainRegistrarSessions.js";
import type * as domainVerification from "../domainVerification.js";
import type * as domainVerificationPolicy from "../domainVerificationPolicy.js";
import type * as domains from "../domains.js";
import type * as events from "../events.js";
import type * as forms from "../forms.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as interests from "../interests.js";
import type * as languages from "../languages.js";
import type * as libraries from "../libraries.js";
import type * as limits from "../limits.js";
import type * as mapLocations from "../mapLocations.js";
import type * as openproviderClient from "../openproviderClient.js";
import type * as organizations from "../organizations.js";
import type * as pageTemplates from "../pageTemplates.js";
import type * as pages from "../pages.js";
import type * as posts from "../posts.js";
import type * as projectFolders from "../projectFolders.js";
import type * as properties from "../properties.js";
import type * as redirects from "../redirects.js";
import type * as services from "../services.js";
import type * as settings from "../settings.js";
import type * as tenant from "../tenant.js";
import type * as users from "../users.js";
import type * as vercelDomainConfig from "../vercelDomainConfig.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assets: typeof assets;
  auth: typeof auth;
  beta: typeof beta;
  cms: typeof cms;
  contacts: typeof contacts;
  conversations: typeof conversations;
  crons: typeof crons;
  data: typeof data;
  domainDns: typeof domainDns;
  domainFinance: typeof domainFinance;
  domainHealth: typeof domainHealth;
  domainNames: typeof domainNames;
  domainOrders: typeof domainOrders;
  domainRegistrarActions: typeof domainRegistrarActions;
  domainRegistrarFunding: typeof domainRegistrarFunding;
  domainRegistrarSessions: typeof domainRegistrarSessions;
  domainVerification: typeof domainVerification;
  domainVerificationPolicy: typeof domainVerificationPolicy;
  domains: typeof domains;
  events: typeof events;
  forms: typeof forms;
  helpers: typeof helpers;
  http: typeof http;
  interests: typeof interests;
  languages: typeof languages;
  libraries: typeof libraries;
  limits: typeof limits;
  mapLocations: typeof mapLocations;
  openproviderClient: typeof openproviderClient;
  organizations: typeof organizations;
  pageTemplates: typeof pageTemplates;
  pages: typeof pages;
  posts: typeof posts;
  projectFolders: typeof projectFolders;
  properties: typeof properties;
  redirects: typeof redirects;
  services: typeof services;
  settings: typeof settings;
  tenant: typeof tenant;
  users: typeof users;
  vercelDomainConfig: typeof vercelDomainConfig;
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

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
