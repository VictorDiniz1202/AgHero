import React from "react";

// Itens de navegação compartilhados entre todas as telas autenticadas.
// `prop` indica qual handler (recebido via props) deve ser chamado ao clicar.
const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Visão Geral",
    prop: "onAbrirDashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
      </svg>
    ),
  },
  {
    key: "formulario",
    label: "Lançar Manejo",
    prop: "onAbrirFormulario",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    key: "nutricao",
    label: "Nutrição & Silo",
    prop: "onAbrirNutricao",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3c4.418 0 8 1.343 8 3s-3.582 3-8 3-8-1.343-8-3 3.582-3 8-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6v12c0 1.657 3.582 3 8 3s8-1.343 8-3V6" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12c0 1.657 3.582 3 8 3s8-1.343 8-3" />
      </svg>
    ),
  },
  {
    key: "agua",
    label: "Consumo de Água",
    prop: "onAbrirAgua",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2.69l5.657 5.657a8 8 0 11-11.314 0L12 2.69z" />
      </svg>
    ),
  },
  {
    key: "bi",
    label: "Central BI & IA",
    prop: "onAbrirBI",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    key: "calendario",
    label: "Calendário",
    prop: "onAbrirCalendario",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: "financeiro",
    label: "Gestão Financeira",
    prop: "onAbrirFinanceiro",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

/**
 * Sidebar de navegação unificada (desktop fixo + drawer mobile).
 * Mantém a navegação idêntica em todas as telas autenticadas do AgTech Hero.
 */
export default function SidebarMenu({ menuAberto, setMenuAberto, telaAtiva, onSair, ...handlers }) {
  return (
    <>
      {menuAberto && (
        <div
          className="fixed inset-0 bg-forest-dark/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/60 border-r border-forest-light/10 flex flex-col justify-between backdrop-blur-2xl transition-transform duration-300 lg:relative lg:translate-x-0 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-5 space-y-8 overflow-y-auto">
          {/* Logo & Close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-vivid-emerald to-vivid-teal flex items-center justify-center shadow-sm">
                <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                  <path d="M17 8C8 10 5.9 16.17 3.82 19.34A1 1 0 0 0 5.18 20.5C7 17 9 14 15 13" />
                  <path d="M12 8a4 4 0 0 1 4-4c0 4-3 6-4 6" />
                </svg>
              </div>
              <span className="text-xl font-heading font-bold text-forest-dark tracking-tight">Agtech</span>
            </div>
            <button className="lg:hidden p-1 text-forest-light hover:text-forest-dark" onClick={() => setMenuAberto(false)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const ativo = item.key === telaAtiva;
              const handler = handlers[item.prop];
              return (
                <div
                  key={item.key}
                  onClick={() => {
                    if (ativo || !handler) return;
                    setMenuAberto(false);
                    handler();
                  }}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${
                    ativo
                      ? 'bg-vivid-emerald/10 font-bold text-vivid-emerald cursor-default'
                      : 'font-semibold text-forest-light hover:bg-white/50 cursor-pointer'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </div>
              );
            })}
            {onSair && (
              <div
                onClick={() => { setMenuAberto(false); onSair(); }}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-forest-light hover:bg-white/50 cursor-pointer transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Sair do Painel
              </div>
            )}
          </nav>
        </div>

        {/* Upgrade Box */}
        <div className="p-5">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-forest-dark to-forest p-4 shadow-xl">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center mb-3">
              <span className="text-vivid-emerald text-lg">✨</span>
            </div>
            <p className="text-sm font-bold text-white mb-1">Plano Inteligente</p>
            <p className="text-xs text-white/70 leading-relaxed mb-4">Desbloqueie IA preditiva para todos os lotes.</p>
            <button className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-xs font-bold text-white">
              Fazer Upgrade
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
