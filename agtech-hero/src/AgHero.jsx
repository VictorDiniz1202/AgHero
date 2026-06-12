import React, { useState, useEffect } from "react";
import FormularioManejo from "./components/FormularioManejo";
import DashboardReal from "./components/DashboardReal";
import DashboardNutricao from "./components/DashboardNutricao";
import DashboardAgua from "./components/DashboardAgua";
import GestaoLotes from "./components/GestaoLotes";
import Configuracoes from "./components/Configuracoes";
import CentralBI from "./components/CentralBI";
import CalendarioManejo from "./components/CalendarioManejo";
import GestaoFinanceira from "./components/GestaoFinanceira";
import CentroRelatorios from "./components/CentroRelatorios";
import ImportadorDados from "./components/ImportadorDados";
import Login from "./components/Login";
import { auth } from "./firebase/config";
import { obterFazendaDoUsuario, vincularColaboradorSePendente, verificarStatusOnboarding } from "./firebase/services";
import Onboarding from "./components/Onboarding";
import { onAuthStateChanged } from "firebase/auth";
import { useRegisterSW } from "virtual:pwa-register/react";

// ─── Hook: Scroll Reveal ────────────────────────────────────────────

function useIntersectionObserver() {
  useEffect(() => {
    // Adiciona um pequeno delay dinâmico (staggering) para elementos próximos
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            entry.target.style.transitionDelay = `${(index % 5) * 100}ms`;
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    const elements = document.querySelectorAll(".reveal");
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ─── Micro-components ───────────────────────────────────────────────

const Badge = ({ children }) => (
  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-panel border border-white/60 text-forest-dark text-[10px] sm:text-xs font-semibold tracking-wide uppercase shadow-sm">
    <span className="w-1.5 h-1.5 rounded-full bg-vivid-emerald animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
    {children}
  </span>
);

const DashboardMockup = () => {
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 15; // range: -7.5 to 7.5
      const y = (e.clientY / window.innerHeight - 0.5) * -15; // range: -7.5 to 7.5
      setRotation({ x: y, y: x });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div 
      className="relative w-full rounded-2xl border border-white/80 bg-white/60 backdrop-blur-xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(16,185,129,0.25)] flex h-[350px] sm:h-[450px] transition-transform duration-200 ease-out"
      style={{ transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) translateZ(0)`, transformStyle: "preserve-3d" }}
    >
      {/* Sidebar Mockup */}
      <aside className="w-16 sm:w-44 bg-white/40 border-r border-forest-light/10 flex flex-col justify-between shrink-0">
        <div className="p-2 sm:p-4 space-y-4 sm:space-y-6">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-gradient-to-br from-vivid-emerald to-vivid-teal flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5"><path d="M17 8C8 10 5.9 16.17 3.82 19.34A1 1 0 0 0 5.18 20.5C7 17 9 14 15 13" /><path d="M12 8a4 4 0 0 1 4-4c0 4-3 6-4 6" /></svg>
            </div>
            <span className="text-sm font-heading font-bold text-forest-dark tracking-tight hidden sm:block">AgHero</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 rounded-lg bg-vivid-emerald/10 p-2 sm:px-3 sm:py-2 text-[10px] sm:text-[11px] font-bold text-vivid-emerald">
              <span className="hidden sm:block">Visão Geral</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg p-2 sm:px-3 sm:py-2 text-[10px] sm:text-[11px] font-semibold text-forest-light hover:bg-white/50 cursor-pointer">
              <span className="hidden sm:block">Manejos Diários</span>
            </div>
          </div>
        </div>
        <div className="p-2 sm:p-4 hidden sm:block">
          <div className="rounded-xl bg-gradient-to-br from-forest-dark to-forest p-3 shadow-lg">
            <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center mb-2"><span className="text-vivid-emerald text-xs">✨</span></div>
            <p className="text-[10px] font-bold text-white mb-1">Plano Inteligente</p>
          </div>
        </div>
      </aside>

      {/* Main Content Mockup */}
      <div className="flex-1 flex flex-col bg-offwhite/30 overflow-hidden relative">
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-white/40 bg-white/30 backdrop-blur-md">
          <div>
            <h2 className="text-xs sm:text-sm font-heading font-bold text-forest-dark tracking-tight">Bem-vindo, Produtor 👋</h2>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-agriAlert-green shadow-sm animate-pulse" />
            <span className="text-[8px] sm:text-[9px] font-bold text-agriAlert-green uppercase tracking-wide">Sync OK</span>
          </div>
        </div>

        <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Aves Ativas", val: "42.800", sub: "Lote Ativo", color: "text-vivid-emerald", bg: "bg-vivid-emerald/10" },
              { label: "Mortalidade", val: "0.31%", sub: "Meta", color: "text-agriAlert-green", bg: "bg-transparent" }
            ].map((k) => (
              <div key={k.label} className="glass-panel rounded-lg sm:rounded-xl p-2 sm:p-3 shadow-sm border border-white/50 hover:border-vivid-emerald/30 transition-all">
                <p className="text-[8px] sm:text-[9px] font-bold text-forest-light uppercase tracking-wider mb-1">{k.label}</p>
                <p className="text-sm sm:text-lg font-heading font-bold text-forest-dark leading-none">{k.val}</p>
                <p className={`text-[7px] sm:text-[9px] mt-1.5 font-bold ${k.color} ${k.bg} inline-block px-1.5 py-0.5 rounded-md`}>{k.sub}</p>
              </div>
            ))}
            <div className="glass-panel rounded-lg sm:rounded-xl p-2 sm:p-3 shadow-sm border border-vivid-emerald/30 bg-gradient-to-br from-forest-dark to-forest col-span-2 sm:col-span-1 flex flex-col justify-center">
              <p className="text-[8px] sm:text-[9px] font-bold text-vivid-emerald uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-vivid-emerald rounded-full"></span> Alerta IA
              </p>
              <p className="text-xs sm:text-sm font-heading font-semibold text-white leading-tight">Prevenção</p>
            </div>
          </div>
          
          <div className="glass-panel rounded-lg sm:rounded-xl p-2 sm:p-3 shadow-sm border border-white/50">
             <p className="text-[9px] sm:text-[10px] font-heading font-bold text-forest-dark uppercase tracking-wide mb-2 sm:mb-3">Consumo Hídrico</p>
             <div className="h-[50px] sm:h-[60px] w-full rounded-lg bg-white/40 overflow-hidden relative border border-white/50">
                 <div className="absolute inset-0 flex items-end opacity-80">
                   <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
                      <polyline points="0,30 20,20 40,25 60,10 80,15 100,5" fill="none" stroke="var(--color-vivid-emerald)" strokeWidth="2" />
                      <polyline points="0,30 20,25 40,28 60,15 80,20 100,10" fill="none" stroke="var(--color-vivid-lime)" strokeWidth="2" />
                   </svg>
                 </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Navbar ─────────────────────────────────────────────────────────

const Navbar = ({ onAcessarSistema }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (id) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="w-full glass-panel border-b-0 border-white/40 sticky top-0 z-50 rounded-none bg-offwhite/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <a href="#inicio" onClick={(e) => { e.preventDefault(); handleNav('inicio'); }} className="flex items-center gap-2 sm:gap-3 group">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-vivid-emerald to-vivid-teal flex items-center justify-center shadow-[0_4px_15px_rgba(16,185,129,0.3)]">
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 sm:w-5 sm:h-5">
                <path d="M17 8C8 10 5.9 16.17 3.82 19.34A1 1 0 0 0 5.18 20.5C7 17 9 14 15 13" />
                <path d="M12 8a4 4 0 0 1 4-4c0 4-3 6-4 6" />
              </svg>
            </div>
            <span className="text-forest-dark font-heading font-bold text-xl sm:text-2xl tracking-tight">AgHero</span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: "O Problema", id: "problema" },
              { label: "Como Funciona", id: "funciona" },
              { label: "Planos", id: "planos" },
              { label: "Sobre", id: "sobre" }
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => { e.preventDefault(); handleNav(item.id); }}
                className="text-sm font-semibold text-forest-light hover:text-vivid-emerald transition-colors duration-200"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); onAcessarSistema(); }}
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white text-xs sm:text-sm font-bold shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] hover:scale-105 transition-all duration-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
              Login
            </a>
            <button className="md:hidden p-2 text-forest-dark" onClick={() => setMobileOpen(!mobileOpen)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></>}
              </svg>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-white/50 py-4 space-y-2">
            {[
              { label: "O Problema", id: "problema" },
              { label: "Como Funciona", id: "funciona" },
              { label: "Planos", id: "planos" },
              { label: "Sobre", id: "sobre" }
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => { e.preventDefault(); handleNav(item.id); }}
                className="block px-4 py-3 text-sm font-bold text-forest-dark hover:bg-white/50 rounded-xl"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-4 px-2">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setMobileOpen(false); onAcessarSistema(); }}
                className="block text-center px-4 py-3 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                Login
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

// ─── Sections ───────────────────────────────────────────────────────

const HeroSection = ({ onComeçar }) => (
  <section id="inicio" className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24">
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">
        <div className="reveal flex flex-col gap-6 max-w-lg z-10">
          <div className="self-start"><Badge>O Futuro da Avicultura</Badge></div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-forest-dark leading-[1.1] tracking-tight">
            Gestão <span className="text-transparent bg-clip-text bg-gradient-to-r from-vivid-emerald to-vivid-teal">Offline-First</span> para o Produtor Rural.
          </h1>
          <p className="text-sm sm:text-base text-forest-light font-medium leading-relaxed">
            Economize ração e previna perdas com nossa IA preditiva. O AgHero foi desenhado para o operador no galpão, garantindo que nada se perca, mesmo sem internet.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
            <button onClick={onComeçar} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white text-sm font-bold shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)] hover:scale-105 transition-transform">
              Começar Grátis
            </button>
          </div>
        </div>
        <div className="reveal relative w-full z-10 hidden sm:block">
          <div className="absolute inset-0 bg-gradient-to-tr from-vivid-teal/20 to-vivid-emerald/20 blur-3xl rounded-[3rem] -z-10 transform scale-110"></div>
          <DashboardMockup />
        </div>
      </div>
    </div>
  </section>
);

const ProblemSection = () => (
  <section id="problema" className="relative py-20 sm:py-28 border-t border-forest-light/10 overflow-hidden">
    {/* Fundo dinâmico da seção */}
    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-vivid-emerald/5 rounded-full blur-[100px] -translate-y-1/2 pointer-events-none" />
    
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="reveal max-w-3xl mb-12">
        <p className="text-sm font-bold text-vivid-emerald tracking-wider uppercase mb-3">O Desafio no Campo</p>
        <h2 className="text-3xl sm:text-4xl font-heading font-bold text-forest-dark leading-tight">
          As ferramentas tradicionais não resistem ao dia a dia da granja.
        </h2>
        <p className="mt-4 text-sm sm:text-base text-forest-light font-medium max-w-xl">
          Planilhas se perdem, sistemas complexos travam sem internet e você só descobre um surto de doença quando já é tarde demais.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bento Card 1: Offline */}
        <div className="reveal group relative overflow-hidden glass-panel rounded-3xl p-6 sm:p-8 hover:-translate-y-1 hover:border-vivid-emerald/30 transition-all duration-300">
          <div className="h-40 bg-gradient-to-br from-forest-dark/5 to-transparent rounded-2xl border border-white/50 mb-6 flex flex-col p-4 relative overflow-hidden">
             <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-agriAlert-orange/20 rounded-full blur-2xl"></div>
             <div className="flex justify-between items-center bg-white/60 p-2 rounded-lg shadow-sm backdrop-blur-md border border-white/80">
               <span className="text-[10px] font-bold text-forest-dark">Sincronização</span>
               <span className="text-[9px] font-bold text-agriAlert-orange bg-agriAlert-orange/10 px-2 py-0.5 rounded-full flex items-center gap-1"><div className="w-1.5 h-1.5 bg-agriAlert-orange rounded-full animate-pulse"></div>Offline</span>
             </div>
             <div className="mt-auto space-y-2">
                <div className="h-2 bg-white/50 rounded-full w-full"></div>
                <div className="h-2 bg-white/50 rounded-full w-2/3"></div>
             </div>
          </div>
          <h3 className="text-lg font-bold text-forest-dark mb-2">Internet Instável</h3>
          <p className="text-sm text-forest-light font-medium leading-relaxed">
            Nossa arquitetura offline-first salva todos os manejos localmente e sincroniza quando você chegar na sede. Zero telas de carregamento.
          </p>
        </div>

        {/* Bento Card 2: UX Simples */}
        <div className="reveal group relative overflow-hidden glass-panel rounded-3xl p-6 sm:p-8 hover:-translate-y-1 hover:border-vivid-emerald/30 transition-all duration-300">
          <div className="h-40 bg-gradient-to-br from-forest-dark/5 to-transparent rounded-2xl border border-white/50 mb-6 flex items-center justify-center relative overflow-hidden">
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-vivid-emerald/10 rounded-full blur-2xl"></div>
             <div className="bg-white/80 border border-white p-3 rounded-xl shadow-lg w-3/4">
               <div className="flex items-center justify-between mb-3 border-b border-forest-light/10 pb-2">
                 <span className="text-[10px] font-bold text-forest-dark">Mortalidade (Lote 1)</span>
               </div>
               <div className="flex justify-between gap-2">
                 <button className="flex-1 bg-offwhite border border-forest-light/20 rounded-lg py-2 text-forest-dark font-bold text-xs">-</button>
                 <div className="flex-1 bg-white border border-vivid-emerald/50 rounded-lg py-2 text-center font-bold text-vivid-emerald text-xs">12 aves</div>
                 <button className="flex-1 bg-vivid-emerald text-white rounded-lg py-2 font-bold text-xs">+</button>
               </div>
             </div>
          </div>
          <h3 className="text-lg font-bold text-forest-dark mb-2">Trabalho Bruto</h3>
          <p className="text-sm text-forest-light font-medium leading-relaxed">
            Telas com botões grandes e contrastes altos criadas para o produtor rural usar de luvas e sob o sol forte em menos de 30 segundos.
          </p>
        </div>

        {/* Bento Card 3: IA Preditiva */}
        <div className="reveal group relative overflow-hidden glass-panel rounded-3xl p-6 sm:p-8 hover:-translate-y-1 hover:border-vivid-emerald/30 transition-all duration-300">
          <div className="h-40 bg-gradient-to-br from-forest-dark/5 to-transparent rounded-2xl border border-white/50 mb-6 flex flex-col p-4 relative overflow-hidden justify-end">
             <div className="absolute top-0 right-0 w-32 h-32 bg-agriAlert-red/10 rounded-full blur-2xl"></div>
             <div className="w-full h-16 bg-white/40 rounded-lg border border-white/60 mb-2 relative overflow-hidden">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full opacity-60">
                   <polyline points="0,40 30,20 60,30 100,38" fill="none" stroke="var(--color-agriAlert-red)" strokeWidth="3" />
                </svg>
             </div>
             <div className="bg-agriAlert-red/10 border border-agriAlert-red/20 rounded-lg p-2 flex items-start gap-2 shadow-sm">
                <span className="text-[10px]">⚠️</span>
                <p className="text-[9px] font-bold text-agriAlert-red leading-tight">Queda drástica de água identificada. Risco de doença iminente.</p>
             </div>
          </div>
          <h3 className="text-lg font-bold text-forest-dark mb-2">Descoberta Tardia</h3>
          <p className="text-sm text-forest-light font-medium leading-relaxed">
            A IA da AgHero detecta anomalias sanitárias até 48 horas antes da mortalidade, avisando seu veterinário direto no WhatsApp.
          </p>
        </div>
      </div>
    </div>
  </section>
);

const FeaturesSection = () => (
  <section id="funciona" className="relative py-20 sm:py-28 bg-[#152821] text-white overflow-hidden">
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="reveal max-w-3xl mb-16">
        <p className="text-sm font-bold text-vivid-lime tracking-wider uppercase mb-3">Fluxo de Trabalho</p>
        <h2 className="text-3xl sm:text-4xl font-heading font-bold leading-tight">
          Sua granja digitalizada em 4 passos lógicos.
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            step: "01", title: "Capture o Manejo",
            desc: "O tratador registra mortalidade, ração e água no App pelo celular direto do galpão.",
            icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
          },
          {
            step: "02", title: "Sync Automático",
            desc: "Os dados são guardados localmente. Ao chegar no Wi-Fi, tudo vai para a nuvem sem intervir.",
            icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          },
          {
            step: "03", title: "Motor Preditivo",
            desc: "Nossa IA cruza consumo e temperatura em tempo real procurando anomalias na curva.",
            icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          },
          {
            step: "04", title: "Ação Imediata",
            desc: "Se houver perigo de surto, enviamos relatórios XAI para o produtor e veterinário via WhatsApp.",
            icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          }
        ].map((item, idx) => (
          <div key={idx} className="reveal bg-white/[0.03] border border-white/10 rounded-3xl p-6 hover:bg-white/[0.06] transition-colors group">
            <p className="text-xs font-bold text-vivid-lime uppercase tracking-widest mb-4">Passo {item.step}</p>
            <div className="w-12 h-12 rounded-xl bg-vivid-emerald/20 text-vivid-emerald flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              {item.icon}
            </div>
            <h3 className="text-lg font-bold mb-2">{item.title}</h3>
            <p className="text-sm text-white/60 leading-relaxed font-medium">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const PricingSection = () => (
  <section id="planos" className="relative py-20 sm:py-28 overflow-hidden bg-offwhite">
    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-vivid-lime rounded-full mix-blend-multiply filter blur-[120px] opacity-20 pointer-events-none" />
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 w-full">
      <div className="reveal text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-3xl sm:text-5xl font-heading font-bold text-forest-dark mb-6">
          Escolha o Plano Ideal para a <br className="hidden sm:block" /> 
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-vivid-emerald to-vivid-lime">sua Granja</span>
        </h2>
        <p className="text-sm sm:text-lg text-forest-light font-medium">Tecnologia de ponta acessível para produtores rurais de todos os tamanhos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
        {/* Starter */}
        <div className="reveal flex flex-col glass-panel rounded-[2rem] p-8 border border-white/60 bg-white/40 shadow-sm relative overflow-hidden transition-transform hover:-translate-y-2 h-full">
          <div className="mb-6">
            <span className="text-sm font-bold text-forest-dark uppercase tracking-wider">Standard</span>
            <div className="mt-4 flex items-baseline text-forest-dark">
              <span className="text-4xl sm:text-5xl font-heading font-extrabold tracking-tight">R$ 49,90</span>
              <span className="text-sm font-semibold text-forest-light ml-1">/mês</span>
            </div>
            <p className="mt-2 text-sm font-medium text-forest-light">Para iniciantes na gestão digital.</p>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-forest-light/20 to-transparent my-6"></div>
          <ul className="space-y-4 mb-8 flex-1">
            {['Até 8 Lotes Ativos', '5 Alertas Preditivos/mês', 'Dashboards Básicos', 'Sync Offline'].map(feature => (
              <li key={feature} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-vivid-emerald/10 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-vivid-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                </span>
                <span className="text-sm font-semibold text-forest-dark/80">{feature}</span>
              </li>
            ))}
          </ul>
          <button className="w-full py-3.5 rounded-xl bg-white text-forest-dark font-bold text-sm shadow-sm border border-white/80 hover:bg-offwhite hover:border-vivid-emerald/30 transition-all mt-auto">Começar Grátis</button>
        </div>

        {/* Inteligente */}
        <div className="reveal relative rounded-[2rem] p-[2px] bg-gradient-to-br from-vivid-emerald to-vivid-lime shadow-[0_20px_60px_-15px_rgba(16,185,129,0.4)] transition-transform hover:-translate-y-2 z-10 flex flex-col h-full">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 bg-forest-dark rounded-full border border-vivid-emerald/50 shadow-lg flex items-center gap-1.5">
            <svg className="w-4 h-4 text-vivid-lime drop-shadow-[0_0_8px_rgba(132,204,22,0.8)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
            </svg>
            <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-vivid-emerald to-vivid-lime uppercase tracking-widest whitespace-nowrap drop-shadow-sm">
              Mais Escolhido
            </span>
          </div>
          <div className="bg-white/80 backdrop-blur-2xl rounded-[2rem] p-8 flex flex-col flex-1 relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-40 h-40 bg-vivid-emerald/20 rounded-full blur-3xl pointer-events-none" />
            <div className="mb-6 relative z-10">
              <span className="text-sm font-bold text-vivid-emerald uppercase tracking-wider">Pro</span>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl sm:text-5xl font-heading font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-forest-dark to-forest">R$ 89,90</span>
                <span className="text-sm font-semibold text-forest-light ml-1">/mês</span>
              </div>
              <p className="mt-2 text-sm font-medium text-forest-light">Inteligência Artificial no seu bolso.</p>
            </div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-forest-light/20 to-transparent my-6"></div>
            <ul className="space-y-4 mb-8 relative z-10 flex-1">
              {['Lotes Ilimitados', 'Dashboards PowerBI via WhatsApp', 'Otimização de Produção IA', 'Alertas Preditivos Ilimitados'].map(feature => (
                <li key={feature} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-vivid-emerald/20 flex items-center justify-center shrink-0 shadow-sm border border-vivid-emerald/30">
                    <svg className="w-3 h-3 text-vivid-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                  </span>
                  <span className="text-sm font-bold text-forest-dark">{feature}</span>
                </li>
              ))}
            </ul>
            <button className="w-full py-3.5 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white font-bold text-sm shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] hover:shadow-[0_10px_25px_-6px_rgba(132,204,22,0.6)] transition-all relative z-10 mt-auto">Assinar Agora</button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const AboutSection = () => (
  <section id="sobre" className="relative py-20 sm:py-28 border-t border-forest-light/10 overflow-hidden">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <div className="reveal max-w-2xl mx-auto">
        <p className="text-sm font-bold text-vivid-emerald tracking-wider uppercase mb-4">A Missão AgHero</p>
        <h2 className="text-2xl sm:text-4xl font-heading font-bold text-forest-dark mb-6">
          Desenvolvido por quem entende de granja para quem vive da granja.
        </h2>
        <p className="text-sm sm:text-base text-forest-light font-medium leading-relaxed mb-8">
          Nós unimos a robustez necessária para o trabalho bruto em campo com o poder preditivo da inteligência artificial. Queremos dar ao produtor rural e ao operador ferramentas que efetivamente geram retorno financeiro, cortando perdas e profissionalizando o controle, sem exigir internet rápida.
        </p>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="bg-forest-dark text-white/70 py-12 border-t border-white/10">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
      <div className="md:col-span-2">
        <span className="text-white font-heading font-bold text-2xl tracking-tight mb-4 block">AgHero</span>
        <p className="text-sm font-medium max-w-xs leading-relaxed">
          O Sistema Operacional da sua granja. Offline, preditivo e acessível.
        </p>
      </div>
      <div>
        <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-xs">Produto</h4>
        <ul className="space-y-2 text-sm font-medium">
          <li><a href="#funciona" className="hover:text-vivid-emerald transition-colors">Como funciona</a></li>
          <li><a href="#planos" className="hover:text-vivid-emerald transition-colors">Planos e Preços</a></li>
        </ul>
      </div>
      <div>
        <h4 className="text-white font-bold mb-4 uppercase tracking-wider text-xs">Contato</h4>
        <ul className="space-y-2 text-sm font-medium">
          <li>suporte@aghero.com</li>
          <li>+55 (11) 99999-9999</li>
        </ul>
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-white/10 text-sm font-medium text-center md:text-left flex flex-col md:flex-row justify-between">
      <span>© 2026 AgHero. Todos os direitos reservados.</span>
      <div className="space-x-4 mt-4 md:mt-0">
        <a href="#" className="hover:text-white transition-colors">Privacidade</a>
        <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
      </div>
    </div>
  </footer>
);

const PublicLanding = ({ onAcessarSistema }) => {
  useIntersectionObserver();
  return (
    <div className="w-full">
      <Navbar onAcessarSistema={onAcessarSistema} />
      <HeroSection onComeçar={onAcessarSistema} />
      <ProblemSection />
      <FeaturesSection />
      <PricingSection />
      <AboutSection />
      <Footer />
    </div>
  );
};

// ─── Root Export ─────────────────────────────────────────────────────

const PWABadge = () => {
  const swObj = useRegisterSW();
  const needRefresh = swObj?.needRefresh?.[0] || false;
  const setNeedRefresh = swObj?.needRefresh?.[1] || (() => {});
  const updateServiceWorker = swObj?.updateServiceWorker || (() => {});

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-forest-dark text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 animate-slide-up border border-white/20">
      <div className="flex-1">
        <p className="text-sm font-bold">Nova versão disponível!</p>
        <p className="text-xs text-white/70">Clique para atualizar o AgHero.</p>
      </div>
      <button onClick={() => updateServiceWorker(true)} className="px-3 py-1.5 bg-vivid-emerald text-white text-xs font-bold rounded-lg hover:scale-105 transition-transform">
        Atualizar
      </button>
      <button onClick={() => setNeedRefresh(false)} className="text-white/50 hover:text-white">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
};

// Helper para injetar o wrapper da animação do sistema
const SystemWrapper = ({ children, deferredPrompt, setDeferredPrompt, onInstallClick, mostrarOnboarding, setMostrarOnboarding }) => (
  <div className="fixed inset-0 w-full h-full overflow-hidden bg-offwhite font-sans text-forest-dark system-enter flex flex-col">
    {/* Fundo orgânico global para o sistema */}
    <div className="absolute top-0 right-0 w-[600px] sm:w-[800px] h-[600px] sm:h-[800px] bg-vivid-emerald/10 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
    <div className="absolute bottom-0 left-0 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-vivid-teal/10 rounded-full blur-[120px] translate-y-1/3 -translate-x-1/3 pointer-events-none" />
    
    <PWABadge />
    {/* PWA Install Banner */}
    {deferredPrompt && (
      <div className="relative z-50 bg-gradient-to-r from-forest-dark to-forest text-white px-4 py-3 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-slide-down">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-vivid-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Instalar AgHero</p>
            <p className="text-xs text-white/70">Acesse sua granja offline direto da tela inicial.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button onClick={() => setDeferredPrompt(null)} className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-white/70 hover:text-white transition-colors">Agora Não</button>
          <button onClick={onInstallClick} className="flex-1 sm:flex-none px-4 py-2 bg-vivid-emerald hover:bg-vivid-lime text-white text-xs font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]">Instalar</button>
        </div>
      </div>
    )}

    {children}
    {mostrarOnboarding && <Onboarding onFechar={() => setMostrarOnboarding(false)} />}
  </div>
);

export default function AgHero() {
  const [tela, setTela] = useState("landing");
  const [dataRetroativa, setDataRetroativa] = useState(null);
  const [fazendaAtiva, setFazendaAtiva] = useState(null);
  const [papelUsuario, setPapelUsuario] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false);

  useEffect(() => {
    // Escuta mudança de auth para pular login se já autenticado
    const callback = async (user) => {
      if (user && tela === "login") {
        const fazenda = await obterFazendaDoUsuario(user.uid);
        if (fazenda) {
          setFazendaAtiva(fazenda.id_fazenda || fazenda.id);
          setTela("dashboard");
        }
      }
    };
    
    const unsubscribe = (!auth.app && typeof auth.onAuthStateChanged === 'function')
      ? auth.onAuthStateChanged(callback)
      : onAuthStateChanged(auth, callback);
      
    return () => unsubscribe();
  }, [tela]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    // Listen for auth state changes to auto-load the user's farm
    const callback = async (user) => {
      if (user) {
        // Auto-vincula o colaborador caso ele tenha sido convidado
        await vincularColaboradorSePendente(user.uid, user.email, user.displayName);

        const fazenda = await obterFazendaDoUsuario(user.uid);
        if (fazenda) {
          setFazendaAtiva(fazenda.id_fazenda);
          let role = fazenda.papelColaborador || fazenda.membros?.[user.uid] || 'operator';
          if (role === 'dono') role = 'owner';
          if (role === 'peao') role = 'operator';
          setPapelUsuario(role);
        }
      }
    };
    
    const unsubscribe = (!auth.app && typeof auth.onAuthStateChanged === 'function')
      ? auth.onAuthStateChanged(callback)
      : onAuthStateChanged(auth, callback);
      
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checarOnboarding = async () => {
      const user = auth.currentUser;
      if (user && fazendaAtiva && tela !== "landing" && tela !== "login") {
        if (sessionStorage.getItem('onboardingExibido')) return;
        const concluiu = await verificarStatusOnboarding(user.uid);
        if (!concluiu) {
          setMostrarOnboarding(true);
          sessionStorage.setItem('onboardingExibido', 'true');
        }
      }
    };
    checarOnboarding();
  }, [fazendaAtiva, tela]);

  // Blinda telas restritas: operadores não acessam configurações/finanças/BI
  useEffect(() => {
    const ehOperador = papelUsuario === "peao" || papelUsuario === "operator";
    const ehOwner = papelUsuario === "dono" || papelUsuario === "owner";

    if ((tela === "configuracoes" || tela === "bi") && ehOperador) {
      setTela("dashboard");
    }
    if (tela === "financeiro" && !ehOwner) {
      setTela("dashboard");
    }
  }, [tela, papelUsuario]);

  const handleAcessarSistema = () => {
    if (fazendaAtiva) {
      setTela("dashboard");
    } else {
      setTela("login");
    }
  };

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          // Usuário aceitou a instalação
        }
        setDeferredPrompt(null);
      });
    }
  };



  if (tela === "login") {
    return (
      <Login 
        onLoginSuccess={(id) => { 
          setFazendaAtiva(id); 
          setTela("dashboard"); 
        }}
        onVoltar={() => setTela("landing")}
      />
    );
  }

  if (tela === "dashboard") {
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <DashboardReal
          id_fazenda={fazendaAtiva}
          papelUsuario={papelUsuario}
          onAbrirFormulario={() => {
            setDataRetroativa(null);
            setTela("formulario");
          }}
          onVoltar={() => setTela("landing")}
          onAbrirLotes={() => setTela("lotes")}
          onAbrirConfiguracoes={() => setTela("configuracoes")}
          onAbrirBI={() => setTela("bi")}
          onAbrirCalendario={() => setTela("calendario")}
          onAbrirNutricao={() => setTela("nutricao")}
          onAbrirAgua={() => setTela("agua")}
          onAbrirFinanceiro={() => setTela("financeiro")}
          onAbrirRelatorios={() => setTela("relatorios")}
          onAbrirImportador={() => setTela("importador")}
        />
      </SystemWrapper>
    );
  }

  if (tela === "lotes") {
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <GestaoLotes id_fazenda={fazendaAtiva} papelUsuario={papelUsuario} onVoltar={() => setTela("dashboard")} />
      </SystemWrapper>
    );
  }

  if (tela === "configuracoes") {
    if (papelUsuario === "peao" || papelUsuario === "operator") return null;
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <Configuracoes id_fazenda={fazendaAtiva} papelUsuario={papelUsuario} onVoltar={() => setTela("dashboard")} />
      </SystemWrapper>
    );
  }

  if (tela === "formulario") {
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <FormularioManejo
          id_fazenda={fazendaAtiva}
          onVoltar={() => {
            setTela("dashboard");
            setDataRetroativa(null);
          }}
          dataRetroativaStr={dataRetroativa}
        />
      </SystemWrapper>
    );
  }

  if (tela === "bi") {
    if (papelUsuario === "peao" || papelUsuario === "operator") return null;
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <CentralBI
          id_fazenda={fazendaAtiva}
          papelUsuario={papelUsuario}
          onVoltar={() => setTela("dashboard")}
          onAbrirDashboard={() => setTela("dashboard")}
          onAbrirLotes={() => setTela("lotes")}
          onAbrirConfiguracoes={() => setTela("configuracoes")}
          onAbrirCalendario={() => setTela("calendario")}
          onAbrirNutricao={() => setTela("nutricao")}
          onAbrirAgua={() => setTela("agua")}
          onAbrirFormulario={() => {
            setDataRetroativa(null);
            setTela("formulario");
          }}
          onAbrirFinanceiro={() => setTela("financeiro")}
          onAbrirRelatorios={() => setTela("relatorios")}
          onAbrirImportador={() => setTela("importador")}
        />
      </SystemWrapper>
    );
  }

  if (tela === "calendario") {
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <CalendarioManejo
          id_fazenda={fazendaAtiva}
          papelUsuario={papelUsuario}
          onVoltar={() => setTela("dashboard")}
          onLancarRetroativo={(dataStr) => {
            setDataRetroativa(dataStr);
            setTela("formulario");
          }}
          onAbrirFormulario={() => {
            setDataRetroativa(null);
            setTela("formulario");
          }}
          onAbrirBI={() => setTela("bi")}
          onAbrirNutricao={() => setTela("nutricao")}
          onAbrirAgua={() => setTela("agua")}
          onAbrirFinanceiro={() => setTela("financeiro")}
          onAbrirRelatorios={() => setTela("relatorios")}
          onAbrirImportador={() => setTela("importador")}
        />
      </SystemWrapper>
    );
  }

  if (tela === "nutricao") {
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <DashboardNutricao
          id_fazenda={fazendaAtiva}
          papelUsuario={papelUsuario}
          onVoltar={() => setTela("dashboard")}
          onAbrirDashboard={() => setTela("dashboard")}
          onAbrirFormulario={() => {
            setDataRetroativa(null);
            setTela("formulario");
          }}
          onAbrirLotes={() => setTela("lotes")}
          onAbrirConfiguracoes={() => setTela("configuracoes")}
          onAbrirBI={() => setTela("bi")}
          onAbrirCalendario={() => setTela("calendario")}
          onAbrirAgua={() => setTela("agua")}
          onAbrirFinanceiro={() => setTela("financeiro")}
          onAbrirRelatorios={() => setTela("relatorios")}
          onAbrirImportador={() => setTela("importador")}
        />
      </SystemWrapper>
    );
  }

  if (tela === "agua") {
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <DashboardAgua
          id_fazenda={fazendaAtiva}
          papelUsuario={papelUsuario}
          onVoltar={() => setTela("dashboard")}
          onAbrirDashboard={() => setTela("dashboard")}
          onAbrirFormulario={() => {
            setDataRetroativa(null);
            setTela("formulario");
          }}
          onAbrirLotes={() => setTela("lotes")}
          onAbrirConfiguracoes={() => setTela("configuracoes")}
          onAbrirBI={() => setTela("bi")}
          onAbrirCalendario={() => setTela("calendario")}
          onAbrirNutricao={() => setTela("nutricao")}
          onAbrirFinanceiro={() => setTela("financeiro")}
          onAbrirRelatorios={() => setTela("relatorios")}
          onAbrirImportador={() => setTela("importador")}
        />
      </SystemWrapper>
    );
  }

  if (tela === "financeiro") {
    if (papelUsuario !== "dono" && papelUsuario !== "owner") return null;
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <GestaoFinanceira
          id_fazenda={fazendaAtiva}
          papelUsuario={papelUsuario}
          onVoltar={() => setTela("dashboard")}
          onAbrirDashboard={() => setTela("dashboard")}
          onAbrirFormulario={() => {
            setDataRetroativa(null);
            setTela("formulario");
          }}
          onAbrirBI={() => setTela("bi")}
          onAbrirCalendario={() => setTela("calendario")}
          onAbrirNutricao={() => setTela("nutricao")}
          onAbrirAgua={() => setTela("agua")}
          onAbrirRelatorios={() => setTela("relatorios")}
          onAbrirImportador={() => setTela("importador")}
        />
      </SystemWrapper>
    );
  }

  if (tela === "relatorios") {
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <CentroRelatorios
          id_fazenda={fazendaAtiva}
          papelUsuario={papelUsuario}
          onVoltar={() => setTela("dashboard")}
          onAbrirDashboard={() => setTela("dashboard")}
          onAbrirFormulario={() => {
            setDataRetroativa(null);
            setTela("formulario");
          }}
          onAbrirBI={() => setTela("bi")}
          onAbrirCalendario={() => setTela("calendario")}
          onAbrirNutricao={() => setTela("nutricao")}
          onAbrirAgua={() => setTela("agua")}
          onAbrirFinanceiro={() => setTela("financeiro")}
          onAbrirImportador={() => setTela("importador")}
        />
      </SystemWrapper>
    );
  }

  if (tela === "importador") {
    return (
      <SystemWrapper deferredPrompt={deferredPrompt} setDeferredPrompt={setDeferredPrompt} onInstallClick={handleInstallClick} mostrarOnboarding={mostrarOnboarding} setMostrarOnboarding={setMostrarOnboarding}>
        <ImportadorDados
          id_fazenda={fazendaAtiva}
          papelUsuario={papelUsuario}
          onVoltar={() => setTela("dashboard")}
          onAbrirDashboard={() => setTela("dashboard")}
          onAbrirFormulario={() => {
            setDataRetroativa(null);
            setTela("formulario");
          }}
          onAbrirLotes={() => setTela("lotes")}
          onAbrirConfiguracoes={() => setTela("configuracoes")}
          onAbrirBI={() => setTela("bi")}
          onAbrirCalendario={() => setTela("calendario")}
          onAbrirNutricao={() => setTela("nutricao")}
          onAbrirAgua={() => setTela("agua")}
          onAbrirFinanceiro={() => setTela("financeiro")}
          onAbrirRelatorios={() => setTela("relatorios")}
          onAbrirImportador={() => setTela("importador")}
        />
      </SystemWrapper>
    );
  }

  // Renderiza a landing page única
  return (
    <main className="min-h-screen bg-offwhite font-sans antialiased relative">
      <PublicLanding onAcessarSistema={handleAcessarSistema} />
    </main>
  );
}
