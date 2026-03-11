Checkout system with upsell engine - Dark financial dashboard theme (Monetra-inspired). System name: **Yocota**

## Stack Mapping
- NextAuth → Supabase Auth (email/password)
- Prisma → Supabase Client + Database
- Next.js Route Handlers → Supabase Edge Functions
- BullMQ + Redis → Supabase Edge Functions + pg_cron (future phases)

## Design System (Dark Theme)
- Background: #0a0a0a (HSL 0 0% 4%)
- Cards: #171717 with border rgba(255,255,255,0.06), shadow card-glass utility
- Primary: #28d56a (HSL 145 67% 50%) — green accent
- Primary foreground: #0a0a0a (dark text on green)
- Text: #fff primary, #888 secondary, #555 tertiary
- Destructive: #ef4444
- Font: Inter, weight 700 titles, 500 labels, 400 body
- Border radius: 12px cards, 8px inputs, 999px badges
- Status badges: paid=#28d56a18/#28d56a, pending=#78350f22/#fbbf24, failed=#ef444418/#ef4444, sent=#3b82f618/#60a5fa
- Shimmer skeleton loader utility class
- Transitions: 150ms ease on hovers

## Database
- 10 tables (+ site_settings singleton) + stripe_webhook_events
- Enums: product_type, delivery_type, order_status, order_item_type, delivery_status
- RLS: authenticated=admin, anon=public checkout operations

## Edge Functions
- create-intent, sync-product, stripe-webhook, delivery-send, offer-decision, generate-offer-url, recovery-send, test-uazapi, update-secrets
- UazAPI: endpoint /send/text, header "token", body { number, text }

## Key Rules
- Card data NEVER touches server (Stripe Elements)
- Webhook validated with stripe.webhooks.constructEvent()
- Duplicate charge protection via stripe_webhook_events
- UTMs captured from URL → sessionStorage → order metadata
- All monetary values in centavos (integer)
- Language: PT-BR throughout UI
- System name: Yocota (NOT Cashflow)

## Removals/Rejections
- Settings page: user rejected simple brand-only settings; wants API keys (Stripe, UazAPI, Utmify) + profile editing
