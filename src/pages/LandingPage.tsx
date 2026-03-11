import { useNavigate } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  CreditCard, TrendingUp, MessageSquare, ArrowRight,
  Shield, Zap, BarChart3, ChevronRight, Lock
} from "lucide-react";

/* ─── Bullet Link ─── */
const BulletLink = ({ children, onClick, light = false }: { children: React.ReactNode; onClick?: () => void; light?: boolean }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-sm font-medium group"
    style={{ color: light ? "#F5F5F0" : "#0A0A0A" }}
  >
    <span style={{ color: "#E04B00", fontSize: 16 }}>•</span>
    {children}
    <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
  </button>
);

/* ─── Animated Counter ─── */
const AnimatedCounter = ({ target, prefix = "$", decimals = 2 }: { target: number; prefix?: string; decimals?: number }) => {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.5 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [started, target]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{value.toFixed(decimals)}
    </span>
  );
};

/* ─── App Mockup Frame ─── */
const AppMockupFrame = ({ frame }: { frame: number }) => (
  <div
    className="relative mx-auto"
    style={{
      width: 260,
      borderRadius: 24,
      overflow: "hidden",
      background: "#1A1F22",
      boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
    }}
  >
    {/* Status bar */}
    <div className="flex items-center justify-between px-5 pt-3 pb-1">
      <span style={{ color: "#888", fontSize: 11 }}>9:41</span>
      <div className="flex gap-1">
        <div className="w-3.5 h-1.5 rounded-sm" style={{ background: "#555" }} />
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#555" }} />
      </div>
    </div>

    {/* Header with blob */}
    <div
      className="relative px-5 pt-4 pb-5"
      style={{
        background: `radial-gradient(ellipse 80% 60% at 80% 0%, rgba(224,75,0,0.85) 0%, rgba(201,61,0,0.6) 30%, rgba(28,32,34,0) 70%) #1C2022`,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full" style={{ background: "linear-gradient(135deg, #E04B00, #C93D00)" }} />
          <div>
            <p style={{ color: "#F5F5F0", fontSize: 13, fontWeight: 600 }}>Yocota Pay</p>
            <p style={{ color: "#888", fontSize: 10 }}>0x7f3...a2c</p>
          </div>
        </div>
        <Lock className="w-4 h-4" style={{ color: "#888" }} />
      </div>

      <div className="transition-all duration-500">
        {frame === 0 && (
          <div>
            <p style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>Receita total</p>
            <div style={{ color: "#F5F5F0", fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
              <AnimatedCounter target={41105.51} />
            </div>
            <p style={{ color: "#2ECC71", fontSize: 12, marginTop: 4 }}>↑ 12.4% este mês</p>
          </div>
        )}
        {frame === 1 && (
          <div>
            <p style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>Conversão</p>
            <div style={{ color: "#F5F5F0", fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
              <AnimatedCounter target={87.3} suffix="%" prefix="" decimals={1} />%
            </div>
            <p style={{ color: "#2ECC71", fontSize: 12, marginTop: 4 }}>↑ 5.2% vs. semana passada</p>
          </div>
        )}
        {frame === 2 && (
          <div>
            <p style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>Ticket médio</p>
            <div style={{ color: "#F5F5F0", fontSize: 40, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
              R$<AnimatedCounter target={197.90} prefix="" />
            </div>
            <p style={{ color: "#2ECC71", fontSize: 12, marginTop: 4 }}>↑ 34% com upsells</p>
          </div>
        )}
      </div>
    </div>

    {/* Action buttons */}
    <div className="flex gap-2 px-5 py-3">
      {["Vendas", "Upsell", "Entregas"].map((label) => (
        <div
          key={label}
          className="flex-1 flex items-center justify-center py-2 rounded-md text-xs font-medium"
          style={{ background: "#F5F5F0", color: "#0A0A0A" }}
        >
          {label}
        </div>
      ))}
    </div>

    {/* List items */}
    <div className="px-5 pb-5">
      {[
        { label: "Checkout principal", value: "R$ 12.450" },
        { label: "Order bumps", value: "R$ 3.280" },
        { label: "Upsells", value: "R$ 8.740" },
      ].map((item, i) => (
        <div
          key={item.label}
          className="flex items-center justify-between py-3"
          style={{ borderBottom: i < 2 ? "1px solid #2A2A2A" : "none" }}
        >
          <span style={{ color: "#F5F5F0", fontSize: 13, fontWeight: 500 }}>{item.label}</span>
          <div className="flex items-center gap-2">
            <span style={{ color: "#888", fontSize: 12 }}>{item.value}</span>
            <ChevronRight className="w-3 h-3" style={{ color: "#555" }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ─── Feature Card ─── */
const FeatureCard = ({
  icon: Icon, title, description, linkText, index
}: {
  icon: typeof CreditCard; title: string; description: string; linkText: string; index: number
}) => (
  <motion.div
    className="group rounded-xl overflow-hidden"
    style={{ background: "#1C2022" }}
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ delay: index * 0.12, duration: 0.5 }}
    whileHover={{ scale: 1.02, boxShadow: "0 20px 48px rgba(0,0,0,0.5)" }}
  >
    {/* Card top with blob */}
    <div
      className="relative h-48 flex items-center justify-center"
      style={{
        background: `radial-gradient(ellipse 60% 50% at 70% 20%, rgba(224,75,0,0.7) 0%, rgba(201,61,0,0.4) 30%, rgba(28,32,34,0) 70%) #1C2022`,
      }}
    >
      <Icon className="w-12 h-12" style={{ color: "#F5F5F0" }} strokeWidth={1.2} />
    </div>
    {/* Card text */}
    <div className="p-5">
      <h3 style={{ color: "#F5F5F0", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: "#888", fontSize: 13, lineHeight: 1.6 }}>{description}</p>
      <div className="mt-4">
        <BulletLink light>{linkText}</BulletLink>
      </div>
    </div>
  </motion.div>
);

/* ─── Sticky Scroll Detail Items ─── */
const detailItems = [
  {
    overline: "CHECKOUT OTIMIZADO",
    title: "Compra sem fricção",
    description: "Validação inline, auto-formatação de cartão, detecção de bandeira — tudo em tempo real para maximizar conversões.",
    link: "Ver checkout",
  },
  {
    overline: "UPSELL ENGINE",
    title: "Aumente o ticket médio",
    description: "Ofertas pós-compra em cadeia: aceitar leva a um upsell, recusar leva a um downsell. Tudo automatizado.",
    link: "Configurar funil",
  },
  {
    overline: "ENTREGA INSTANTÂNEA",
    title: "WhatsApp delivery",
    description: "Produtos digitais entregues automaticamente via WhatsApp no momento do pagamento. Zero atraso.",
    link: "Ativar entrega",
  },
];

/* ─── Main Component ─── */
export default function LandingPage() {
  const navigate = useNavigate();
  const stickyRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stickyRef, offset: ["start start", "end end"] });
  const activeFrame = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [0, 1, 2, 2]);
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    return activeFrame.on("change", (v) => setCurrentFrame(Math.round(v)));
  }, [activeFrame]);

  return (
    <div style={{ background: "#E0E5DF", fontFamily: "'Outfit', sans-serif" }} className="min-h-screen overflow-x-hidden">
      {/* ── Navbar ── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between"
        style={{ background: "#111111", height: 56, padding: "0 32px" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "#E04B00" }}>
            <Zap className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span style={{ color: "#fff", fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}>
            yocota
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/login")}
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "#fff" }}
          >
            <span style={{ color: "#E04B00", fontSize: 16 }}>•</span>
            Login
          </button>
          <button
            onClick={() => navigate("/login")}
            className="text-sm font-medium"
            style={{
              background: "#0A0A0A",
              color: "#fff",
              border: "1px solid #333",
              borderRadius: 8,
              padding: "8px 16px",
            }}
          >
            Começar grátis
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-14" style={{ background: "#111111" }}>
        <div
          className="relative overflow-hidden"
          style={{
            margin: "0 24px",
            borderRadius: 16,
            minHeight: "calc(100vh - 80px)",
            display: "grid",
            gridTemplateColumns: "1fr",
            background: `radial-gradient(ellipse 55% 70% at 85% 15%, #E04B00 0%, #C93D00 20%, #D8DDD8 55%, #E0E5DF 80%)`,
          }}
        >
          {/* Geometric lines decoration */}
          <svg className="absolute bottom-0 left-0 w-48 h-24 opacity-30" viewBox="0 0 200 100">
            <path d="M0 50 L100 100 L200 100" fill="none" stroke="#888" strokeWidth="1" />
            <path d="M0 70 L80 100" fill="none" stroke="#888" strokeWidth="1" />
          </svg>
          <svg className="absolute bottom-0 right-0 w-48 h-24 opacity-30" viewBox="0 0 200 100">
            <path d="M200 50 L100 100 L0 100" fill="none" stroke="#888" strokeWidth="1" />
            <path d="M200 70 L120 100" fill="none" stroke="#888" strokeWidth="1" />
          </svg>

          <div className="grid md:grid-cols-2 items-center gap-8 md:gap-0">
            {/* Left column - Text */}
            <motion.div
              className="px-8 md:px-12 pt-16 md:pt-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p
                className="uppercase mb-6"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  color: "#666",
                }}
              >
                VENDAS DE ALTA PERFORMANCE
              </p>
              <h1
                style={{
                  fontSize: "clamp(40px, 6vw, 72px)",
                  fontWeight: 800,
                  lineHeight: 0.95,
                  letterSpacing: "-0.03em",
                  color: "#0A0A0A",
                }}
              >
                Checkout rápido
                <br />
                e inteligente
              </h1>
              <p
                className="mt-6 max-w-md"
                style={{ fontSize: 15, color: "#555", lineHeight: 1.6 }}
              >
                Plataforma completa de pagamentos com upsell, order bumps,
                entrega automática via WhatsApp e recuperação de carrinho.
              </p>
              <div className="mt-8">
                <button
                  onClick={() => navigate("/login")}
                  className="inline-flex items-center gap-1.5 text-sm font-medium transition-all hover:-translate-y-px"
                  style={{
                    background: "#0A0A0A",
                    color: "#fff",
                    border: "1px solid #333",
                    borderRadius: 8,
                    padding: "12px 20px",
                  }}
                >
                  <span style={{ color: "#E04B00", fontSize: 16 }}>•</span>
                  Começar agora
                </button>
              </div>
            </motion.div>

            {/* Right column - Mockup */}
            <motion.div
              className="flex items-center justify-center pb-12 md:pb-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <AppMockupFrame frame={0} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="px-6 md:px-20 py-16 md:py-24" style={{ background: "#E0E5DF" }}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12">
          <motion.h2
            style={{
              fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              color: "#0A0A0A",
              maxWidth: 500,
            }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            Ferramentas que aumentam sua receita
          </motion.h2>
          <motion.div
            className="mt-4 md:mt-0"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <BulletLink onClick={() => navigate("/login")}>Começar agora</BulletLink>
          </motion.div>
        </div>

        {/* Cards grid */}
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={CreditCard}
            title="Checkout otimizado"
            description="Formulário de alta conversão com validação em tempo real, auto-formatação e detecção automática de bandeira."
            linkText="Ver checkout"
            index={0}
          />
          <FeatureCard
            icon={TrendingUp}
            title="Upsell & order bumps"
            description="Aumente o ticket médio com ofertas pós-compra inteligentes e produtos complementares no checkout."
            linkText="Explorar funis"
            index={1}
          />
          <FeatureCard
            icon={MessageSquare}
            title="Entrega instantânea"
            description="Entrega automática de produtos digitais direto no WhatsApp do cliente, sem atritos."
            linkText="Configurar entrega"
            index={2}
          />
        </div>
      </section>

      {/* ── Sticky Scroll Feature Detail ── */}
      <section ref={stickyRef} style={{ background: "#E0E5DF" }}>
        <div
          className="grid md:grid-cols-2"
          style={{ minHeight: "300vh" }}
        >
          {/* Left: Sticky text */}
          <div
            className="md:sticky md:top-14 md:h-[calc(100vh-56px)] flex flex-col justify-between p-8 md:p-12"
          >
            {/* Top nav */}
            <div className="flex flex-wrap gap-4 mb-8 md:mb-0">
              {detailItems.map((item, i) => (
                <span
                  key={item.overline}
                  className="text-xs font-medium"
                  style={{
                    color: currentFrame === i ? "#E04B00" : "#888",
                    transition: "color 0.3s",
                  }}
                >
                  <span style={{ color: "#E04B00", marginRight: 4 }}>•</span>
                  {item.link}
                </span>
              ))}
            </div>

            {/* Content */}
            <div>
              <p
                className="uppercase mb-3"
                style={{ fontSize: 11, letterSpacing: "0.12em", color: "#666", fontWeight: 500 }}
              >
                {detailItems[currentFrame]?.overline}
              </p>
              <h2
                style={{
                  fontSize: "clamp(32px, 4vw, 48px)",
                  fontWeight: 700,
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  color: "#0A0A0A",
                }}
              >
                {detailItems[currentFrame]?.title}
              </h2>
              <p className="mt-4 max-w-md" style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
                {detailItems[currentFrame]?.description}
              </p>
              <div className="mt-6">
                <BulletLink onClick={() => navigate("/login")}>{detailItems[currentFrame]?.link}</BulletLink>
              </div>
            </div>

            {/* Bottom secondary info */}
            <div className="mt-8 md:mt-0">
              <h3 style={{ fontSize: 18, fontWeight: 600, color: "#0A0A0A" }}>Resultados comprovados</h3>
              <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                +34% de conversão média entre nossos clientes.
              </p>
              <div className="mt-3">
                <BulletLink onClick={() => navigate("/login")}>Ver métricas</BulletLink>
              </div>
            </div>
          </div>

          {/* Right: Mockup container */}
          <div
            className="flex items-center justify-center p-8 md:p-12 min-h-screen md:min-h-0"
            style={{ background: "#3D4A45" }}
          >
            <div className="md:sticky md:top-1/2 md:-translate-y-1/2">
              <AppMockupFrame frame={currentFrame} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <section style={{ background: "#E0E5DF" }} className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: "99.9%", label: "Uptime garantido" },
            { value: "<2s", label: "Tempo de checkout" },
            { value: "+34%", label: "Mais conversão" },
            { value: "0", label: "Taxas ocultas" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
            >
              <p style={{ fontSize: 36, fontWeight: 800, color: "#0A0A0A", letterSpacing: "-0.03em" }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 12, color: "#888", marginTop: 4, fontWeight: 500 }}>
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Differentials ── */}
      <section className="px-6 md:px-20 py-16 md:py-24" style={{ background: "#E0E5DF" }}>
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="uppercase mb-3" style={{ fontSize: 11, letterSpacing: "0.12em", color: "#666", fontWeight: 500 }}>
              POR QUE YOCOTA
            </p>
            <h2 style={{ fontSize: "clamp(28px, 3.5vw, 40px)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", color: "#0A0A0A" }}>
              Construído para
              <br />vendedores sérios
            </h2>
            <p className="mt-4" style={{ fontSize: 14, color: "#555", lineHeight: 1.6, maxWidth: 400 }}>
              Cada detalhe foi pensado para maximizar suas conversões e simplificar sua operação.
            </p>
            <div className="mt-6">
              <button
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-1.5 text-sm font-medium transition-all hover:-translate-y-px"
                style={{
                  background: "#0A0A0A",
                  color: "#fff",
                  border: "1px solid #333",
                  borderRadius: 8,
                  padding: "12px 20px",
                }}
              >
                <span style={{ color: "#E04B00", fontSize: 16 }}>•</span>
                Criar conta grátis
              </button>
            </div>
          </motion.div>

          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            {[
              { icon: Shield, title: "Segurança PCI-DSS", desc: "Dados de cartão nunca tocam seu servidor. Processamento via Stripe." },
              { icon: Zap, title: "Setup em 5 minutos", desc: "Do cadastro à primeira venda sem código, sem complicação." },
              { icon: BarChart3, title: "Dashboard em tempo real", desc: "Métricas de vendas, conversões e performance ao vivo." },
              { icon: MessageSquare, title: "Remarketing por WhatsApp", desc: "Recupere carrinhos abandonados automaticamente." },
            ].map((item, i) => (
              <div
                key={item.title}
                className="flex gap-4 p-4 rounded-xl transition-all hover:scale-[1.01]"
                style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.06)" }}
              >
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: "#0A0A0A" }}
                >
                  <item.icon className="w-4 h-4" style={{ color: "#E04B00" }} strokeWidth={1.8} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0A0A0A" }}>{item.title}</h3>
                  <p style={{ fontSize: 12, color: "#888", marginTop: 2, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ background: "#111111" }} className="py-20 px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="uppercase mb-4" style={{ fontSize: 11, letterSpacing: "0.12em", color: "#666", fontWeight: 500 }}>
            COMECE AGORA
          </p>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em", color: "#F5F5F0" }}>
            Pronto para vender
            <br />
            <span style={{ color: "#E04B00" }}>como nunca antes</span>?
          </h2>
          <p style={{ color: "#888", fontSize: 14, marginTop: 16, maxWidth: 420, marginInline: "auto", lineHeight: 1.6 }}>
            Crie sua conta gratuita e configure seu primeiro checkout em minutos. Sem cartão. Sem compromisso.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-1.5 text-sm font-medium transition-all hover:-translate-y-px"
              style={{
                background: "#E04B00",
                color: "#fff",
                borderRadius: 8,
                padding: "12px 24px",
              }}
            >
              Criar conta grátis
              <ArrowRight className="w-4 h-4" />
            </button>
            <BulletLink light onClick={() => navigate("/login")}>Fazer login</BulletLink>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ background: "#0A0A0A", padding: "20px 32px" }}
      >
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>yocota</span>
        <p style={{ color: "#555", fontSize: 11 }}>
          © {new Date().getFullYear()} Yocota. Todos os direitos reservados.
        </p>
        <div className="flex items-center gap-1.5" style={{ color: "#555", fontSize: 11 }}>
          <Lock className="w-3 h-3" />
          Pagamentos seguros via Stripe
        </div>
      </footer>
    </div>
  );
}
