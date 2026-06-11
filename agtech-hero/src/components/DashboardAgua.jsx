import React, { useState, useEffect } from "react";
import { obterLotesAtivos, obterUltimosRegistros, atualizarConfiguracaoPreditiva } from "../firebase/services";
import SidebarMenu from "./SidebarMenu";
import { analisarRelacaoAguaRacao, calcularAutonomiaReserva, calcularConsumoMedioAgua } from "../utils/aguaPreditiva";

const CAPACIDADE_AGUA_PADRAO_L = 20000;

export default function DashboardAgua({ id_fazenda, papelUsuario, onVoltar, onAbrirFormulario, onAbrirBI, onAbrirCalendario, onAbrirNutricao, onAbrirDashboard, onAbrirFinanceiro }) {
  const [lotes, setLotes] = useState(null);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);

  const [editandoCapacidade, setEditandoCapacidade] = useState(false);
  const [capacidadeInput, setCapacidadeInput] = useState("");

  useEffect(() => {
    if (!id_fazenda) return;
    let ativo = true;
    obterLotesAtivos(id_fazenda).then((res) => {
      if (!ativo) return;
      setLotes(res);
      if (res && res.length > 0) {
        setLoteSelecionadoId(res[0].id);
      } else {
        setCarregando(false);
      }
    });
    return () => { ativo = false; };
  }, [id_fazenda]);

  useEffect(() => {
    if (!id_fazenda || !loteSelecionadoId) return;
    setCarregando(true);

    obterUltimosRegistros(id_fazenda, 50).then((res) => {
      const histFiltrado = res
        .filter((r) => r.id_lote === loteSelecionadoId)
        .sort((a, b) => {
          const t1 = a.data_registro && a.data_registro.toDate ? a.data_registro.toDate() : new Date(a.data_registro);
          const t2 = b.data_registro && b.data_registro.toDate ? b.data_registro.toDate() : new Date(b.data_registro);
          return t1 - t2;
        });
      setHistorico(histFiltrado);
      setCarregando(false);
    });
  }, [id_fazenda, loteSelecionadoId]);

  useEffect(() => {
    if (!carregando) {
      const elements = document.querySelectorAll('.reveal-left');
      elements.forEach((el, index) => {
        el.style.transitionDelay = `${(index % 12) * 80}ms`;
        setTimeout(() => el.classList.add('reveal-left-visible'), 50);
      });
    }
  }, [carregando, loteSelecionadoId]);

  const loteAtual = lotes?.find((l) => l.id === loteSelecionadoId);
  const capacidadeReservatorioLitros = loteAtual?.capacidade_agua_litros || CAPACIDADE_AGUA_PADRAO_L;

  const consumoMedioAguaL = calcularConsumoMedioAgua(historico);
  const autonomia = calcularAutonomiaReserva(capacidadeReservatorioLitros, consumoMedioAguaL);
  const riscoFaltaAgua = autonomia.runway < 1.0; // Menos de 1 dia de autonomia

  // Obter relação água/ração do último dia com dados de ambos
  const ultimoRegistroCompleto = [...historico].reverse().find(r => r.agua_litros > 0 && r.racao_kg > 0);
  const litrosAguaUltimo = ultimoRegistroCompleto ? ultimoRegistroCompleto.agua_litros : 0;
  const kgRacaoUltimo = ultimoRegistroCompleto ? ultimoRegistroCompleto.racao_kg : 0;
  const relacaoAnalise = analisarRelacaoAguaRacao(litrosAguaUltimo, kgRacaoUltimo);

  // Status visual da relação
  let sliderColor = "bg-vivid-emerald";
  let textColor = "text-vivid-emerald";
  let bgAlerta = "bg-vivid-emerald/10 border-vivid-emerald/20";
  if (relacaoAnalise.status.includes('baixa')) {
    sliderColor = "bg-agriAlert-orange";
    textColor = "text-agriAlert-orange";
    bgAlerta = "bg-agriAlert-orange/10 border-agriAlert-orange/30";
  } else if (relacaoAnalise.status.includes('alta')) {
    sliderColor = "bg-agriAlert-red";
    textColor = "text-agriAlert-red";
    bgAlerta = "bg-agriAlert-red/10 border-agriAlert-red/30";
  }

  // Posição do slider visual (limitado visualmente entre 0.0 e 4.0)
  const sliderPosition = Math.min(Math.max((relacaoAnalise.relacao / 4.0) * 100, 0), 100);

  function handleAbrirEdicaoCapacidade() {
    setCapacidadeInput(String(capacidadeReservatorioLitros));
    setEditandoCapacidade(true);
  }

  function handleSalvarCapacidade(e) {
    e.preventDefault();
    const valor = parseFloat(capacidadeInput);
    if (!valor || valor <= 0 || !loteSelecionadoId) return;

    setLotes((prev) => prev.map((l) => l.id === loteSelecionadoId ? { ...l, capacidade_agua_litros: valor } : l));
    atualizarConfiguracaoPreditiva(id_fazenda, loteSelecionadoId, { capacidade_agua_litros: valor }).catch((err) => {
      console.error('[DashboardAgua] Falha ao atualizar capacidade de água:', err);
    });

    setEditandoCapacidade(false);
  }

  return (
    <div className="flex h-full w-full bg-offwhite text-forest-dark relative z-10 overflow-hidden font-sans">
      <SidebarMenu
        menuAberto={menuAberto}
        setMenuAberto={setMenuAberto}
        telaAtiva="agua"
        onAbrirDashboard={onAbrirDashboard}
        onAbrirFormulario={onAbrirFormulario}
        onAbrirNutricao={onAbrirNutricao}
        onAbrirBI={onAbrirBI}
        onAbrirCalendario={onAbrirCalendario}
        onAbrirFinanceiro={onAbrirFinanceiro}
        onSair={onVoltar}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/20">
        <header className="flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5 bg-white/30 backdrop-blur-md border-b border-white/50 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 -ml-2 text-forest-dark hover:bg-white/50 rounded-xl" onClick={() => setMenuAberto(true)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h1 className="text-lg lg:text-xl font-heading font-bold text-forest-dark tracking-tight leading-none">Monitoramento Hídrico</h1>
              <p className="hidden sm:block text-xs font-semibold text-forest-light/80 mt-1 uppercase tracking-wider">
                Consumo e Autonomia da Reserva
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {lotes && lotes.length > 0 ? (
              <div className="relative">
                <select
                  value={loteSelecionadoId || ""}
                  onChange={(e) => setLoteSelecionadoId(e.target.value)}
                  className="appearance-none rounded-xl border border-white/60 bg-white/50 px-4 py-2 pr-10 text-sm font-bold text-forest-dark shadow-sm focus:outline-none focus:border-vivid-emerald/50 transition-colors backdrop-blur-md cursor-pointer"
                >
                  {lotes.map((l) => (
                    <option key={l.id} value={l.id}>
                      Lote: {l.linhagem}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-forest-dark">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {carregando ? (
            <div className="flex flex-col items-center justify-center h-64 text-forest-light space-y-4">
              <div className="w-10 h-10 rounded-full border-4 border-vivid-emerald/20 border-t-vivid-emerald animate-spin shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
              <span className="text-sm font-bold tracking-wide uppercase">Sincronizando...</span>
            </div>
          ) : !loteAtual ? (
            <div className="glass-panel rounded-2xl p-8 text-center border-2 border-dashed border-forest/20">
              <p className="text-sm font-bold text-forest-light">Nenhum lote ativo encontrado para gerenciar água.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">

              {/* Relação Água / Ração (Fator de Ouro) */}
              <section className="reveal-left lg:col-span-2 glass-panel rounded-3xl p-6 shadow-sm border border-white/60">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Fator de Ouro: Relação Água / Ração</h2>
                    <p className="text-xs font-semibold text-forest-light/80 mt-1">A métrica preditiva mais importante de saúde do lote.</p>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-center shadow-sm border border-white/50 bg-white/60`}>
                    <p className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1">Relação Atual</p>
                    <p className={`text-3xl font-heading font-extrabold leading-none ${textColor}`}>
                      {relacaoAnalise.relacao.toFixed(2)}x
                    </p>
                  </div>
                </div>

                {/* Medidor Deslizante */}
                <div className="relative pt-6 pb-2 w-full mx-auto max-w-4xl">
                  {/* Gradiente Fundo */}
                  <div className="h-4 rounded-full w-full flex overflow-hidden shadow-inner border border-white/30">
                    <div className="h-full bg-agriAlert-orange" style={{ width: '40%' }}></div> {/* 0.0 a 1.6 */}
                    <div className="h-full bg-vivid-emerald" style={{ width: '15%' }}></div> {/* 1.6 a 2.2 */}
                    <div className="h-full bg-agriAlert-red" style={{ width: '45%' }}></div> {/* 2.2 a 4.0 */}
                  </div>
                  
                  {/* Marcadores */}
                  <div className="flex justify-between text-[9px] font-bold text-forest-light mt-2 px-1">
                    <span>0x</span>
                    <span className="ml-[10%]">1.6x (Frio/Entupimento)</span>
                    <span className="mr-[5%]">2.2x (Calor/Vazamento)</span>
                    <span>4x+</span>
                  </div>

                  {/* Slider (Ponteiro) */}
                  <div 
                    className="absolute top-2 -ml-3 w-6 h-8 flex flex-col items-center justify-center transition-all duration-1000 ease-out"
                    style={{ left: `${sliderPosition}%` }}
                  >
                    <div className={`w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-forest-dark mb-1 drop-shadow-md`}></div>
                    <div className="w-1.5 h-6 bg-forest-dark rounded-full shadow-md"></div>
                  </div>
                </div>

                <div className={`mt-8 rounded-2xl p-4 border ${bgAlerta} backdrop-blur-md`}>
                  <p className={`text-sm font-bold ${textColor} flex items-start gap-2`}>
                    <span className="text-xl">💡</span>
                    <span>Diagnóstico da IA: {relacaoAnalise.diagnostico}</span>
                  </p>
                </div>
              </section>

              {/* Reserva Central de Água */}
              <section className="reveal-left glass-panel rounded-3xl p-6 shadow-sm border border-white/60 flex flex-col relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-vivid-teal/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center justify-between mb-6 z-10">
                  <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Reserva Hídrica</h2>
                  {papelUsuario !== 'peao' && (
                    <button
                      onClick={handleAbrirEdicaoCapacidade}
                      className="text-[10px] font-bold text-forest-light hover:text-vivid-teal transition-colors uppercase tracking-wider underline decoration-dotted"
                    >
                      Capacidade: {capacidadeReservatorioLitros.toLocaleString('pt-BR')} L
                    </button>
                  )}
                </div>

                <div className="flex-1 flex flex-col items-center justify-center mb-6 z-10">
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center border-[6px] shadow-[0_0_30px_rgba(20,184,166,0.2)] bg-white/50 backdrop-blur-sm ${riscoFaltaAgua ? 'border-agriAlert-red' : 'border-vivid-teal'}`}>
                    <div className="text-center">
                      <p className={`text-4xl font-heading font-extrabold ${riscoFaltaAgua ? 'text-agriAlert-red' : 'text-forest-dark'}`}>
                        {autonomia.dias >= 99 ? '∞' : autonomia.dias}
                      </p>
                      <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mt-1">Dias</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-forest-dark mt-4">
                    + {autonomia.horas} horas restantes
                  </p>
                  <p className="text-[10px] text-center font-medium text-forest-light mt-1 max-w-[200px]">
                    Tempo estimado até esvaziar a caixa em caso de pane na bomba do poço.
                  </p>
                </div>

                {riscoFaltaAgua && (
                  <p className="text-xs font-bold text-center text-agriAlert-red animate-pulse z-10 bg-agriAlert-red/10 py-2 rounded-xl">
                    ⚠️ Atenção: A reserva de água é muito baixa para o consumo médio!
                  </p>
                )}
              </section>

              {/* Status dos Nipples (Mock/Integração Futura) */}
              <section className="reveal-left glass-panel rounded-3xl p-6 shadow-sm border border-white/60 flex flex-col relative overflow-hidden">
                <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-vivid-emerald/10 rounded-full blur-3xl pointer-events-none" />
                <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide mb-6 z-10">Status da Linha de Nipples</h2>
                
                <div className="flex-1 space-y-4 z-10">
                  <div className="flex items-center justify-between bg-white/40 border border-white/50 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-vivid-emerald/10 flex items-center justify-center border border-vivid-emerald/20">
                        <span className="text-xl">💧</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-forest-dark">Fluxo Geral</p>
                        <p className="text-[10px] font-semibold text-forest-light uppercase tracking-wider">Média 45 ml/min (Pressão ideal)</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-vivid-emerald/10 text-vivid-emerald text-xs font-bold rounded-lg border border-vivid-emerald/20">Normal</span>
                  </div>

                  <div className="flex items-center justify-between bg-white/40 border border-white/50 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-agriAlert-orange/10 flex items-center justify-center border border-agriAlert-orange/20">
                        <span className="text-xl">🔧</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-forest-dark">Linha 3 - Fundo</p>
                        <p className="text-[10px] font-semibold text-forest-light uppercase tracking-wider">Pressão levemente reduzida</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-agriAlert-orange/10 text-agriAlert-orange text-xs font-bold rounded-lg border border-agriAlert-orange/20">Verificar</span>
                  </div>
                </div>
              </section>

            </div>
          )}
        </main>
      </div>

      {editandoCapacidade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-dark/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-white/60">
            <h3 className="text-lg font-heading font-bold text-forest-dark mb-4">Capacidade do Reservatório Central</h3>
            <form onSubmit={handleSalvarCapacidade} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Capacidade (Litros)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={capacidadeInput}
                  onChange={(e) => setCapacidadeInput(e.target.value)}
                  className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald transition-all text-forest-dark"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditandoCapacidade(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-forest-dark bg-white/50 hover:bg-white/80 transition-colors border border-white/60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-vivid-teal to-vivid-emerald shadow-[0_10px_20px_-5px_rgba(20,184,166,0.4)] hover:scale-105 active:scale-95 transition-transform"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
