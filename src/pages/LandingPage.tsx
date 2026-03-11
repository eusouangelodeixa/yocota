import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();
  const detailSectionRef = useRef<HTMLElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const counterRef = useRef<HTMLSpanElement>(null);
  const counterStartedRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add('lp-active');
    return () => { document.documentElement.classList.remove('lp-active'); };
  }, []);

  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    const ro = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); ro.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => ro.observe(el));
    const counterObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && !counterStartedRef.current) {
          counterStartedRef.current = true;
          const el = counterRef.current;
          if (!el) return;
          const target = 12480, duration = 1800, start = performance.now();
          const update = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('pt-BR');
            if (p < 1) requestAnimationFrame(update);
          };
          requestAnimationFrame(update);
        }
      });
    }, { threshold: 0.2 });
    if (detailSectionRef.current) counterObs.observe(detailSectionRef.current);
    return () => { ro.disconnect(); counterObs.disconnect(); };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const section = detailSectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      const pct = Math.max(0, Math.min(1, -rect.top / total));
      if (pct < 0.33) setCurrentFrame(0);
      else if (pct < 0.66) setCurrentFrame(1);
      else setCurrentFrame(2);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="landing-page">
        <nav className="lp-nav">
          <a href="#" className="nav-logo" onClick={e => e.preventDefault()}>
            <div className="nav-logo-icon"><svg viewBox="0 0 28 28" fill="none"><circle cx="14" cy="8" r="5" fill="#E04B00"/><circle cx="8" cy="20" r="5" fill="#E04B00" opacity="0.7"/><circle cx="20" cy="20" r="5" fill="#E04B00" opacity="0.5"/></svg></div>
            <span className="nav-logo-text">yocota</span>
          </a>
          <div className="nav-actions">
            <a href="#features" className="nav-link">Funcionalidades</a>
            <a href="#how" className="nav-link">Como funciona</a>
            <button className="btn-nav" onClick={() => navigate('/login')}>Acessar painel</button>
          </div>
        </nav>
        <div className="page">
          <section className="hero-wrapper">
            <div className="hero-card">
              <div className="hero-left">
                <p className="hero-overline">Checkout · Upsell · Recuperação de Vendas</p>
                <h1 className="hero-headline"><span>Venda mais.</span><span>Perca menos.</span><span>Automatize.</span></h1>
                <button className="btn-hero" onClick={() => document.querySelector('#features')?.scrollIntoView({ behavior: 'smooth' })}>Ver funcionalidades</button>
              </div>
              <div className="hero-right">
                <div className="checkout-mockup">
                  <div className="checkout-card">
                    <div className="checkout-card-header">
                      <p className="product-name">Mentoria Premium</p>
                      <div className="product-price"><sup>R$</sup>297<span className="cents">,00</span></div>
                    </div>
                    <div className="checkout-card-body">
                      <div className="form-row"><label className="form-label">Nome completo</label><input className="form-input filled" defaultValue="João Henrique" readOnly /></div>
                      <div className="form-row"><label className="form-label">E-mail</label><input className="form-input filled" defaultValue="joao@email.com" readOnly /></div>
                      <div className="form-row"><label className="form-label">Telefone</label><input className="form-input filled" defaultValue="(11) 99999-8888" readOnly /></div>
                      <div className="form-row">
                        <label className="form-label">Cartão de crédito</label>
                        <input className="form-input filled" defaultValue="•••• •••• •••• 4242" readOnly style={{ letterSpacing: '0.05em' }} />
                        <div className="card-row" style={{ marginTop: 8 }}><input className="form-input filled" defaultValue="12/27" readOnly /><input className="form-input filled" defaultValue="•••" readOnly /></div>
                      </div>
                      <div className="order-bump-row">
                        <div className="order-bump-check"><svg viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                        <div className="order-bump-text"><div className="bump-title">+ Bônus: Planilha de Métricas</div><div className="bump-sub">Adicionar ao meu pedido</div></div>
                        <span className="order-bump-price">+R$47</span>
                      </div>
                      <button className="btn-checkout"><svg viewBox="0 0 16 16" fill="none"><path d="M2 8h12M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>Finalizar Compra — R$344,00</button>
                      <div className="secure-badge"><svg viewBox="0 0 12 12" fill="none"><path d="M6 1L2 3v3c0 2.5 1.8 4.3 4 5 2.2-.7 4-2.5 4-5V3L6 1z" stroke="#AAA" strokeWidth="1"/></svg>Pagamento 100% seguro · SSL · Stripe</div>
                    </div>
                  </div>
                  <div className="upsell-float">
                    <div className="uf-label">🔥 Oferta exclusiva</div>
                    <div className="uf-title">Consultoria 1:1 por 60 min</div>
                    <div className="uf-price">R$197<span style={{ fontSize: 13, fontWeight: 500, color: '#666' }}>,00</span></div>
                    <div className="uf-btns"><div className="uf-btn-yes">Sim, quero!</div><div className="uf-btn-no">Não, obrigado</div></div>
                  </div>
                </div>
              </div>
              <div className="hero-tagline-bar">
                <p className="hero-tagline">Checkout profissional com funil de upsell one-click</p>
                <button className="btn-cta-sm" onClick={() => navigate('/login')}>Começar agora</button>
              </div>
            </div>
          </section>

          <section className="features-section" id="features">
            <div className="features-header reveal">
              <h2 className="features-headline">Tudo que você precisa para vender mais</h2>
              <button className="btn-cta-sm" onClick={() => navigate('/login')}>Criar meu checkout</button>
            </div>
            <div className="features-grid">
              <div className="feat-card reveal reveal-d1">
                <div className="feat-card-visual"><div className="feat-card-ui">
                  <div className="fc-metric">R$12.480</div><div className="fc-label">Faturamento hoje</div>
                  <div className="fc-pill-row"><span className="fc-pill accent">↑ 24% vs ontem</span><span className="fc-pill">8 pedidos</span><span className="fc-pill">R$1.560 ticket médio</span></div>
                  <div className="fc-row"><div className="fc-mini-btn">📋 Pedidos</div><div className="fc-mini-btn">🔗 Meu checkout</div><div className="fc-mini-btn">⚙️ Config</div></div>
                </div></div>
                <div className="feat-card-body"><div className="feat-card-title">Checkout inteligente</div><div className="feat-card-desc">Crie checkouts com slug personalizado, order bump e integração nativa com Stripe. Captura UTMs automaticamente.</div><span className="bullet-link">Criar checkout</span></div>
              </div>
              <div className="feat-card reveal reveal-d2">
                <div className="feat-card-visual"><div className="feat-card-ui">
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>Árvore de decisão</div>
                  <div className="fc-tree-node"><span className="dot"></span> Checkout aprovado → Oferta 1</div><div className="fc-connector"></div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ flex: 1 }}><div className="fc-tree-node"><span className="dot green"></span> Aceitar → Upsell 2</div><div className="fc-connector"></div><div className="fc-tree-node"><span className="dot green"></span> Obrigado 🎉</div></div>
                    <div style={{ flex: 1 }}><div className="fc-tree-node"><span className="dot red"></span> Recusar → Downsell</div><div className="fc-connector"></div><div className="fc-tree-node"><span className="dot"></span> Obrigado</div></div>
                  </div>
                </div></div>
                <div className="feat-card-body"><div className="feat-card-title">Motor de upsell</div><div className="feat-card-desc">Funil dinâmico de upsell e downsell via árvore de decisões. Cobranças one-click sem novo preenchimento de cartão.</div><span className="bullet-link">Configurar funil</span></div>
              </div>
              <div className="feat-card reveal reveal-d3">
                <div className="feat-card-visual"><div className="feat-card-ui">
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>WhatsApp automático</div>
                  <div className="whatsapp-msg"><div className="ws-name">Yocota · Entrega</div>Olá, <strong>João</strong>! 🎉 Seu acesso à <strong>Mentoria Premium</strong> está pronto. Clique abaixo para acessar.</div>
                  <div className="whatsapp-msg" style={{ marginTop: 8, background: 'rgba(224,75,0,0.1)', borderColor: 'rgba(224,75,0,0.25)' }}><div className="ws-name" style={{ color: '#E04B00' }}>Yocota · Recuperação</div>Oi! Você deixou algo no carrinho 👀 Sua oferta expira em breve: <strong>yocota.co/r/abc123</strong></div>
                </div></div>
                <div className="feat-card-body"><div className="feat-card-title">WhatsApp automático</div><div className="feat-card-desc">Entrega do produto e recuperação de carrinhos abandonados via WhatsApp. Tudo automático, sem ação manual.</div><span className="bullet-link">Ver automações</span></div>
              </div>
            </div>
          </section>

          <section className="detail-section" id="detail" ref={detailSectionRef}>
            <div className="detail-sticky">
              <div className="detail-overline"><span>Checkout</span><span>Upsell one-click</span><span>Recuperação</span></div>
              <div><h2 className="detail-headline">Funil de vendas<br/>sem esforço</h2><button className="btn-hero">• Ver demo</button></div>
              <div className="detail-bottom"><div className="detail-sub-title">Motor de decisões</div><div className="detail-sub-text">Configure árvores de upsell e downsell visualmente. O sistema cuida das cobranças, entregas e notificações automaticamente.</div><span className="bullet-link">Explorar motor</span></div>
            </div>
            <div className="detail-right">
              <div className="detail-frames">
                <div className={`detail-frame ${currentFrame === 0 ? 'active' : ''}`}>
                  <div className="df-header"><span className="df-title">Dashboard</span><div className="df-icons"><div className="df-icon"></div><div className="df-icon"></div></div></div>
                  <div className="df-body">
                    <div className="df-balance-block"><div className="df-bal-label">Faturamento hoje</div><div className="df-bal-value">R$<span ref={counterRef}>0</span><span className="df-bal-cents">,00</span></div><div className="df-bal-change">↑ 5.20% vs ontem</div></div>
                    <div className="df-actions"><div className="df-action-btn"><div className="df-action-icon">📋</div><div className="df-action-label">Pedidos</div></div><div className="df-action-btn"><div className="df-action-icon">🔗</div><div className="df-action-label">Checkout</div></div><div className="df-action-btn"><div className="df-action-icon">📦</div><div className="df-action-label">Produtos</div></div></div>
                    <div className="df-list-item"><div><div className="df-list-title">Buy</div><div className="df-list-sub">Novo pedido recebido</div></div><div className="df-list-arrow">→</div></div>
                    <div className="df-list-item"><div><div className="df-list-title">Receive</div><div className="df-list-sub">Entrega pendente</div></div><div className="df-list-arrow">→</div></div>
                  </div>
                </div>
                <div className={`detail-frame ${currentFrame === 1 ? 'active' : ''}`}>
                  <div className="df-header"><span className="df-title">Novo Checkout</span><div className="df-icons"><div className="df-icon"></div><div className="df-icon"></div></div></div>
                  <div className="df-body" style={{ paddingTop: 16 }}>
                    <div className="df-swap-field"><div><div className="df-swap-amount empty">mentoria-premium</div><div className="df-swap-sub">Slug da URL pública</div></div></div>
                    <div className="df-swap-arrow">↓</div>
                    <div className="df-swap-field"><div><div className="df-swap-amount empty">R$ 0</div><div className="df-swap-sub">Preço do produto</div></div><div className="df-token-badge"><div className="df-token-icon usdc"></div><span className="df-token-name">BRL</span></div></div>
                    <div className="df-pct-row"><div className="df-pct-btn">Principal</div><div className="df-pct-btn active">Upsell</div><div className="df-pct-btn">Downsell</div><div className="df-pct-btn">Bump</div></div>
                    <div className="df-numpad"><div className="df-num">1</div><div className="df-num">2</div><div className="df-num">3</div><div className="df-num">4</div><div className="df-num">5</div><div className="df-num">6</div><div className="df-num">7</div><div className="df-num">8</div><div className="df-num">9</div><div className="df-num">.</div><div className="df-num">0</div><div className="df-num" style={{ color: '#E04B00' }}>⌫</div></div>
                  </div>
                </div>
                <div className={`detail-frame ${currentFrame === 2 ? 'active' : ''}`}>
                  <div className="df-header"><span className="df-title">Funil Ativo</span><div className="df-icons"><div className="df-icon"></div><div className="df-icon"></div></div></div>
                  <div className="df-body" style={{ paddingTop: 16 }}>
                    <div className="df-swap-field"><div><div className="df-swap-amount filled">R$297</div><div className="df-swap-sub">Mentoria Premium · Principal</div></div><div className="df-token-badge"><div className="df-token-icon usdc"></div><span className="df-token-name">PAGO</span></div></div>
                    <div className="df-swap-arrow" style={{ color: '#E04B00' }}>↓</div>
                    <div className="df-swap-field"><div><div className="df-swap-amount" style={{ color: '#fff', fontSize: 20 }}>Oferta 1 · Consultoria</div><div className="df-swap-sub">One-click · R$197</div></div><div className="df-token-badge"><div className="df-token-icon eth"></div><span className="df-token-name">UPSELL</span></div></div>
                    <div className="df-pct-row"><div className="df-pct-btn active">25% conv.</div><div className="df-pct-btn">50% recusa</div><div className="df-pct-btn">Downsell</div></div>
                    <button className="df-select-token-btn">Ver relatório do funil →</button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="stats-section">
            <div className="stats-grid">
              <div className="stat-cell reveal"><div className="stat-number"><span>∞</span></div><div className="stat-label">Checkouts e produtos sem limite de cadastro</div></div>
              <div className="stat-cell reveal reveal-d1"><div className="stat-number">1<span>-click</span></div><div className="stat-label">Cobranças de upsell sem novo preenchimento de cartão</div></div>
              <div className="stat-cell reveal reveal-d2"><div className="stat-number">30<span>min</span></div><div className="stat-label">Tempo até o WhatsApp de recuperação de carrinho</div></div>
              <div className="stat-cell reveal reveal-d3"><div className="stat-number">3<span>x</span></div><div className="stat-label">Tentativas automáticas de entrega em caso de falha</div></div>
            </div>
          </section>

          <section className="how-section" id="how">
            <div className="how-header reveal"><h2 className="how-headline">Como funciona<br/>em 4 passos</h2><p className="how-sub">Do cadastro do produto ao pagamento confirmado, tudo acontece de forma automática e segura.</p></div>
            <div className="steps-grid">
              <div className="step-card reveal"><div className="step-num">01</div><div className="step-icon">📦</div><div className="step-title">Cadastre seu produto</div><div className="step-desc">Crie o produto no painel e o Yocota sincroniza automaticamente com o Stripe, criando Product e Price.</div><div className="step-arrow">→</div></div>
              <div className="step-card reveal reveal-d1"><div className="step-num">02</div><div className="step-icon">🔗</div><div className="step-title">Configure o checkout</div><div className="step-desc">Defina o slug, URL de redirecionamento, order bump opcional e a mensagem de entrega via WhatsApp.</div><div className="step-arrow">→</div></div>
              <div className="step-card reveal reveal-d2"><div className="step-num">03</div><div className="step-icon">⚡</div><div className="step-title">Monte seu funil</div><div className="step-desc">Crie ofertas de upsell e downsell encadeadas. O motor decide a próxima oferta baseado na resposta do cliente.</div><div className="step-arrow">→</div></div>
              <div className="step-card reveal reveal-d3"><div className="step-num">04</div><div className="step-icon">🚀</div><div className="step-title">Venda no piloto automático</div><div className="step-desc">Pagamentos processados, entregas disparadas, carrinhos recuperados e UTMs rastreadas. Tudo sozinho.</div></div>
            </div>
          </section>

          <section className="integrations-section" id="integrations">
            <div className="int-header reveal"><h2 className="int-headline">Integrações nativas</h2><p className="int-sub">Stack tecnológica sólida com as melhores ferramentas do mercado.</p></div>
            <div className="int-grid">
              <div className="int-card reveal reveal-d1"><div className="int-icon stripe">💳</div><div className="int-body"><div className="int-name">Stripe</div><div className="int-desc">Processamento PCI DSS nível 1. PaymentIntent, cobranças off-session para upsells e gestão de clientes.</div></div></div>
              <div className="int-card reveal reveal-d2"><div className="int-icon wa">💬</div><div className="int-body"><div className="int-name">WhatsApp (UazAPI)</div><div className="int-desc">Entrega automática de produtos digitais e recuperação de carrinhos abandonados via WhatsApp.</div></div></div>
              <div className="int-card reveal reveal-d3"><div className="int-icon utm">📊</div><div className="int-body"><div className="int-name">UTMify</div><div className="int-desc">Rastreamento completo de campanhas. Captura UTMs em todos os pedidos e envia eventos de conversão.</div></div></div>
              <div className="int-card reveal"><div className="int-icon supa">🗄️</div><div className="int-body"><div className="int-name">Supabase + Prisma</div><div className="int-desc">PostgreSQL gerenciado com ORM type-safe. Migrations automáticas e autenticação integrada.</div></div></div>
              <div className="int-card reveal reveal-d1"><div className="int-icon redis">⚡</div><div className="int-body"><div className="int-name">BullMQ + Redis</div><div className="int-desc">Filas assíncronas com retry automático, backoff exponencial e jobs idempotentes para entregas e recuperação.</div></div></div>
              <div className="int-card reveal reveal-d2"><div className="int-icon sentry">🛡️</div><div className="int-body"><div className="int-name">Sentry + Vercel</div><div className="int-desc">Error tracking em tempo real e analytics de performance. Deploy serverless com Vercel.</div></div></div>
            </div>
          </section>

          <section className="cta-section">
            <p className="cta-overline">Comece hoje mesmo</p>
            <h2 className="cta-headline">Seu checkout<br/>pronto em minutos</h2>
            <p className="cta-sub">Cadastre produtos, configure o funil, copie o link e comece a vender. Sem burocracia, sem código.</p>
            <div className="cta-buttons"><button className="btn-cta-primary" onClick={() => navigate('/login')}>Criar minha conta grátis</button><button className="btn-cta-ghost">Ver documentação</button></div>
          </section>

          <footer className="lp-footer">
            <div className="footer-logo"><svg width="20" height="20" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="8" r="5" fill="#333"/><circle cx="8" cy="20" r="5" fill="#2A2A2A"/><circle cx="20" cy="20" r="5" fill="#222"/></svg>yocota</div>
            <span className="footer-copy">© 2026 Yocota. Uso privado — administrador único.</span>
            <div className="footer-links"><a href="#">PRD v1.0.0</a><a href="#">Privacidade</a><a href="#">Suporte</a></div>
          </footer>
        </div>
      </div>
    </>
  );
};

const CSS = `
html.lp-active{scroll-behavior:smooth}
html.lp-active::-webkit-scrollbar{width:6px}
html.lp-active::-webkit-scrollbar-track{background:#111}
html.lp-active::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
.landing-page{--nav-h:60px;font-family:'Outfit',sans-serif;background:#111;color:#0A0A0A;overflow-x:hidden}
.landing-page *,.landing-page *::before,.landing-page *::after{animation-duration:revert;animation-fill-mode:revert;animation-timing-function:revert;animation-delay:revert}
.lp-nav{position:fixed;top:0;left:0;right:0;height:var(--nav-h);background:#0D0D0D;display:flex;align-items:center;justify-content:space-between;padding:0 32px;z-index:100;border-bottom:1px solid #1E1E1E}
.landing-page .nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none}
.landing-page .nav-logo-icon{width:28px;height:28px;display:flex;align-items:center;justify-content:center}
.landing-page .nav-logo-icon svg{width:100%;height:100%}
.landing-page .nav-logo-text{font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.02em}
.landing-page .nav-actions{display:flex;align-items:center;gap:16px}
.landing-page .nav-link{font-size:14px;font-weight:500;color:#AAA;text-decoration:none;display:flex;align-items:center;gap:5px;transition:color .2s}
.landing-page .nav-link:hover{color:#fff}
.landing-page .nav-link::before{content:"•";color:#E04B00;font-size:14px}
.landing-page .btn-nav{background:transparent;color:#fff;border:1px solid #333;border-radius:7px;padding:8px 18px;font-size:13px;font-weight:600;font-family:'Outfit',sans-serif;cursor:pointer;display:flex;align-items:center;gap:6px;transition:background .2s,border-color .2s,transform .15s;letter-spacing:-0.01em}
.landing-page .btn-nav:hover{background:#1A1A1A;border-color:#555;transform:translateY(-1px)}
.landing-page .btn-nav::before{content:"•";color:#E04B00;font-size:14px}
.landing-page .page{padding-top:var(--nav-h)}
.landing-page .hero-wrapper{padding:20px 20px 0;min-height:calc(100vh - var(--nav-h))}
.landing-page .hero-card{border-radius:18px;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;min-height:calc(100vh - var(--nav-h) - 20px);background:radial-gradient(ellipse 55% 70% at 88% 12%,#E04B00 0%,#C93D00 18%,#D8DDD8 52%,#E0E5DF 78%);position:relative}
.landing-page .hero-card::before{content:'';position:absolute;bottom:0;left:0;width:200px;height:80px;pointer-events:none;background:linear-gradient(to right,#888 0,#888 1px,transparent 1px) 0 100%/60px 1px no-repeat,linear-gradient(to top,#888 0,#888 1px,transparent 1px) 0 100%/1px 50px no-repeat;opacity:.5}
.landing-page .hero-card::after{content:'';position:absolute;bottom:0;right:0;width:200px;height:80px;pointer-events:none;background:linear-gradient(to left,#888 0,#888 1px,transparent 1px) 100% 100%/60px 1px no-repeat,linear-gradient(to top,#888 0,#888 1px,transparent 1px) 100% 100%/1px 50px no-repeat;opacity:.5}
.landing-page .hero-left{padding:56px 48px 56px 56px;display:flex;flex-direction:column;justify-content:center;opacity:0;transform:translateY(24px);animation:lpFU .7s .1s ease forwards}
.landing-page .hero-overline{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#666;margin-bottom:20px}
.landing-page .hero-headline{font-size:clamp(52px,5.5vw,80px);font-weight:800;line-height:.95;letter-spacing:-0.035em;color:#0A0A0A;margin-bottom:32px}
.landing-page .hero-headline span{display:block}
.landing-page .btn-hero{display:inline-flex;align-items:center;gap:7px;background:#0A0A0A;color:#fff;border:none;border-radius:8px;padding:13px 22px;font-size:14px;font-weight:600;font-family:'Outfit',sans-serif;cursor:pointer;width:fit-content;transition:background .2s,transform .15s,box-shadow .2s;letter-spacing:-0.01em}
.landing-page .btn-hero::before{content:"•";color:#E04B00;font-size:16px}
.landing-page .btn-hero:hover{background:#1E1E1E;transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.25)}
.landing-page .hero-right{display:flex;align-items:center;justify-content:center;padding:48px 40px 48px 0;position:relative;opacity:0;transform:translateY(24px);animation:lpFU .7s .25s ease forwards}
.landing-page .checkout-mockup{width:320px;position:relative}
.landing-page .checkout-card{background:#fff;border-radius:14px;box-shadow:0 24px 64px rgba(0,0,0,.18),0 4px 16px rgba(0,0,0,.1);overflow:hidden;width:100%}
.landing-page .checkout-card-header{padding:16px 20px 12px;background:radial-gradient(ellipse 70% 60% at 80% 0%,rgba(224,75,0,.75) 0%,transparent 65%) #1C2022}
.landing-page .checkout-card-header .product-name{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#888;margin-bottom:6px}
.landing-page .checkout-card-header .product-price{font-size:36px;font-weight:800;color:#fff;letter-spacing:-0.03em;line-height:1}
.landing-page .checkout-card-header .product-price sup{font-size:18px;font-weight:600;vertical-align:super;margin-right:1px}
.landing-page .checkout-card-header .product-price .cents{font-size:22px;font-weight:600;color:#AAA}
.landing-page .checkout-card-body{padding:20px;background:#fff}
.landing-page .form-row{margin-bottom:12px}
.landing-page .form-label{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#999;margin-bottom:4px;display:block}
.landing-page .form-input{width:100%;border:1.5px solid #E8E8E8;border-radius:7px;padding:9px 12px;font-size:13px;font-family:'Outfit',sans-serif;color:#333;background:#FAFAFA;outline:none;transition:border-color .2s}
.landing-page .form-input:focus{border-color:#E04B00}
.landing-page .form-input.filled{color:#0A0A0A;background:#fff;border-color:#DDD}
.landing-page .card-row{display:grid;grid-template-columns:1fr 70px 60px;gap:8px}
.landing-page .order-bump-row{display:flex;align-items:flex-start;gap:10px;background:#FFF8F5;border:1.5px solid #FFD4C0;border-radius:8px;padding:10px 12px;margin-bottom:14px;cursor:pointer}
.landing-page .order-bump-check{width:16px;height:16px;border-radius:4px;border:2px solid #E04B00;background:#E04B00;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.landing-page .order-bump-check svg{width:10px;height:10px}
.landing-page .order-bump-text{flex:1}
.landing-page .order-bump-text .bump-title{font-size:12px;font-weight:700;color:#0A0A0A}
.landing-page .order-bump-text .bump-sub{font-size:11px;color:#777;margin-top:1px}
.landing-page .order-bump-price{font-size:13px;font-weight:700;color:#E04B00;white-space:nowrap}
.landing-page .btn-checkout{width:100%;background:#E04B00;color:#fff;border:none;border-radius:8px;padding:13px;font-size:15px;font-weight:700;font-family:'Outfit',sans-serif;cursor:pointer;letter-spacing:-0.01em;transition:background .2s,transform .15s;display:flex;align-items:center;justify-content:center;gap:8px}
.landing-page .btn-checkout:hover{background:#B83D00;transform:translateY(-1px)}
.landing-page .btn-checkout svg{width:16px;height:16px}
.landing-page .secure-badge{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:10px;font-size:11px;color:#AAA}
.landing-page .secure-badge svg{width:12px;height:12px}
.landing-page .upsell-float{position:absolute;right:-48px;top:50%;transform:translateY(-50%);background:#0A0A0A;border-radius:12px;padding:14px 16px;width:164px;box-shadow:0 16px 40px rgba(0,0,0,.35);opacity:0;animation:lpFU .6s .6s ease forwards}
.landing-page .upsell-float .uf-label{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#E04B00;margin-bottom:8px}
.landing-page .upsell-float .uf-title{font-size:13px;font-weight:700;color:#fff;margin-bottom:4px;line-height:1.2}
.landing-page .upsell-float .uf-price{font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.03em}
.landing-page .upsell-float .uf-btns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}
.landing-page .uf-btn-yes{background:#E04B00;color:#fff;border:none;border-radius:5px;padding:6px 0;font-size:11px;font-weight:700;font-family:'Outfit',sans-serif;cursor:pointer;text-align:center}
.landing-page .uf-btn-no{background:transparent;color:#666;border:1px solid #333;border-radius:5px;padding:6px 0;font-size:11px;font-weight:600;font-family:'Outfit',sans-serif;cursor:pointer;text-align:center}
.landing-page .hero-tagline-bar{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;padding:20px 56px;border-top:1px solid rgba(0,0,0,.08)}
.landing-page .hero-tagline{font-size:clamp(20px,2.2vw,28px);font-weight:700;color:#0A0A0A;letter-spacing:-0.02em}
.landing-page .btn-cta-sm{display:inline-flex;align-items:center;gap:6px;background:#0A0A0A;color:#fff;border:none;border-radius:7px;padding:10px 18px;font-size:13px;font-weight:600;font-family:'Outfit',sans-serif;cursor:pointer;white-space:nowrap;transition:background .2s,transform .15s}
.landing-page .btn-cta-sm::before{content:"•";color:#E04B00;font-size:13px}
.landing-page .btn-cta-sm:hover{background:#1E1E1E;transform:translateY(-1px)}
.landing-page .features-section{background:#E0E5DF;padding:80px 40px 64px}
.landing-page .features-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px;gap:32px}
.landing-page .features-headline{font-size:clamp(36px,4vw,52px);font-weight:800;color:#0A0A0A;letter-spacing:-0.03em;line-height:1.05;max-width:520px}
.landing-page .features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.landing-page .feat-card{background:#1C2022;border-radius:14px;overflow:hidden;transition:transform .3s ease,box-shadow .3s ease}
.landing-page .feat-card:hover{transform:translateY(-4px);box-shadow:0 24px 56px rgba(0,0,0,.4)}
.landing-page .feat-card-visual{height:200px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
.landing-page .feat-card-visual::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 75% 10%,rgba(224,75,0,.7) 0%,transparent 65%)}
.landing-page .feat-card-ui{position:relative;z-index:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:14px 16px;width:calc(100% - 40px)}
.landing-page .fc-metric{font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.03em}
.landing-page .fc-label{font-size:11px;color:#666;margin-top:2px}
.landing-page .fc-pill-row{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.landing-page .fc-pill{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:4px 10px;font-size:11px;color:#CCC;font-weight:500}
.landing-page .fc-pill.accent{background:rgba(224,75,0,.2);border-color:rgba(224,75,0,.4);color:#FF8855}
.landing-page .fc-row{display:flex;gap:8px;margin-top:8px}
.landing-page .fc-mini-btn{flex:1;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:6px 4px;text-align:center;font-size:11px;color:#CCC;font-weight:500}
.landing-page .fc-tree-node{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 10px;font-size:10px;color:#CCC;margin:3px 0;display:flex;align-items:center;gap:6px}
.landing-page .fc-tree-node .dot{width:6px;height:6px;border-radius:50%;background:#E04B00}
.landing-page .fc-tree-node .dot.green{background:#3ECA7A}
.landing-page .fc-tree-node .dot.red{background:#E05050}
.landing-page .fc-connector{width:1px;background:rgba(255,255,255,.12);height:12px;margin-left:12px}
.landing-page .whatsapp-msg{background:rgba(37,211,102,.12);border:1px solid rgba(37,211,102,.25);border-radius:8px 8px 8px 0;padding:8px 10px;font-size:11px;color:#B5FFD0;line-height:1.4;margin-top:6px}
.landing-page .whatsapp-msg .ws-name{font-weight:700;font-size:10px;color:#3ECA7A;margin-bottom:2px}
.landing-page .feat-card-body{padding:18px 20px 20px}
.landing-page .feat-card-title{font-size:20px;font-weight:700;color:#F0F0F0;margin-bottom:6px;letter-spacing:-0.02em}
.landing-page .feat-card-desc{font-size:13px;color:#888;line-height:1.55;margin-bottom:14px}
.landing-page .bullet-link{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#E04B00;text-decoration:none;letter-spacing:-0.01em;transition:gap .2s;cursor:pointer}
.landing-page .bullet-link::before{content:"•";color:#E04B00;font-size:14px}
.landing-page .bullet-link:hover{gap:10px}
.landing-page .detail-section{background:#E0E5DF;display:grid;grid-template-columns:1fr 1fr;min-height:300vh;position:relative}
.landing-page .detail-sticky{position:sticky;top:var(--nav-h);height:calc(100vh - var(--nav-h));padding:56px 48px;display:flex;flex-direction:column;justify-content:space-between}
.landing-page .detail-overline{display:flex;gap:20px;font-size:12px;font-weight:600;color:#999;flex-wrap:wrap}
.landing-page .detail-overline span{display:flex;align-items:center;gap:5px}
.landing-page .detail-overline span::before{content:"•";color:#E04B00}
.landing-page .detail-headline{font-size:clamp(44px,4.5vw,64px);font-weight:800;letter-spacing:-0.03em;line-height:1;color:#0A0A0A;margin:24px 0}
.landing-page .detail-sub-title{font-size:22px;font-weight:700;color:#0A0A0A;letter-spacing:-0.02em;margin-bottom:8px}
.landing-page .detail-sub-text{font-size:14px;color:#666;line-height:1.6;max-width:340px;margin-bottom:16px}
.landing-page .detail-right{background:#3D4A45;display:flex;align-items:flex-start;justify-content:center;padding:64px 40px;overflow:hidden}
.landing-page .detail-frames{position:sticky;top:calc(var(--nav-h) + 64px);width:100%;max-width:300px}
.landing-page .detail-frame{background:#1A1F22;border-radius:22px;overflow:hidden;box-shadow:0 40px 80px rgba(0,0,0,.5);transition:all .6s cubic-bezier(.4,0,.2,1);opacity:0;transform:translateY(30px);position:absolute;width:100%}
.landing-page .detail-frame.active{opacity:1;transform:translateY(0);position:relative}
.landing-page .df-header{padding:18px 20px 14px;background:radial-gradient(ellipse 80% 60% at 80% 0%,rgba(224,75,0,.8) 0%,transparent 65%) #1A1F22;display:flex;align-items:center;justify-content:space-between}
.landing-page .df-title{font-size:16px;font-weight:700;color:#fff;letter-spacing:-0.02em}
.landing-page .df-icons{display:flex;gap:8px}
.landing-page .df-icon{width:18px;height:18px;background:rgba(255,255,255,.12);border-radius:4px}
.landing-page .df-body{padding:0 20px 20px;background:#1A1F22}
.landing-page .df-balance-block{padding:16px 0 12px;border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:12px}
.landing-page .df-bal-label{font-size:11px;color:#555;font-weight:500;margin-bottom:4px}
.landing-page .df-bal-value{font-size:38px;font-weight:800;color:#fff;letter-spacing:-0.04em;line-height:1}
.landing-page .df-bal-cents{font-size:24px;font-weight:600;color:#666}
.landing-page .df-bal-change{font-size:12px;color:#3ECA7A;margin-top:4px;font-weight:600}
.landing-page .df-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.landing-page .df-action-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:10px 6px;text-align:center;cursor:pointer;transition:background .2s}
.landing-page .df-action-btn:hover{background:rgba(255,255,255,.1)}
.landing-page .df-action-icon{font-size:16px;margin-bottom:3px}
.landing-page .df-action-label{font-size:10px;color:#888;font-weight:500}
.landing-page .df-list-item{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.landing-page .df-list-item:last-child{border-bottom:none}
.landing-page .df-list-title{font-size:14px;font-weight:600;color:#fff}
.landing-page .df-list-sub{font-size:11px;color:#555;margin-top:1px}
.landing-page .df-list-arrow{color:#555;font-size:16px}
.landing-page .df-swap-field{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between}
.landing-page .df-swap-amount{font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.03em}
.landing-page .df-swap-amount.filled{color:#E04B00}
.landing-page .df-swap-amount.empty{color:#333}
.landing-page .df-swap-sub{font-size:11px;color:#444;margin-top:2px}
.landing-page .df-token-badge{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.08);border-radius:20px;padding:4px 10px 4px 6px}
.landing-page .df-token-icon{width:16px;height:16px;border-radius:50%}
.landing-page .df-token-icon.usdc{background:#2775CA}
.landing-page .df-token-icon.eth{background:#627EEA}
.landing-page .df-token-name{font-size:12px;font-weight:700;color:#fff}
.landing-page .df-swap-arrow{text-align:center;padding:4px 0 8px;color:#444;font-size:18px}
.landing-page .df-pct-row{display:flex;gap:6px;margin:10px 0}
.landing-page .df-pct-btn{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:5px 0;text-align:center;font-size:11px;font-weight:600;color:#666;cursor:pointer}
.landing-page .df-pct-btn.active{background:rgba(224,75,0,.2);border-color:rgba(224,75,0,.4);color:#FF8855}
.landing-page .df-numpad{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.landing-page .df-num{background:rgba(255,255,255,.05);border-radius:6px;padding:9px 4px;text-align:center;font-size:16px;font-weight:600;color:#DDD;cursor:pointer}
.landing-page .df-select-token-btn{width:100%;background:#E04B00;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:700;font-family:'Outfit',sans-serif;cursor:pointer;margin-top:10px;letter-spacing:-0.01em}
.landing-page .stats-section{background:#E0E5DF;padding:0 40px 72px}
.landing-page .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#CCC;border:1px solid #CCC;border-radius:12px;overflow:hidden}
.landing-page .stat-cell{background:#E0E5DF;padding:28px}
.landing-page .stat-number{font-size:40px;font-weight:800;color:#0A0A0A;letter-spacing:-0.04em;line-height:1;margin-bottom:6px}
.landing-page .stat-number span{color:#E04B00}
.landing-page .stat-label{font-size:13px;color:#666;line-height:1.4;max-width:160px}
.landing-page .how-section{background:#111;padding:80px 40px}
.landing-page .how-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:52px}
.landing-page .how-headline{font-size:clamp(36px,4vw,52px);font-weight:800;color:#fff;letter-spacing:-0.03em;line-height:1.05}
.landing-page .how-sub{font-size:14px;color:#555;max-width:300px;line-height:1.6;text-align:right}
.landing-page .steps-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#1E1E1E;border:1px solid #1E1E1E;border-radius:14px;overflow:hidden}
.landing-page .step-card{background:#111;padding:28px 24px;position:relative;transition:background .2s}
.landing-page .step-card:hover{background:#161616}
.landing-page .step-num{font-size:11px;font-weight:700;letter-spacing:.1em;color:#E04B00;margin-bottom:16px;opacity:.8}
.landing-page .step-icon{width:40px;height:40px;background:rgba(224,75,0,.1);border:1px solid rgba(224,75,0,.2);border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:14px;font-size:20px}
.landing-page .step-title{font-size:16px;font-weight:700;color:#fff;margin-bottom:8px;letter-spacing:-0.02em}
.landing-page .step-desc{font-size:13px;color:#555;line-height:1.55}
.landing-page .step-arrow{position:absolute;right:-12px;top:50%;transform:translateY(-50%);width:24px;height:24px;background:#1E1E1E;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:2;font-size:12px;color:#444}
.landing-page .step-card:last-child .step-arrow{display:none}
.landing-page .integrations-section{background:#E0E5DF;padding:72px 40px}
.landing-page .int-header{margin-bottom:40px}
.landing-page .int-headline{font-size:clamp(28px,3vw,40px);font-weight:800;color:#0A0A0A;letter-spacing:-0.03em;margin-bottom:8px}
.landing-page .int-sub{font-size:14px;color:#666}
.landing-page .int-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.landing-page .int-card{background:#fff;border-radius:12px;padding:24px;border:1px solid #E5E5E5;transition:transform .2s,box-shadow .2s;display:flex;align-items:flex-start;gap:16px}
.landing-page .int-card:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,.08)}
.landing-page .int-icon{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.landing-page .int-icon.stripe{background:#635BFF22}
.landing-page .int-icon.wa{background:#25D16622}
.landing-page .int-icon.utm{background:#FF6B3522}
.landing-page .int-icon.redis{background:#DC382D22}
.landing-page .int-icon.supa{background:#3ECF8E22}
.landing-page .int-icon.sentry{background:#36274622}
.landing-page .int-name{font-size:15px;font-weight:700;color:#0A0A0A;margin-bottom:4px;letter-spacing:-0.01em}
.landing-page .int-desc{font-size:12px;color:#777;line-height:1.5}
.landing-page .cta-section{background:#111;padding:100px 40px;text-align:center;position:relative;overflow:hidden}
.landing-page .cta-section::before{content:'';position:absolute;top:-100px;left:50%;transform:translateX(-50%);width:600px;height:400px;background:radial-gradient(ellipse,rgba(224,75,0,.15) 0%,transparent 70%);pointer-events:none}
.landing-page .cta-overline{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#E04B00;margin-bottom:16px;opacity:.8}
.landing-page .cta-headline{font-size:clamp(40px,5vw,68px);font-weight:800;color:#fff;letter-spacing:-0.035em;line-height:1;margin-bottom:20px}
.landing-page .cta-sub{font-size:16px;color:#555;max-width:480px;margin:0 auto 40px;line-height:1.6}
.landing-page .cta-buttons{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.landing-page .btn-cta-primary{display:inline-flex;align-items:center;gap:8px;background:#E04B00;color:#fff;border:none;border-radius:9px;padding:14px 28px;font-size:15px;font-weight:700;font-family:'Outfit',sans-serif;cursor:pointer;letter-spacing:-0.01em;transition:background .2s,transform .15s,box-shadow .2s}
.landing-page .btn-cta-primary:hover{background:#B83D00;transform:translateY(-2px);box-shadow:0 10px 30px rgba(224,75,0,.35)}
.landing-page .btn-cta-ghost{display:inline-flex;align-items:center;gap:8px;background:transparent;color:#fff;border:1px solid #333;border-radius:9px;padding:14px 28px;font-size:15px;font-weight:600;font-family:'Outfit',sans-serif;cursor:pointer;letter-spacing:-0.01em;transition:border-color .2s,background .2s}
.landing-page .btn-cta-ghost:hover{background:#1A1A1A;border-color:#555}
.landing-page .lp-footer{background:#0A0A0A;padding:32px 40px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #1A1A1A}
.landing-page .footer-logo{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;color:#333}
.landing-page .footer-copy{font-size:12px;color:#333}
.landing-page .footer-links{display:flex;gap:20px}
.landing-page .footer-links a{font-size:12px;color:#333;text-decoration:none;transition:color .2s}
.landing-page .footer-links a:hover{color:#666}
@keyframes lpFU{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
.landing-page .reveal{opacity:0;transform:translateY(28px);transition:opacity .65s ease,transform .65s ease}
.landing-page .reveal.visible{opacity:1;transform:none}
.landing-page .reveal-d1{transition-delay:.1s}
.landing-page .reveal-d2{transition-delay:.2s}
.landing-page .reveal-d3{transition-delay:.3s}
@media(max-width:1024px){
.landing-page .hero-card{grid-template-columns:1fr}
.landing-page .hero-right{display:none}
.landing-page .hero-tagline-bar{flex-direction:column;align-items:flex-start;gap:16px}
.landing-page .features-grid{grid-template-columns:1fr}
.landing-page .features-header{flex-direction:column}
.landing-page .detail-section{grid-template-columns:1fr}
.landing-page .detail-right{min-height:400px}
.landing-page .stats-grid{grid-template-columns:1fr 1fr}
.landing-page .steps-grid{grid-template-columns:1fr 1fr}
.landing-page .int-grid{grid-template-columns:1fr 1fr}
.landing-page .step-arrow{display:none}
.landing-page .upsell-float{display:none}
}
@media(max-width:640px){
.landing-page .stats-grid,.landing-page .steps-grid,.landing-page .int-grid{grid-template-columns:1fr}
.lp-nav{padding:0 20px}
.landing-page .nav-link{display:none}
.landing-page .hero-left{padding:40px 28px}
.landing-page .hero-tagline-bar{padding:16px 28px}
}
`;

export default LandingPage;
