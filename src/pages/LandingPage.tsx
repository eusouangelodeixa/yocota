import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Zap, Shield, TrendingUp, CreditCard, BarChart3, 
  MessageSquare, ArrowRight, CheckCircle2, Lock,
  Smartphone, Globe, RefreshCw, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const stats = [
  { value: "99.9%", label: "Uptime garantido" },
  { value: "<2s", label: "Tempo de checkout" },
  { value: "+34%", label: "Aumento em conversão" },
  { value: "0%", label: "Taxas ocultas" },
];

const features = [
  {
    icon: CreditCard,
    title: "Checkout de Alta Conversão",
    description: "Formulário otimizado com validação em tempo real, auto-formatação e detecção automática de bandeira.",
  },
  {
    icon: TrendingUp,
    title: "Upsell & Order Bumps",
    description: "Aumente o ticket médio com ofertas pós-compra inteligentes e produtos complementares no checkout.",
  },
  {
    icon: MessageSquare,
    title: "Entrega via WhatsApp",
    description: "Entrega automática de produtos digitais direto no WhatsApp do cliente, sem atritos.",
  },
  {
    icon: RefreshCw,
    title: "Recuperação de Carrinho",
    description: "Remarketing automatizado via WhatsApp para recuperar carrinhos abandonados e maximizar receita.",
  },
  {
    icon: BarChart3,
    title: "Dashboard em Tempo Real",
    description: "Visualize vendas, conversões e métricas de performance com gráficos interativos e dados ao vivo.",
  },
  {
    icon: Shield,
    title: "Segurança Nível Stripe",
    description: "Dados de cartão nunca tocam seu servidor. Processamento PCI-DSS compliant via Stripe Elements.",
  },
];

const steps = [
  { step: "01", title: "Cadastre seu produto", description: "Adicione seus produtos digitais ou físicos em segundos." },
  { step: "02", title: "Configure o checkout", description: "Personalize cores, textos e adicione order bumps." },
  { step: "03", title: "Compartilhe o link", description: "Envie o link do checkout e comece a vender imediatamente." },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-xl font-bold tracking-tight text-foreground">
            <span className="text-primary">Yo</span>cota
          </span>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/login")}
              className="text-muted-foreground hover:text-foreground"
            >
              Entrar
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/login")}
              className="font-bold"
            >
              Começar Grátis
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Glow effect */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-primary/5 blur-[120px]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={0}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary mb-8">
              <Zap className="h-3 w-3" strokeWidth={2} />
              Plataforma de pagamentos inteligente
            </span>
          </motion.div>

          <motion.h1
            className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            Venda mais com
            <br />
            <span className="text-primary">checkouts que convertem</span>
          </motion.h1>

          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            Checkout otimizado, upsells inteligentes, entrega automática via WhatsApp
            e recuperação de carrinho — tudo em uma única plataforma.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <Button
              size="lg"
              onClick={() => navigate("/login")}
              className="h-12 px-8 text-base font-bold rounded-lg"
            >
              Criar Conta Grátis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="h-12 px-8 text-base font-medium rounded-lg border-border/60"
            >
              Ver Recursos
            </Button>
          </motion.div>

          <motion.div
            className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
          >
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-primary" strokeWidth={2} />
              PCI-DSS Compliant
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-primary" strokeWidth={2} />
              Stripe Secure
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-primary" strokeWidth={2} />
              SSL Criptografado
            </span>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 bg-card/30">
        <div className="mx-auto grid max-w-5xl grid-cols-2 sm:grid-cols-4 divide-x divide-border/50">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="flex flex-col items-center py-10 px-4"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
            >
              <span className="text-3xl font-extrabold text-primary tabular-nums">
                {stat.value}
              </span>
              <span className="mt-1 text-xs text-muted-foreground font-medium">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Tudo que você precisa para{" "}
              <span className="text-primary">vender online</span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Ferramentas profissionais de checkout, upsell e remarketing em uma interface intuitiva.
            </p>
          </motion.div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="group relative rounded-xl border border-border/60 bg-card/50 p-6 hover:border-primary/30 hover:bg-card transition-all duration-200"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 px-6 bg-card/20 border-y border-border/50">
        <div className="mx-auto max-w-4xl">
          <motion.div
            className="text-center mb-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Comece em <span className="text-primary">3 passos</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Da configuração à primeira venda em menos de 5 minutos.
            </p>
          </motion.div>

          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                className="relative text-center"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
                  <span className="text-lg font-extrabold text-primary">{step.step}</span>
                </div>
                <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden sm:block absolute top-7 -right-4 h-5 w-5 text-border" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof checklist */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-border/60 bg-card/50 p-8 sm:p-12">
            <div className="grid gap-10 sm:grid-cols-2 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={0}
              >
                <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Por que escolher a <span className="text-primary">Yocota</span>?
                </h2>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  Construído por vendedores, para vendedores que querem resultado.
                </p>
              </motion.div>

              <motion.ul
                className="space-y-4"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={1}
              >
                {[
                  "Checkout dark-mode otimizado",
                  "Upsell & downsell em cadeia",
                  "Entrega automática por WhatsApp",
                  "Recuperação inteligente de vendas",
                  "UTM tracking completo",
                  "Integração nativa com Stripe",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" strokeWidth={2} />
                    {item}
                  </li>
                ))}
              </motion.ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          custom={0}
        >
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-primary/5 blur-[80px]" />
            <Smartphone className="mx-auto h-10 w-10 text-primary mb-6" strokeWidth={1.5} />
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Pronto para <span className="text-primary">aumentar suas vendas</span>?
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
              Crie sua conta gratuita e configure seu primeiro checkout em minutos.
              Sem cartão de crédito. Sem compromisso.
            </p>
            <Button
              size="lg"
              onClick={() => navigate("/login")}
              className="mt-8 h-12 px-10 text-base font-bold rounded-lg"
            >
              Começar Agora
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="mx-auto flex max-w-6xl flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold text-foreground">
            <span className="text-primary">Yo</span>cota
          </span>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Yocota. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Pagamentos seguros via Stripe
          </div>
        </div>
      </footer>
    </div>
  );
}
