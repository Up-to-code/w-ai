import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Locale-keyed text. Keys match the language codes defined in `languages`.
const localized = v.record(v.string(), v.string());

// ---------------------------------------------------------------------------
// Multi-tenant SaaS model. Every CMS tenant is an organization with its own
// site (slug subdomain + optional custom domains), languages, theme, pages,
// and content. Auth (users, sessions, accounts) lives in the better-auth
// component, referenced here by string userId.
// ---------------------------------------------------------------------------

export const organizations = defineTable({
  name: v.string(),
  slug: v.string(),
  plan: v.union(
    v.literal("free"),
    v.literal("starter"),
    v.literal("pro"),
    v.literal("enterprise"),
  ),
  billingEmail: v.optional(v.string()),
  avatar: v.optional(v.string()),
  // Soft-delete / suspension for abuse or end of beta.
  status: v.optional(
    v.union(v.literal("active"), v.literal("suspended"), v.literal("deleted")),
  ),
  createdAt: v.number(),
}).index("by_slug", ["slug"]);

export const memberships = defineTable({
  orgId: v.id("organizations"),
  userId: v.string(),
  role: v.union(
    v.literal("owner"),
    v.literal("admin"),
    v.literal("editor"),
    v.literal("viewer"),
  ),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_user", ["userId"])
  .index("by_org_user", ["orgId", "userId"]);

// Personal project organization for the account-level dashboard. Folder
// membership is intentionally per user: moving a shared site never changes how
// another collaborator organizes their workspace.
export const projectFolders = defineTable({
  userId: v.string(),
  name: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_user", ["userId"]);

export const projectFolderAssignments = defineTable({
  userId: v.string(),
  orgId: v.id("organizations"),
  folderId: v.id("projectFolders"),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_org", ["userId", "orgId"])
  .index("by_folder", ["folderId"]);

export const domains = defineTable({
  orgId: v.id("organizations"),
  hostname: v.string(),
  verified: v.boolean(),
  provider: v.optional(
    v.union(v.literal("manual"), v.literal("cloudflare"), v.literal("vercel")),
  ),
  /** Registrar ownership is separate from the routing/DNS provider above. */
  registrarProvider: v.optional(
    v.union(v.literal("openprovider"), v.literal("domainee")),
  ),
  registrarDomainId: v.optional(v.string()),
  registrationStatus: v.optional(
    v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("expired"),
      v.literal("redemption"),
      v.literal("transferred_out"),
    ),
  ),
  registrationExpiresAt: v.optional(v.number()),
  autoRenew: v.optional(v.boolean()),
  ownershipModel: v.optional(
    v.union(v.literal("customer_registrant"), v.literal("bring_your_own")),
  ),
  status: v.optional(
    v.union(
      v.literal("pending"),
      v.literal("configuring"),
      v.literal("verified"),
      v.literal("error"),
    ),
  ),
  cnameTarget: v.optional(v.string()),
  apexTarget: v.optional(v.string()),
  routingType: v.optional(v.union(v.literal("A"), v.literal("CNAME"))),
  /** Optional project-domain redirect. Both hostnames must belong to this site. */
  redirectTo: v.optional(v.string()),
  redirectStatusCode: v.optional(
    v.union(v.literal(301), v.literal(302), v.literal(307), v.literal(308)),
  ),
  providerDomainId: v.optional(v.string()),
  dnsZone: v.optional(v.string()),
  dnsTeamId: v.optional(v.string()),
  platformVerified: v.optional(v.boolean()),
  platformVerification: v.optional(
    v.array(
      v.object({
        type: v.string(),
        domain: v.string(),
        value: v.string(),
        reason: v.optional(v.string()),
      }),
    ),
  ),
  /** Certificate readiness is separate from project-domain verification. */
  tlsStatus: v.optional(
    v.union(v.literal("pending"), v.literal("active"), v.literal("error")),
  ),
  tlsCheckedAt: v.optional(v.number()),
  tlsExpiresAt: v.optional(v.number()),
  lastCheckedAt: v.optional(v.number()),
  /** Bounded background verification progress after routing is attached. */
  verificationAttempt: v.optional(v.number()),
  nextVerificationAt: v.optional(v.number()),
  /** Invalidates stale scheduled retries when routing is reattached. */
  verificationRunId: v.optional(v.string()),
  /** Next background revalidation for a domain that is currently live. */
  nextHealthCheckAt: v.optional(v.number()),
  error: v.optional(v.string()),
  /** TXT record value the tenant must publish at `_w-ai-verify.<hostname>`. */
  verificationToken: v.optional(v.string()),
  verifiedAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_hostname", ["hostname"])
  .index("by_org", ["orgId"])
  .index("by_verified_and_next_health_check", [
    "verified",
    "nextHealthCheckAt",
  ]);

/**
 * Durable commercial lifecycle for future domain registration. This table is
 * intentionally provider-neutral and dormant: no public mutation can spend
 * money. Payment and registrar fulfillment are separate state axes because a
 * Dodo payment can clear before its merchant payout reaches our bank, while
 * Openprovider debits the platform's prepaid reseller balance immediately.
 */
export const domainOrders = defineTable({
  orgId: v.id("organizations"),
  requestedByUserId: v.string(),
  hostname: v.string(),
  operation: v.union(
    v.literal("registration"),
    v.literal("renewal"),
    v.literal("transfer"),
    v.literal("restoration"),
  ),
  provider: v.union(v.literal("openprovider"), v.literal("domainee")),
  state: v.union(
    v.literal("quoted"),
    v.literal("payment_pending"),
    v.literal("payment_succeeded"),
    v.literal("fulfillment_pending"),
    v.literal("fulfilling"),
    v.literal("registered"),
    v.literal("routing"),
    v.literal("active"),
    v.literal("failed"),
    v.literal("refund_pending"),
    v.literal("refunded"),
    v.literal("cancelled"),
  ),
  idempotencyKey: v.string(),
  customerCurrency: v.string(),
  customerAmountMinor: v.number(),
  providerCurrency: v.string(),
  providerAmountMinor: v.number(),
  /** Retail amount retained before payment fees/tax; always customer currency. */
  platformMarkupMinor: v.number(),
  wholesaleAmountMinor: v.optional(v.number()),
  providerFeeMinor: v.optional(v.number()),
  /** Authoritative provider balance read used for the reserve decision. */
  fundingSnapshotId: v.optional(v.id("registrarFundingSnapshots")),
  /** Funding snapshot captured immediately before registrar fulfillment. */
  registrarBalanceMinor: v.optional(v.number()),
  pendingProviderCommitmentsMinor: v.optional(v.number()),
  renewalReserveMinor: v.optional(v.number()),
  operationallyAvailableMinor: v.optional(v.number()),
  reserveCheckedAt: v.optional(v.number()),
  quoteExpiresAt: v.number(),
  paymentProvider: v.literal("dodo"),
  paymentStatus: v.union(
    v.literal("not_started"),
    v.literal("pending"),
    v.literal("succeeded"),
    v.literal("failed"),
    v.literal("refund_pending"),
    v.literal("refunded"),
    v.literal("disputed"),
  ),
  paymentId: v.optional(v.string()),
  checkoutId: v.optional(v.string()),
  /**
   * Merchant payout settlement is independent from the customer payment.
   * Existing rows may omit this field; all new orders initialize it.
   */
  settlementStatus: v.optional(
    v.union(
      v.literal("not_started"),
      v.literal("pending"),
      v.literal("settled"),
      v.literal("reversed"),
    ),
  ),
  payoutId: v.optional(v.string()),
  settledAt: v.optional(v.number()),
  providerStatus: v.union(
    v.literal("not_started"),
    v.literal("pending"),
    v.literal("succeeded"),
    v.literal("failed"),
  ),
  providerOrderId: v.optional(v.string()),
  registrarDomainId: v.optional(v.string()),
  routingDomainId: v.optional(v.id("domains")),
  autoRenew: v.boolean(),
  registrationExpiresAt: v.optional(v.number()),
  failureCode: v.optional(v.string()),
  failureMessage: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_and_hostname", ["orgId", "hostname"])
  .index("by_hostname_operation_state_and_quote_expiry", [
    "hostname",
    "operation",
    "state",
    "quoteExpiresAt",
  ])
  .index("by_idempotency_key", ["idempotencyKey"])
  .index("by_payment_id", ["paymentId"])
  .index("by_provider_and_order_id", ["provider", "providerOrderId"])
  .index("by_provider_and_domain_id", ["provider", "registrarDomainId"])
  .index("by_state", ["state"]);

/** Append-only audit trail and webhook deduplication for domain orders. */
export const domainOrderEvents = defineTable({
  orgId: v.id("organizations"),
  orderId: v.id("domainOrders"),
  eventKey: v.string(),
  type: v.string(),
  source: v.union(
    v.literal("user"),
    v.literal("dodo"),
    v.literal("openprovider"),
    v.literal("domainee"),
    v.literal("system"),
  ),
  /** Redacted operational details only; never store card or registrant PII. */
  metadata: v.optional(v.any()),
  createdAt: v.number(),
})
  .index("by_order", ["orderId"])
  .index("by_org", ["orgId"])
  .index("by_event_key", ["eventKey"]);

/**
 * Request-path redirects owned by a site. A rule can apply to every hostname
 * assigned to the site or to one verified custom hostname. Host redirects
 * (for example www -> apex) remain in `domains` because Vercel enforces those
 * before a request reaches the tenant renderer.
 */
export const redirectRules = defineTable({
  orgId: v.id("organizations"),
  hostname: v.optional(v.string()),
  /** Existing rows without this field are exact matches. */
  matchType: v.optional(v.union(v.literal("exact"), v.literal("prefix"))),
  sourcePath: v.string(),
  destination: v.string(),
  statusCode: v.union(v.literal(307), v.literal(308)),
  preserveQuery: v.boolean(),
  enabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_and_hostname", ["orgId", "hostname"])
  .index("by_org_and_source_path", ["orgId", "sourcePath"])
  .index("by_org_and_match_type", ["orgId", "matchType"])
  .index("by_org_and_hostname_and_source_path", [
    "orgId",
    "hostname",
    "sourcePath",
  ])
  .index("by_org_hostname_match_type_and_source_path", [
    "orgId",
    "hostname",
    "matchType",
    "sourcePath",
  ]);

/** Encrypted credentials for DNS providers connected by a workspace owner. */
export const dnsProviderConnections = defineTable({
  userId: v.string(),
  provider: v.union(v.literal("cloudflare"), v.literal("vercel")),
  accountId: v.optional(v.string()),
  accountName: v.optional(v.string()),
  encryptedAccessToken: v.string(),
  refreshToken: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_provider", ["userId", "provider"]);

/**
 * Short-lived registrar bearer sessions. Credentials remain environment
 * variables; only an encrypted provider token is cached to stay below the
 * provider authentication rate limit.
 */
export const registrarProviderSessions = defineTable({
  provider: v.literal("openprovider"),
  environment: v.union(v.literal("sandbox"), v.literal("production")),
  accountHash: v.string(),
  encryptedAccessToken: v.string(),
  expiresAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_provider_environment_account", [
  "provider",
  "environment",
  "accountHash",
]);

/**
 * Immutable, read-only observations of registrar funds. These are created from
 * the provider API, never from customer payment or payout events.
 */
export const registrarFundingSnapshots = defineTable({
  provider: v.literal("openprovider"),
  environment: v.union(v.literal("sandbox"), v.literal("production")),
  accountHash: v.string(),
  currency: v.string(),
  availableBalanceMinor: v.number(),
  reservedBalanceMinor: v.number(),
  currencyMinorUnit: v.number(),
  fetchedAt: v.number(),
  createdAt: v.number(),
}).index("by_provider_environment_account", [
  "provider",
  "environment",
  "accountHash",
]);

export const languages = defineTable({
  orgId: v.id("organizations"),
  code: v.string(),
  name: v.string(),
  rtl: v.boolean(),
  enabled: v.boolean(),
  isDefault: v.boolean(),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_code", ["orgId", "code"]);

// Global visual identity rendered on the tenant site.
export const theme = defineTable({
  orgId: v.id("organizations"),
  primary: v.string(),
  secondary: v.optional(v.string()),
  accent: v.optional(v.string()),
  background: v.optional(v.string()),
  foreground: v.optional(v.string()),
  radius: v.optional(v.number()),
  font: v.optional(v.string()),
  mode: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
  updatedAt: v.number(),
}).index("by_org", ["orgId"]);

export const navigationItem = v.object({
  label: localized,
  href: v.string(),
});

export const siteSettings = defineTable({
  orgId: v.id("organizations"),
  customCode: v.optional(
    v.object({
      head: v.optional(v.string()),
      footer: v.optional(v.string()),
    }),
  ),
  navigation: v.object({
    mainLinks: v.array(navigationItem),
    secondaryLinks: v.optional(v.array(navigationItem)),
    ctaLabel: v.optional(localized),
    ctaHref: v.optional(v.string()),
    sticky: v.boolean(),
    showLogo: v.boolean(),
  }),
  footer: v.object({
    tagline: v.optional(localized),
    sections: v.array(
      v.object({
        title: localized,
        links: v.array(navigationItem),
      }),
    ),
    socialLinks: v.array(
      v.object({
        type: v.union(
          v.literal("facebook"),
          v.literal("twitter"),
          v.literal("instagram"),
          v.literal("linkedin"),
          v.literal("youtube"),
          v.literal("whatsapp"),
        ),
        url: v.string(),
      }),
    ),
    showSocialLinks: v.boolean(),
    copyrightText: v.optional(localized),
  }),
  logo: v.object({
    image: v.optional(v.string()),
    altText: v.optional(localized),
  }),
  meta: v.object({
    title: v.optional(localized),
    description: v.optional(localized),
    keywords: v.optional(localized),
    ogImage: v.optional(v.string()),
  }),
  updatedAt: v.number(),
}).index("by_org", ["orgId"]);

// A tenant page. `data` is a versioned Qentrah/Craft document. Legacy Puck
// documents remain readable while existing pages migrate on their first save.
export const pages = defineTable({
  orgId: v.id("organizations"),
  slug: v.string(),
  title: localized,
  published: v.boolean(),
  order: v.number(),
  data: v.any(),
  seo: v.optional(
    v.object({
      title: v.optional(localized),
      description: v.optional(localized),
      ogImage: v.optional(v.string()),
    }),
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org_slug", ["orgId", "slug"])
  .index("by_org_published", ["orgId", "published"])
  .index("by_org_order", ["orgId", "order"]);

export const assets = defineTable({
  orgId: v.id("organizations"),
  storageId: v.string(),
  url: v.string(),
  name: v.string(),
  type: v.string(),
  size: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  createdBy: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_created", ["orgId", "createdAt"]);

export const properties = defineTable({
  orgId: v.id("organizations"),
  title: localized,
  description: v.optional(localized),
  city: v.optional(localized),
  district: v.optional(localized),
  type: v.optional(v.string()),
  price: v.number(),
  currency: v.optional(v.string()),
  images: v.array(v.string()),
  features: v.optional(v.array(localized)),
  map: v.optional(
    v.object({
      latitude: v.number(),
      longitude: v.number(),
    }),
  ),
  published: v.boolean(),
  featured: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_published", ["orgId", "published"])
  .index("by_org_created", ["orgId", "createdAt"]);

export const interests = defineTable({
  orgId: v.id("organizations"),
  name: v.string(),
  email: v.optional(v.string()),
  phone: v.string(),
  message: v.optional(v.string()),
  propertyId: v.optional(v.id("properties")),
  source: v.optional(v.string()),
  read: v.boolean(),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_read", ["orgId", "read"])
  .index("by_property", ["propertyId"]);

export const posts = defineTable({
  orgId: v.id("organizations"),
  title: localized,
  excerpt: v.optional(localized),
  content: v.optional(localized),
  headerImage: v.optional(v.string()),
  thumbnail: v.optional(v.string()),
  status: v.union(
    v.literal("draft"),
    v.literal("published"),
    v.literal("archived"),
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org_status", ["orgId", "status"])
  .index("by_org_created", ["orgId", "createdAt"]);

export const services = defineTable({
  orgId: v.id("organizations"),
  title: localized,
  description: localized,
  image: v.optional(v.string()),
  features: v.array(localized),
  order: v.number(),
  enabled: v.boolean(),
  createdAt: v.number(),
}).index("by_org_order", ["orgId", "order"]);

export const contacts = defineTable({
  orgId: v.id("organizations"),
  name: v.string(),
  phoneNumber: v.string(),
  email: v.optional(v.string()),
  message: v.string(),
  reason: v.optional(v.string()),
  read: v.boolean(),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_created", ["orgId", "createdAt"]);

export const mapLocations = defineTable({
  orgId: v.id("organizations"),
  name: localized,
  address: v.optional(localized),
  city: v.optional(localized),
  country: v.optional(localized),
  description: v.optional(localized),
  latitude: v.number(),
  longitude: v.number(),
  enabled: v.boolean(),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_enabled", ["orgId", "enabled"]);

export const formField = v.object({
  id: v.string(),
  type: v.union(
    v.literal("text"),
    v.literal("textarea"),
    v.literal("email"),
    v.literal("phone"),
    v.literal("number"),
    v.literal("select"),
    v.literal("radio"),
    v.literal("checkbox"),
    v.literal("date"),
    v.literal("property"),
  ),
  label: localized,
  placeholder: v.optional(localized),
  required: v.boolean(),
  options: v.optional(
    v.array(
      v.object({
        label: localized,
        value: v.string(),
      }),
    ),
  ),
  propertyId: v.optional(v.id("properties")),
});

export const forms = defineTable({
  orgId: v.id("organizations"),
  name: localized,
  slug: v.string(),
  published: v.boolean(),
  fields: v.array(formField),
  settings: v.object({
    submitLabel: v.optional(localized),
    successMessage: v.optional(localized),
    redirectUrl: v.optional(v.string()),
    createLead: v.boolean(),
    createContact: v.boolean(),
  }),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_slug", ["orgId", "slug"]);

export const formSubmissions = defineTable({
  orgId: v.id("organizations"),
  formId: v.id("forms"),
  data: v.record(v.string(), v.string()),
  sourcePage: v.optional(v.string()),
  read: v.boolean(),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_form", ["orgId", "formId"])
  .index("by_form_created", ["formId", "createdAt"]);

export const conversations = defineTable({
  orgId: v.id("organizations"),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  status: v.union(v.literal("open"), v.literal("resolved")),
  lastMessageAt: v.number(),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_status", ["orgId", "status"])
  .index("by_org_last_message", ["orgId", "lastMessageAt"]);

export const messages = defineTable({
  orgId: v.id("organizations"),
  conversationId: v.id("conversations"),
  sender: v.union(v.literal("visitor"), v.literal("agent")),
  body: v.string(),
  read: v.boolean(),
  createdAt: v.number(),
})
  .index("by_conversation", ["conversationId"])
  .index("by_org", ["orgId"]);

export const events = defineTable({
  orgId: v.optional(v.id("organizations")),
  userId: v.optional(v.string()),
  type: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_created", ["orgId", "createdAt"])
  .index("by_type", ["type"]);

// Placeholder for future billing. Never called by client code yet.
export const subscriptions = defineTable({
  orgId: v.id("organizations"),
  stripeCustomerId: v.optional(v.string()),
  status: v.optional(v.string()),
  plan: v.optional(v.string()),
  currentPeriodEnd: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("by_org", ["orgId"])
  .index("by_customer", ["stripeCustomerId"]);

// ---------------------------------------------------------------------------
// Platform / beta access. Auth users live in the better-auth component; we
// keep app-level profile flags and invite codes here.
// ---------------------------------------------------------------------------

export const userProfiles = defineTable({
  userId: v.string(),
  betaAccess: v.boolean(),
  betaInviteCode: v.optional(v.string()),
  betaRedeemedAt: v.optional(v.number()),
  /** Optional display extras beyond better-auth user fields. */
  locale: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_user", ["userId"]);

export const betaInvites = defineTable({
  code: v.string(),
  maxUses: v.number(),
  usedCount: v.number(),
  active: v.boolean(),
  note: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  createdBy: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_code", ["code"])
  .index("by_active", ["active"]);

/** Singleton-ish platform knobs. Look up by `key === "global"`. */
export const platformConfig = defineTable({
  key: v.string(),
  /** When true, creating an organization requires betaAccess on the user profile. */
  betaRequired: v.boolean(),
  /** When false, redeem/invite still works but public marketing can show closed. */
  signupOpen: v.boolean(),
  maxOrgsPerUser: v.number(),
  /** Emails allowed to manage beta invites / platform settings (lowercase). */
  adminEmails: v.array(v.string()),
  /** Soft domain verify without DNS (true during beta). */
  softDomainVerify: v.boolean(),
  updatedAt: v.number(),
}).index("by_key", ["key"]);

export const cmsCollections = defineTable({
  orgId: v.id("organizations"),
  name: v.string(),
  slug: v.string(),
  fields: v.array(
    v.object({
      key: v.string(),
      label: v.string(),
      type: v.union(
        v.literal("text"),
        v.literal("richText"),
        v.literal("number"),
        v.literal("boolean"),
        v.literal("date"),
        v.literal("image"),
      ),
      required: v.boolean(),
    }),
  ),
  createdBy: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_slug", ["orgId", "slug"]);

export const cmsEntries = defineTable({
  orgId: v.id("organizations"),
  collectionId: v.id("cmsCollections"),
  status: v.union(v.literal("draft"), v.literal("published")),
  values: v.any(),
  createdBy: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_collection", ["collectionId"])
  .index("by_collection_status", ["collectionId", "status"]);

export const componentLibraries = defineTable({
  ownerType: v.union(
    v.literal("platform"),
    v.literal("organization"),
    v.literal("user"),
  ),
  orgId: v.optional(v.id("organizations")),
  userId: v.optional(v.string()),
  name: v.string(),
  slug: v.string(),
  description: v.optional(v.string()),
  access: v.union(v.literal("free"), v.literal("paid"), v.literal("private")),
  price: v.optional(v.number()),
  published: v.boolean(),
  manifest: v.any(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_owner_type", ["ownerType"])
  .index("by_org", ["orgId"])
  .index("by_user", ["userId"])
  .index("by_slug", ["slug"]);

export const libraryInstallations = defineTable({
  orgId: v.id("organizations"),
  libraryId: v.id("componentLibraries"),
  installedBy: v.string(),
  installedAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_library", ["orgId", "libraryId"]);

export const libraryEntitlements = defineTable({
  orgId: v.id("organizations"),
  libraryId: v.id("componentLibraries"),
  source: v.union(v.literal("plan"), v.literal("purchase")),
  status: v.union(v.literal("active"), v.literal("revoked")),
  externalReference: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_library", ["orgId", "libraryId"]);

export default defineSchema({
  organizations,
  memberships,
  projectFolders,
  projectFolderAssignments,
  domains,
  domainOrders,
  domainOrderEvents,
  redirectRules,
  dnsProviderConnections,
  registrarProviderSessions,
  registrarFundingSnapshots,
  languages,
  theme,
  siteSettings,
  pages,
  assets,
  properties,
  interests,
  posts,
  services,
  contacts,
  mapLocations,
  forms,
  formSubmissions,
  conversations,
  messages,
  events,
  subscriptions,
  userProfiles,
  betaInvites,
  platformConfig,
  cmsCollections,
  cmsEntries,
  componentLibraries,
  libraryInstallations,
  libraryEntitlements,
});
