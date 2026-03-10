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
- create-intent: creates Stripe Checkout Session, redirects to /success/:checkoutId if offers exist
- sync-product: syncs products to Stripe
- stripe-webhook: processes Stripe events, saves payment_method, creates offer_sessions
- offer-decision: processes accept/reject, one-click Stripe off-session charge, chains next offer
- generate-offer-url: creates offer_session with opaque token

## Upsell Flow (COMPLETE)
1. Checkout → Stripe payment → redirect to /success/:checkoutId
2. SuccessPage polls for order creation (webhook async), shows offer iframe
3. OfferFrame shows offer, customer accepts/rejects
4. offer-decision charges one-click if accepted, creates next offer_session
5. OfferFrame posts message to parent (SuccessPage) with nextToken
6. SuccessPage updates iframe src or shows completion
7. After all offers → auto-redirect to checkout.redirect_url

## Key Rules (from PRD)
- Card data NEVER touches server (Stripe Elements/Checkout)
- Webhook validated with stripe.webhooks.constructEvent()
- Duplicate charge protection via stripe_webhook_events table
- UTMs captured from URL → sessionStorage → order metadata
- Offer security: opaque UUID token saved in DB, expires in 30min
- setup_future_usage: "off_session" set when checkout has offers
