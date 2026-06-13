import React from "react";
import { normalizarPlano } from "../firebase/services";

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
    key: "grade",
    label: "Lançamento em Lote",
    prop: "onAbrirGrade",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
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
    label: "AgBoy",
    prop: "onAbrirBI",
    icon: (
      <div className="w-5 h-5 rounded-full border border-white/60 shadow-inner flex items-center justify-center overflow-hidden shrink-0 bg-forest-light relative">
        <img 
          src="/agboy_avatar.png" 
          alt="AgBoy" 
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const span = document.createElement('span');
            span.className = 'text-[10px]';
            span.innerText = '🤖';
            e.currentTarget.parentNode.appendChild(span);
          }}
        />
      </div>
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
  {
    key: "relatorios",
    label: "Relatórios",
    prop: "onAbrirRelatorios",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    key: "importador",
    label: "Importar Planilhas",
    prop: "onAbrirImportador",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
];

/**
 * Sidebar de navegação unificada (desktop fixo + drawer mobile).
 * Mantém a navegação idêntica em todas as telas autenticadas do AgHero.
 *
 * Restrição por papel (`papelUsuario`):
 * - operator/peao: oculta Gestão Financeira e Central BI.
 * - veterinarian: oculta apenas Gestão Financeira.
 * - owner/dono: vê todos os itens.
 */
export default function SidebarMenu({ menuAberto, setMenuAberto, colapsada, setColapsada, telaAtiva, onSair, papelUsuario, planoAssinatura, ...handlers }) {
  const ehOperador = papelUsuario === 'peao' || papelUsuario === 'operator';
  const ehOwner = papelUsuario === 'dono' || papelUsuario === 'owner';

  const itensVisiveis = NAV_ITEMS.filter((item) => {
    if (item.key === 'financeiro') return ehOwner;
    if (item.key === 'bi') {
      const temPlanoIA = normalizarPlano(planoAssinatura) === 'Inteligente';
      return !ehOperador && temPlanoIA;
    }
    return true;
  });

  return (
    <>
      {menuAberto && (
        <div
          className="no-print fixed inset-0 bg-forest-dark/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMenuAberto(false)}
        />
      )}
      <aside className={`no-print fixed inset-y-0 left-0 z-50 ${colapsada ? 'w-20' : 'w-64'} bg-white/70 border-r border-forest-light/10 flex flex-col backdrop-blur-3xl transition-all duration-300 lg:relative lg:translate-x-0 ${menuAberto ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Logo & Close - Area fixa no topo */}
        <div className={`shrink-0 p-5 pb-2 flex items-center ${colapsada ? 'justify-center' : 'justify-between'} relative`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-vivid-emerald to-vivid-teal flex items-center justify-center shadow-sm shrink-0">
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M12 21.5c-1.35-3.15-4-5.4-7.65-6.75c2.7 1.8 4.95 4.5 7.65 6.75z" />
                <path d="M12 21.5c2.25-4.5 6.3-7.2 10.35-8.55c-3.6 2.7-7.2 5.85-10.35 8.55z" />
              </svg>
            </div>
            {!colapsada && <span className="text-xl font-heading font-bold text-forest-dark tracking-tight whitespace-nowrap">AgHero</span>}
          </div>
          {!colapsada && (
            <button className="lg:hidden p-1 text-forest-light hover:text-forest-dark shrink-0" onClick={() => setMenuAberto(false)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}

          {/* Toggle de Colapso Desktop */}
          <button
            onClick={() => setColapsada(!colapsada)}
            className="hidden lg:flex absolute -right-3 top-6 w-6 h-6 bg-white border border-cinza-borda rounded-full items-center justify-center text-forest-light hover:text-vivid-emerald shadow-sm z-50 transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform duration-300 ${colapsada ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation - Área com rolagem que expande */}
        <div className="flex-1 overflow-y-auto p-5 pt-4">
          <nav className="space-y-1.5">
            {itensVisiveis.map((item) => {
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
                  className={`flex items-center ${colapsada ? 'justify-center px-0' : 'gap-3 px-4'} rounded-xl py-2.5 text-sm transition-all duration-200 ${
                    ativo
                      ? 'bg-vivid-emerald/10 font-bold text-vivid-emerald shadow-[inset_0_1px_3px_rgba(16,185,129,0.1)] cursor-default'
                      : 'font-semibold text-forest-light hover:bg-white/60 hover:text-forest-dark cursor-pointer'
                  }`}
                  title={colapsada ? item.label : undefined}
                >
                  <span className={`${ativo ? 'scale-110 transition-transform duration-300' : ''} shrink-0`}>{item.icon}</span>
                  {!colapsada && <span className="whitespace-nowrap">{item.label}</span>}
                </div>
              );
            })}
            
            {/* Divisor */}
            {onSair && <div className={`h-px bg-forest-light/10 my-4 ${colapsada ? 'mx-auto w-8' : 'w-full'}`} />}

            {onSair && (
              <div
                onClick={() => { setMenuAberto(false); onSair(); }}
                className={`flex items-center ${colapsada ? 'justify-center px-0' : 'gap-3 px-4'} rounded-xl py-2.5 text-sm font-semibold text-forest-light hover:bg-agriAlert-red/10 hover:text-agriAlert-red cursor-pointer transition-colors`}
                title={colapsada ? "Sair do Painel" : undefined}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                {!colapsada && <span className="whitespace-nowrap">Sair do Painel</span>}
              </div>
            )}
          </nav>
        </div>

        {/* Upgrade Box Premium - Área fixa na base */}
        <div className={`shrink-0 pt-0 mt-auto ${colapsada ? 'p-2' : 'p-5'}`}>
          {normalizarPlano(planoAssinatura) === 'Standard' ? (
          <div className={`relative group overflow-hidden rounded-2xl p-[1px] shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-vivid-emerald/20 cursor-pointer ${colapsada ? 'h-14 w-14 mx-auto' : ''}`}
               onClick={() => {
                 if (handlers.onAbrirConfiguracoes) {
                   setMenuAberto(false);
                   handlers.onAbrirConfiguracoes();
                 }
               }}
               title={colapsada ? "Fazer Upgrade para o Plano Pro" : undefined}
          >
            {/* Borda Animada/Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-vivid-emerald via-vivid-lime to-vivid-emerald opacity-60 group-hover:opacity-100 transition-opacity"></div>
            
            <div className={`relative rounded-2xl bg-[#0b1411] h-full flex flex-col overflow-hidden ${colapsada ? 'p-0 items-center justify-center' : 'p-4'}`}>
              {/* Efeito de luz interno */}
              <div className="absolute -right-8 -top-8 w-28 h-28 bg-vivid-emerald/20 rounded-full blur-2xl pointer-events-none group-hover:bg-vivid-lime/30 transition-all duration-500"></div>
              
              <div className={`flex items-center gap-3 relative z-10 ${colapsada ? 'mb-0' : 'mb-2.5'}`}>
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-vivid-emerald to-vivid-teal flex items-center justify-center shadow-inner border border-white/20 shrink-0">
                  <span className="text-white text-xs shadow-sm">✨</span>
                </div>
                {!colapsada && (
                  <div>
                    <p className="text-[10px] font-bold text-vivid-lime uppercase tracking-widest leading-none mb-0.5">Fazer Upgrade</p>
                    <p className="text-[13px] font-heading font-bold text-white leading-none">Plano Pro</p>
                  </div>
                )}
              </div>
              
              {!colapsada && (
                <>
                  <p className="text-[11px] text-white/60 leading-snug mb-4 relative z-10 font-medium pr-2">
                    Desbloqueie IA preditiva e alcance resultados máximos.
                  </p>
                  
                  <button className="relative w-full py-2 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white text-xs font-bold shadow-[0_4px_12px_rgba(16,185,129,0.3)] transition-all overflow-hidden group/btn">
                    <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover/btn:duration-1000 group-hover/btn:[transform:skew(-12deg)_translateX(100%)]">
                      <div className="relative h-full w-8 bg-white/20" />
                    </div>
                    <span className="relative z-10">Aprimore seu Plano</span>
                  </button>
                </>
              )}
            </div>
          </div>
          ) : (
          <div className={`relative overflow-hidden rounded-2xl p-[1px] shadow-sm cursor-default ${colapsada ? 'h-14 w-14 mx-auto' : ''}`} title={colapsada ? "Plano Pro Ativo" : undefined}>
            <div className={`relative rounded-2xl bg-white/50 border border-vivid-emerald/30 h-full flex flex-col overflow-hidden backdrop-blur-md ${colapsada ? 'p-0 items-center justify-center' : 'p-4'}`}>
              <div className="absolute -right-8 -top-8 w-28 h-28 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-8 h-8 rounded-xl bg-vivid-emerald/20 flex items-center justify-center shadow-inner border border-vivid-emerald/30 shrink-0">
                  <span className="text-vivid-emerald text-xs shadow-sm">✨</span>
                </div>
                {!colapsada && (
                  <div>
                    <p className="text-[10px] font-bold text-vivid-emerald uppercase tracking-widest leading-none mb-0.5">Plano Ativo</p>
                    <p className="text-[13px] font-heading font-bold text-forest-dark leading-none">Pro</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </aside>
    </>
  );
}
