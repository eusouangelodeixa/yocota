Yocota checkout system - dark financial dashboard design system

## Design System (v3 - Functional Minimalism)
- Background: HSL 240 6% 4% (#09090b)
- Card: HSL 240 6% 10% (#18181b), border #27272a
- Input bg: HSL 240 5% 8% (#111113)
- Primary accent: #28d56a (green), hover #22c55e
- Text: #fafafa / #a1a1aa / #52525b / #3f3f46
- Danger: #ef4444, Warning: #f59e0b, Info: #3b82f6
- Radius: sm=6px, md=10px, lg=14px, pill=9999px
- Font: Inter, weight 400/500/600/700
- Shadows: card-surface, card-elevated (defined in index.css)
- Sidebar: 56px fixed icon-only, tooltips on hover
- Topbar: 56px, breadcrumb left, avatar+bell right
- Tables: bg-input header, 11px uppercase tracking-wider labels
- Status pills: pill-paid/pill-pending/pill-failed/pill-sent classes
- Buttons: h-9/h-10, font-bold, hover:brightness-110, active:scale-[0.98]
- Icons: strokeWidth={1.5}, 18px in sidebar, 14px in buttons
- No gradients, no colored shadows, no filled icons, no animations >300ms

## Stack
- NextAuth → Supabase Auth (email/password)
- All monetary values in centavos (integer)
- Language: PT-BR throughout UI
- 9 tables + stripe_webhook_events
- RLS: authenticated=admin, anon=public checkout

## Checkout Public Page
- Two-panel: left summary (45%) sticky, right form (55%)
- Dark theme: #09090b bg, #111113 inputs, #27272a borders
- Focus: border-[#28d56a] + ring rgba(40,213,106,0.15)
