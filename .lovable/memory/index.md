Yocota checkout system - unified design system across landing page and admin

## Design System (v4 - Landing Page Unified)
- Background: HSL 0 0% 4% (#0A0A0A)
- Card: HSL 200 8% 11% (#1C2022), border HSL 200 4% 16%
- Input bg: HSL 200 6% 9%
- Primary accent: #E04B00 (burnt orange), hover #B83D00
- Text: #fafafa / #888 / #555 / #333
- Success: #3ECA7A, Warning: #f59e0b, Info: #3b82f6, Danger: #ef4444
- Radius: sm=6px, md=10px, lg=14px, pill=9999px
- Font: Outfit, weight 300-800
- Shadows: card-surface, card-elevated (defined in index.css)
- Logo: SVG 3-circle pattern in primary color (YocotaLogo component)
- Sidebar: 56px fixed icon-only, tooltips on hover
- Topbar: 56px, breadcrumb left, avatar+bell right
- Tables: bg-input header, 11px uppercase tracking-wider labels
- Status pills: pill-paid/pill-pending/pill-failed/pill-sent classes
- Buttons: h-9/h-10, font-bold, hover:brightness-110, active:scale-[0.98]
- Icons: strokeWidth={1.5}, 18px in sidebar, 14px in buttons
- No filled icons, no animations >300ms

## Stack
- Supabase Auth (email/password)
- All monetary values in centavos (integer)
- Language: PT-BR throughout UI
- 9 tables + stripe_webhook_events
- RLS: authenticated=admin, anon=public checkout

## Checkout Public Page
- Two-panel: left summary (45%) sticky, right form (55%)
- Dark theme: #0A0A0A bg, inputs, borders
- Focus: border-primary + ring primary/15

## Landing Page
- Self-contained CSS via dangerouslySetInnerHTML (scoped .landing-page)
- Same design tokens: #E04B00, #0A0A0A, #E0E5DF, #1C2022
- Font: Outfit
- Logo: 3-circle SVG
