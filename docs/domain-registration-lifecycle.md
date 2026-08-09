# Domain registration lifecycle

Status: **registration checkout disabled**. Bring-your-own domains, DNS
verification, Vercel routing and managed TLS, host redirects, and path redirects remain the
only customer-facing domain capabilities.

## Provider boundary

W-AI keeps three systems deliberately separate:

1. **Dodo Payments** collects the retail charge from the customer.
2. **Openprovider** registers and renews the domain from W-AI's prepaid reseller
   balance. The customer is recorded as the registrant.
3. **Vercel** attaches the verified hostname to the tenant project, verifies DNS,
   routes requests, and provisions TLS.

Domainee can later replace steps 2 and 3 for a simpler managed flow. Its public
Buy-a-Domain API describes quote-then-buy, charges the platform's saved Stripe
card off-session, registers the end user as legal owner, auto-connects DNS/TLS,
and automatically refunds the platform charge when upstream registration fails.

## The three ledgers that must never be confused

- **Customer payment status** answers: “Did Dodo successfully charge the user?”
- **Dodo payout settlement** answers: “Did that collected money reach W-AI's
  merchant payout?”
- **Registrar available balance** answers: “Can W-AI buy or renew the domain
  right now?”

With Openprovider, the third number is the operationally urgent one.
Openprovider is prepaid and deducts registration/renewal cost immediately. Dodo
merchant payouts arrive later: its documented default is two payout cycles per
month, subject to threshold, fees, refunds, verification, and bank transit.
Consequently, a successful customer payment is a receivable, not immediately
spendable registrar balance. The registrar balance moves first when a domain is
ordered; Dodo settlement replenishes platform cash later.

Recommended operating rule:

```text
registrar available balance
  - pending provider commitments
  - renewal reserve
  >= requested provider cost
```

Customer-paid-but-unsettled amounts are reported next to this calculation but
are never added to registrar available balance. The authoritative balance comes
from Openprovider's read-only `GET /v1beta/resellers?with_settings=true`
response: `balance` is the available reseller balance, `reserved_balance` is
the amount Openprovider has reserved for its pending transactions, and
`settings.currency` is the account currency. W-AI converts this response to
currency-aware minor units and stores an immutable internal snapshot.

The pure `evaluateRegistrarReserve` policy is enforced by the internal
`queueFulfillment` transition. That transition accepts only an Openprovider
snapshot no more than five minutes old, derives W-AI's pending provider
commitments from server-side orders, rejects currency mismatches and expired
quotes, and stores the snapshot reference, renewal reserve, operationally
available amount, and check time for audit. A browser cannot supply or reduce
the balance or pending-commitment values. No spend-capable provider call is
wired to this path while purchasing remains disabled.

Enable Openprovider automatic balance top-up and alert before the reserve is
crossed. Never wait for the next Dodo payout to fund a registration that the UI
promises is immediate.

## Future native checkout sequence

1. Search Openprovider availability and obtain a short-lived authoritative
   price in the provider currency.
2. Create a `domainOrders` quote with a unique idempotency key. Persist wholesale
   cost, retail charge, markup, currencies, and expiry. Do not persist card data.
   Reusing a key is accepted only when every authoritative quote field is an
   exact replay; a changed hostname, tenant, price, currency, provider, expiry,
   or renewal choice is rejected.
3. Create a one-time Dodo checkout for the exact retail amount. The success URL
   is presentation only; it must not trigger registration. Persist the checkout
   ID against the still-valid quote before giving the checkout URL to the browser.
4. Verify the signed `payment.succeeded` webhook. Deduplicate by Dodo's webhook
   ID, require the same recorded checkout ID, and confirm the exact
   amount/currency/order metadata before moving the order to
   `payment_succeeded`. A success event without a recorded checkout, or for a
   replaced checkout, is rejected rather than guessed into an order.
5. Queue one registrar fulfillment job. Before calling Openprovider, confirm:
   payment is still succeeded, quote is valid, domain is still available, and
   prepaid balance is sufficient. The current state machine already enforces
   quote freshness and the protected-reserve calculation before an order can
   enter `fulfillment_pending`.
6. Register with the customer as legal registrant. Send the order ID as the
   provider idempotency/reference key where supported. Persist the returned
   provider order ID once; the same provider identity may never be assigned to
   another customer order.
7. Persist the registrar domain ID and expiry, then create/attach the hostname in
   the existing domain subsystem and Vercel. A registrar domain ID is unique per
   provider and success is rejected unless its expiration is a valid future
   timestamp. Verification/TLS completion moves the order from `registered` to
   `routing` to `active`.
8. If registration fails after payment, mark `refund_pending`, create a Dodo
   refund exactly once, and close only after the signed refund webhook confirms
   it. Never substitute another TLD without customer consent.

## Existing-domain routing available now

Existing customer-owned domains do not enter the commercial order lifecycle.
W-AI derives the registrable DNS zone using the Public Suffix List rather than a
last-two-label heuristic, so roots such as `example.co.uk` and `example.com.au`
receive apex instructions while `www.example.co.uk` receives subdomain
instructions. The user publishes the displayed routing and ownership records;
W-AI attaches the hostname to Vercel, verifies ownership and project routing,
and then serves or redirects tenant traffic. Vercel automatically requests a
certificate after DNS verification. Project-domain verification and certificate
issuance are separate platform steps, so the product must not claim that TLS is
active solely because the project-domain verification response is `verified`.
W-AI therefore records certificate status and expiration separately and only
marks a serving hostname active after an unexpired certificate covers that exact
hostname (or a valid single-label wildcard covers it). Until then, the domain
remains in the visible `TLS provisioning` state and tenant routing stays closed.

Routing instructions come from Vercel's domain-configuration endpoint after the
hostname is attached. W-AI stores the rank-1 project-specific CNAME and IPv4
recommendations instead of assuming the legacy global records. The generic
targets remain compatibility fallbacks only when Vercel returns no usable
recommendation.

Verification is not a one-time trust decision. Pending domains use bounded
automatic retries after attachment. Verified domains are revalidated every 24
hours by a 15-minute batched sweep. A missing ownership record, changed routing
target, or failed Vercel verification removes the hostname from tenant serving
and starts the bounded recovery retry chain. Transient provider failures retain
the last verified state and retry the health check in one hour, avoiding an
outage caused solely by a temporary API failure.

Manual DNS remains the default. A user may optionally connect a scoped
Cloudflare API token (Zone Read + DNS Write) and let W-AI create the routing,
ownership, and Vercel challenge records. Once connected, the Domains screen can
also list and create A, AAAA, CNAME, TXT, and CAA records beneath that exact
hostname. Every provider record ID is resolved before an edit or delete, so a
record belonging to a sibling hostname in the same DNS zone cannot be changed.
W-AI routing, ownership, and TLS challenge records are visible but read-only.
MX writing stays unavailable until priority-specific controls are implemented;
existing MX records may still be viewed.

Domain ownership transitions preserve redirect integrity. A verified hostname
cannot be reassigned to another site or detached while another hostname points
to it, or while it still has hostname-specific path redirect rules. The user
must review and remove those rules first; W-AI never silently deletes them or
moves them into a different site's redirect namespace.

Host redirects are applied by Vercel and expose all four project-domain status
codes: 301, 302, 307, and 308. W-AI defaults new host redirects to 308 because
it is permanent and preserves the request method and body; users may select a
different code when legacy client behavior is intentional. Request-path rules
remain 307/308 because the current Next.js server redirect primitives emit
those unambiguous method-preserving codes.

The request proxy reserves framework asset paths only. Application paths such
as `/api` and `/c` are bypassed only on W-AI's own host; on a tenant subdomain
or verified custom domain they remain customer-owned URL space. This also
prevents ordinary routes such as `/contact` and `/catalog` from being mistaken
for the internal `/c` namespace. The internal rewrite target is also bound back
to the incoming hostname before any site data or redirect rule is resolved, so
an application-host request cannot select another tenant by changing the route
slug. Exact-page and section-prefix rules may share
the same source path: for example, `/docs` can move to `/documentation` while
`/docs/*` moves descendants to `/reference/:splat`. Exact rules win, followed
by the longest matching prefix. Loop checks follow absolute destinations that
belong to the same site across tenant and custom hostnames. A hostname that is
itself configured as a host redirect cannot own path rules because Vercel will
redirect the request before those rules could execute.

## State axes

`domainOrders.state` is the customer-visible orchestration state. It is backed by
independent axes:

- `paymentStatus`: not started → pending → succeeded, or failed/refunded/disputed
- `settlementStatus`: not started → pending → settled/reversed
- `providerStatus`: not started → pending → succeeded/failed

The payment-success webhook moves `settlementStatus` to `pending`. Registrar
fulfillment may complete from the protected prepaid reserve while settlement is
still pending. A later payout webhook changes only the settlement axis, never
the registration or routing state.

`domainOrderEvents` is append-only and uses globally unique event keys to make
webhook retries safe. It stores redacted operational metadata only—never card
details or complete registrant contact data.

All spend-capable mutations are internal. The current public endpoint explicitly
returns `enabled: false`, so accidentally rendering a future checkout cannot
place a registrar order.

The dormant Dodo transition also enforces the commercial identity of a payment:
checkout ID, ISO currency, and integer minor-unit amount must all match the
authoritative quote. Checkout cannot start after quote expiry, and a second
checkout cannot replace the first one. These checks are server-side invariants;
the future webhook adapter must supply verified provider fields rather than
browser values.

Registration quotes also reserve the hostname globally, not merely inside one
workspace. While an unpaid quote is valid, another tenant cannot create a
second registration order for that hostname. An expired unpaid quote releases
the reservation, but a paid, fulfilling, registered, routing, active, or
refund-pending order continues to hold it. This closes the platform-side race;
the future fulfillment action must still recheck live registry availability
immediately before spending because another registrar can buy the name.

Provider callbacks have the same identity discipline. Blank provider IDs are
rejected; provider order IDs and registrar domain IDs are uniquely bound to one
domain order; a callback cannot replace either identity after it is recorded;
and provider success requires a future registration expiration. This prevents a
retried or misrouted registrar callback from crediting the same purchased domain
to two tenants.

The Openprovider boundary is implemented as a read-only typed client. It can
authenticate against the isolated sandbox, parse batch availability/price
responses, and record an authoritative reseller-funding snapshot, but it
deliberately exposes no registration, renewal, transfer, restore, or other spend
method. Internal-only readiness and funding actions can probe the account
without placing an order. Production credentials remain Convex environment
variables; they are never stored in a table or returned to a browser. Successful
bearer tokens are AES-GCM encrypted and cached in an internal-only table for 47
hours, one hour less than Openprovider's documented 48-hour lifetime. This
prevents operator checks—and later read-only availability batches—from consuming
the authentication rate limit.

## Renewal lifecycle

- Default auto-renew may be offered, but the customer must explicitly accept the
  renewal price and terms.
- Re-price and charge 35–45 days before expiry; register/renew only after payment
  succeeds.
- Retry payment with clear dunning notices. Alert operators if registrar balance
  falls below the renewal reserve.
- Track registry grace/redemption windows per TLD. Restoration is a separate,
  usually higher-priced operation and needs explicit confirmation.
- A user must always have an ownership exit: disable auto-renew, obtain transfer
  auth/EPP code when eligible, unlock, and transfer out.

## Refund and risk rules

- A registration normally cannot be undone once the registry accepts it; the
  customer-facing refund policy must state that non-recoverable domain fees are
  non-refundable except where law requires otherwise.
- If W-AI charged but never obtained the domain, refund the customer.
- Reserve for chargebacks even after a successful registration because W-AI may
  lose the customer payment while the domain cost remains non-recoverable.
- Keep terms acceptance, registrant authorization, provider response, DNS/TLS
  result, and webhook IDs in the audit trail.
- Registrant PII requires a separate encrypted/tokenized contact store and
  retention policy before launch.

## Sources checked (August 2026)

- [Openprovider: prepaid balance is required to order or register](https://support.openprovider.eu/hc/en-us/articles/216648658-Increase-your-balance)
- [Openprovider: REST authentication and production base URL](https://support.openprovider.eu/hc/en-us/articles/360025683173-Getting-started-with-Openprovider-API)
- [Openprovider: isolated sandbox and its limitations](https://support.openprovider.eu/hc/en-us/articles/8095671860114-Sandbox-Testing-Environment)
- [Openprovider: domain availability request contract](https://support.openprovider.eu/hc/en-us/articles/360025299493-2-Domains-API-Check-Domain)
- [Openprovider: authoritative REST schema](https://docs.openprovider.com/swagger.json)
- [Dodo Payments: payout cycles and thresholds](https://docs.dodopayments.com/miscellaneous/faq)
- [Dodo Payments: payout processing and bank timing](https://docs.dodopayments.com/features/payouts/payout-structure)
- [Dodo Payments: webhook event guide](https://docs.dodopayments.com/developer-resources/webhooks/intents/webhook-events-guide)
- [Domainee Buy-a-Domain API](https://domainee.dev/buy-domain-api)
- [Domainee custom-domain pricing](https://domainee.dev/docs/pricing)
- [Vercel: set up a custom domain and verify SSL separately](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel: automatic SSL certificate provisioning](https://vercel.com/docs/domains/working-with-ssl)
