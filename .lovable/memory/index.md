Checkout system with upsell engine - Phase 1 & 2 fully implemented using React+Vite+Supabase

## Stack Mapping
- NextAuth → Supabase Auth (email/password)
- Prisma → Supabase Client + Database
- Next.js Route Handlers → Supabase Edge Functions
- BullMQ + Redis → Supabase Edge Functions + pg_cron (future phases)

## Design System
- Primary: HSL 220 90% 56% (vibrant blue)
- All monetary values in centavos (integer)
- Language: PT-BR throughout UI

## Database
- 10 tables: products, checkouts, customers, orders, order_items, offers, offer_sessions, deliveries, abandoned_checkouts, stripe_webhook_events
- offer_sessions uses opaque UUID token (no HMAC) for iframe security
- checkouts.first_offer_id links to first offer in funnel
- Enums: product_type, delivery_type, order_status, order_item_type, delivery_status

## Edge Functions
- create-intent: creates Stripe Checkout Session, redirects to /success/:checkoutId if offers exist, adds setup_future_usage for card saving
- sync-product: syncs products to Stripe
- stripe-webhook: processes Stripe events, saves payment_method, creates offer_sessions
- offer-decision: processes accept/reject, one-click Stripe off-session charge, chains next offer, returns next_offer_page_url + next_offer_token
- generate-offer-url: creates offer_session with opaque token

## Upsell Flow — Two Modes
### Mode 1: External Page (recommended)
1. Offer has page_url set → after payment, SuccessPage redirects to page_url?offer_token=TOKEN
2. External page has iframe embed code (copied from admin button <Code>)
3. Iframe loads /offer-frame/TOKEN, shows accept/reject
4. On decision, iframe posts message to parent with nextPageUrl + nextToken
5. Parent JS redirects to next offer's page_url or shows completion

### Mode 2: Inline (automatic)
1. Offer has NO page_url → SuccessPage shows iframe directly
2. On decision, SuccessPage updates iframe src with next token
3. After all offers → auto-redirect to checkout.redirect_url

## Key Rules (from PRD)
- Card data NEVER touches server (Stripe Elements/Checkout)
- Webhook validated with stripe.webhooks.constructEvent()
- Duplicate charge protection via stripe_webhook_events table
- UTMs captured from URL → sessionStorage → order metadata
- Offer security: opaque UUID token saved in DB, expires in 30min
- setup_future_usage: "off_session" set when checkout has offers
