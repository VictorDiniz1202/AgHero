import React, { useState, useEffect } from "react";
import { obterLotesAtivos, obterUltimosRegistros, registrarCargaSilo, obterCargasSilo, atualizarConfiguracaoPreditiva } from "../firebase/services";
import { Timestamp } from "firebase/firestore";
import {
  calcularNivelSilo,
  calcularDiasRestantesSilo,
  calcularDataEsgotamento,
  calcularConsumoMedio,
} from "../utils/siloPreditivo";

const CAPACIDADE_SILO_PADRAO_KG = 15000;

// Formata um Date para "YYYY-MM-DD" local (mesma convenção de data_registro_str)
function formatarDataStr(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export default function DashboardNutricao({ id_fazenda, papelUsuario, planoAssinatura, onVoltar, onAbrirFormulario, onAbrirBI, onAbrirCalendario, onAbrirAgua, onAbrirDashboard, onAbrirFinanceiro, onAbrirRelatorios, onAbrirImportador }) {
  const [lotes, setLotes] = useState(null);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [cargasSilo, setCargasSilo] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);

  const [modalCargaAberto, setModalCargaAberto] = useState(false);
  const [novaCargaQtd, setNovaCargaQtd] = useState("");
  const [novaCargaData, setNovaCargaData] = useState(formatarDataStr(new Date()));

  const [editandoCapacidade, setEditandoCapacidade] = useState(false);
  const [capacidadeInput, setCapacidadeInput] = useState("");

  // Carrega os lotes ativos
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

  // Carrega o histórico de registros do lote selecionado (para consumo médio e CA)
  useEffect(() => {
    if (!id_fazenda || !loteSelecionadoId) return;
    setCarregando(true);

    obterUltimosRegistros(id_fazenda, 50).then((res) => {
      const histFiltrado = res
        .filter((r) => r.id_lote === loteSelecionadoId)
        .sort((a, b) => {
          const t1 = a.data_registro instanceof Timestamp ? a.data_registro.toDate() : new Date(a.data_registro);
          const t2 = b.data_registro instanceof Timestamp ? b.data_registro.toDate() : new Date(b.data_registro);
          return t1 - t2;
        });
      setHistorico(histFiltrado);
      setCarregando(false);
    });
  }, [id_fazenda, loteSelecionadoId]);

  // Carrega o histórico de cargas registradas no silo do lote selecionado
  useEffect(() => {
    if (!id_fazenda || !loteSelecionadoId) return;
    obterCargasSilo(id_fazenda, loteSelecionadoId).then((res) => {
      setCargasSilo(res || []);
    });
  }, [id_fazenda, loteSelecionadoId]);

  // Efeito para revelar itens suavemente
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
  const capacidadeSiloKg = loteAtual?.capacidade_silo_kg || CAPACIDADE_SILO_PADRAO_KG;

  // Estoque atual = soma das cargas registradas - soma da ração consumida no histórico
  const totalCargasKg = cargasSilo.reduce((acc, c) => acc + (c.quantidade_kg || 0), 0);
  const totalRacaoConsumidaKg = historico.reduce((acc, r) => acc + (r.racao_kg || 0), 0);
  const estoqueAtualKg = Math.max(0, totalCargasKg - totalRacaoConsumidaKg);

  const consumoMedioKg = calcularConsumoMedio(historico);
  const nivelSilo = calcularNivelSilo(estoqueAtualKg, capacidadeSiloKg);
  const diasRestantes = calcularDiasRestantesSilo(estoqueAtualKg, consumoMedioKg);
  const dataEsgotamento = calcularDataEsgotamento(diasRestantes);
  const estoqueCritico = diasRestantes < 3;

  // CA (Conversão Alimentar) acumulada real adaptada
  const ultimoRegistroComPeso = [...historico].reverse().find(r => typeof r.peso_medio_g === 'number' && r.peso_medio_g > 0);
  const totalMortalidade = historico.reduce((acc, r) => acc + (r.mortalidade_qtd || 0), 0);
  const avesAtivas = Math.max(0, (loteAtual?.quantidade_inicial || 0) - totalMortalidade);
  const aptidaoAtual = loteAtual?.aptidao || "corte";
  
  let caAcumulada = null;
  const pesoMedioKg = ultimoRegistroComPeso ? ultimoRegistroComPeso.peso_medio_g / 1000 : null;
  const pesoVivoTotalKg = pesoMedioKg && avesAtivas > 0 ? pesoMedioKg * avesAtivas : null;
  const totalOvosComerciais = historico.reduce((sum, r) => sum + (r.producao_ovos_qtd || 0), 0);

  if (aptidaoAtual === "postura") {
    if (totalOvosComerciais > 0 && totalRacaoConsumidaKg > 0) {
      caAcumulada = totalRacaoConsumidaKg / (totalOvosComerciais / 12);
    }
  } else {
    if (pesoVivoTotalKg && pesoVivoTotalKg > 0) {
      caAcumulada = totalRacaoConsumidaKg / pesoVivoTotalKg;
    }
  }

  function handleAbrirModalCarga() {
    setNovaCargaQtd("");
    setNovaCargaData(formatarDataStr(new Date()));
    setModalCargaAberto(true);
  }

  function handleSalvarCarga(e) {
    e.preventDefault();
    const qtd = parseFloat(novaCargaQtd);
    if (!qtd || qtd <= 0 || !novaCargaData || !loteSelecionadoId) return;

    // Escrita otimista: atualiza a UI imediatamente, sem aguardar o Firestore.
    const cargaOtimista = {
      id: `local-${Date.now()}`,
      quantidade_kg: qtd,
      data_str: novaCargaData,
      timestamp_registro: Timestamp.now(),
    };
    setCargasSilo((prev) => [cargaOtimista, ...prev]);

    registrarCargaSilo(id_fazenda, loteSelecionadoId, { quantidade_kg: qtd, data_str: novaCargaData }).catch((err) => {
      console.error('[DashboardNutricao] Falha ao registrar carga do silo:', err);
    });

    setModalCargaAberto(false);
  }

  function handleAbrirEdicaoCapacidade() {
    setCapacidadeInput(String(capacidadeSiloKg));
    setEditandoCapacidade(true);
  }

  function handleSalvarCapacidade(e) {
    e.preventDefault();
    const valor = parseFloat(capacidadeInput);
    if (!valor || valor <= 0 || !loteSelecionadoId) return;

    setLotes((prev) => prev.map((l) => l.id === loteSelecionadoId ? { ...l, capacidade_silo_kg: valor } : l));
    atualizarConfiguracaoPreditiva(id_fazenda, loteSelecionadoId, { capacidade_silo_kg: valor }).catch((err) => {
      console.error('[DashboardNutricao] Falha ao atualizar capacidade do silo:', err);
    });

    setEditandoCapacidade(false);
  }

  return (
    <div className="flex h-full w-full bg-offwhite text-forest-dark relative z-10 overflow-hidden font-sans">
      {/* --- SIDEBAR (Desktop e Mobile Drawer) --- */}
      

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/20">

        {/* Topbar */}
        <header className="flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5 bg-white/30 backdrop-blur-md border-b border-white/50 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 -ml-2 text-forest-dark hover:bg-white/50 rounded-xl" onClick={() => setMenuAberto(true)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h1 className="text-lg lg:text-xl font-heading font-bold text-forest-dark tracking-tight leading-none">Nutrição & Silo</h1>
              <p className="hidden sm:block text-xs font-semibold text-forest-light/80 mt-1 uppercase tracking-wider">
                Estoque de ração e autonomia preditiva
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

            <button
              onClick={handleAbrirModalCarga}
              disabled={!loteSelecionadoId}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime px-4 py-2 text-sm font-bold text-white shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
              <span className="hidden sm:inline">Registrar Nova Carga</span>
              <span className="sm:hidden">Carga</span>
            </button>
          </div>
        </header>

        {/* Dashboard Scrollable Body */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {carregando ? (
            <div className="flex flex-col items-center justify-center h-64 text-forest-light space-y-4">
              <div className="w-10 h-10 rounded-full border-4 border-vivid-emerald/20 border-t-vivid-emerald animate-spin shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
              <span className="text-sm font-bold tracking-wide uppercase">Sincronizando...</span>
            </div>
          ) : !loteAtual ? (
            <div className="glass-panel rounded-2xl p-8 text-center border-2 border-dashed border-forest/20">
              <p className="text-sm font-bold text-forest-light">Nenhum lote ativo encontrado para gerenciar o silo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* --- SILO VIRTUAL --- */}
              <section className={`reveal-left lg:col-span-1 glass-panel rounded-3xl p-6 shadow-sm flex flex-col items-center text-center transition-all ${estoqueCritico ? 'ring-2 ring-agriAlert-red/40 animate-pulse' : ''}`}>
                <div className="flex items-center justify-between w-full mb-4">
                  <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Silo Virtual</h2>
                  {papelUsuario !== 'peao' && papelUsuario !== 'operator' && (
                    <button
                      onClick={handleAbrirEdicaoCapacidade}
                      title="Editar capacidade máxima"
                      className="text-[10px] font-bold text-forest-light hover:text-vivid-emerald transition-colors uppercase tracking-wider underline decoration-dotted"
                    >
                      Capacidade: {capacidadeSiloKg.toLocaleString('pt-BR')} kg
                    </button>
                  )}
                </div>

                {/* Representação visual do silo */}
                <div className="w-28 sm:w-32 mx-auto select-none">
                  <div className="h-3 rounded-t-full bg-white/50 border border-white/70 mx-2 shadow-inner" />
                  <div className={`relative h-48 sm:h-56 rounded-b-2xl border-2 overflow-hidden shadow-inner bg-white/20 backdrop-blur-md ${estoqueCritico ? 'border-agriAlert-red/50' : 'border-white/60'}`}>
                    <div
                      className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-out ${estoqueCritico ? 'bg-gradient-to-t from-agriAlert-red to-agriAlert-orange' : 'bg-gradient-to-t from-vivid-emerald to-vivid-lime'}`}
                      style={{ height: `${nivelSilo}%` }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-2 bg-white/30" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-heading font-extrabold text-forest-dark drop-shadow-sm bg-white/50 backdrop-blur-sm px-3 py-1 rounded-xl">
                        {nivelSilo.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className={`w-0 h-0 mx-auto border-l-[56px] border-l-transparent border-r-[56px] border-r-transparent border-t-[28px] ${estoqueCritico ? 'border-t-agriAlert-red' : 'border-t-forest-dark'}`} />
                </div>

                <p className="mt-5 text-xs font-semibold text-forest-light">
                  Estoque estimado: <span className="font-bold text-forest-dark">{estoqueAtualKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg</span>
                </p>

                {/* Runway Preditivo */}
                <div className={`mt-4 w-full rounded-2xl p-4 ${estoqueCritico ? 'bg-agriAlert-red/10 border border-agriAlert-red/30' : 'bg-vivid-emerald/10 border border-vivid-emerald/20'}`}>
                  <p className={`text-3xl font-heading font-extrabold ${estoqueCritico ? 'text-agriAlert-red' : 'text-forest-dark'}`}>
                    {diasRestantes >= 99 ? '∞' : diasRestantes.toFixed(1)}
                  </p>
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${estoqueCritico ? 'text-agriAlert-red' : 'text-forest-light'}`}>
                    {diasRestantes >= 99 ? 'Sem consumo registrado' : 'dias restantes (runway)'}
                  </p>
                  {diasRestantes < 99 && (
                    <p className="mt-2 text-xs font-semibold text-forest-dark">
                      Data prevista de esgotamento: <span className="font-bold">{dataEsgotamento.toLocaleDateString('pt-BR')}</span>
                    </p>
                  )}
                  {estoqueCritico && (
                    <p className="mt-2 text-xs font-bold text-agriAlert-red animate-pulse">
                      ⚠️ Estoque crítico! Programe o reabastecimento o quanto antes.
                    </p>
                  )}
                </div>
              </section>

              {/* --- COLUNA DIREITA: CA + HISTÓRICO --- */}
              <div className="lg:col-span-2 space-y-6">

                {/* CA (Conversão Alimentar) Acumulada */}
                <section className="reveal-left glass-panel rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide mb-1">
                    {aptidaoAtual === 'postura' ? "Conversão Alimentar (CA) por Dúzia" : "Conversão Alimentar (CA) Acumulada"}
                  </h2>
                  <p className="text-xs font-semibold text-forest-light/80 mb-4">
                    {aptidaoAtual === 'postura' 
                      ? "Relação entre ração consumida e dúzias de ovos comerciais produzidas. Quanto menor, mais eficiente." 
                      : "Relação entre ração consumida e peso vivo produzido. Quanto menor, mais eficiente o lote."}
                  </p>

                  {caAcumulada !== null ? (
                    <div className="flex flex-wrap items-end gap-6">
                      <div>
                        <p className="text-4xl font-heading font-extrabold text-forest-dark leading-none">{caAcumulada.toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-forest-light uppercase tracking-wider mt-1">
                          {aptidaoAtual === 'postura' ? "kg ração / dz ovos" : "kg ração / kg vivo"}
                        </p>
                      </div>
                      <div className="flex-1 min-w-[160px] grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-white/40 border border-white/60 p-3">
                          <p className="text-[10px] font-bold text-forest-light uppercase tracking-wider">Ração Acumulada</p>
                          <p className="text-sm font-bold text-forest-dark mt-1">{totalRacaoConsumidaKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg</p>
                        </div>
                        <div className="rounded-xl bg-white/40 border border-white/60 p-3">
                          <p className="text-[10px] font-bold text-forest-light uppercase tracking-wider">
                            {aptidaoAtual === 'postura' ? "Dúzias Produzidas" : "Peso Vivo Estimado"}
                          </p>
                          <p className="text-sm font-bold text-forest-dark mt-1">
                            {aptidaoAtual === 'postura' 
                              ? `${Math.round(totalOvosComerciais / 12).toLocaleString('pt-BR')} dz` 
                              : `${pesoVivoTotalKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-xl border-2 border-dashed border-forest/20 p-4 text-center text-xs font-medium text-forest-light">
                      {aptidaoAtual === 'postura'
                        ? "Aguardando registro de coleta de ovos para calcular a Conversão Alimentar por dúzia."
                        : "Aguardando registro de pesagem (Peso Médio) para calcular a Conversão Alimentar acumulada."}
                    </p>
                  )}
                </section>

                {/* Histórico de Cargas do Silo */}
                <section className="reveal-left glass-panel rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide mb-4">Histórico de Cargas</h2>
                  {cargasSilo.length === 0 ? (
                    <p className="rounded-xl border-2 border-dashed border-forest/20 p-4 text-center text-xs font-medium text-forest-light">
                      Nenhuma carga registrada ainda. Use "Registrar Nova Carga" para iniciar o controle do silo.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {cargasSilo.map((carga) => {
                        const pendente = String(carga.id).startsWith('local-');
                        const dataFormatada = carga.data_str ? new Date(carga.data_str + 'T00:00:00').toLocaleDateString('pt-BR') : '--';
                        return (
                          <div key={carga.id} className="flex items-center justify-between rounded-xl bg-white/40 border border-white/60 px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">🌾</span>
                              <div>
                                <p className="text-sm font-bold text-forest-dark leading-none">{(carga.quantidade_kg || 0).toLocaleString('pt-BR')} kg</p>
                                <p className="text-[10px] font-semibold text-forest-light mt-1">{dataFormatada}</p>
                              </div>
                            </div>
                            {pendente && (
                              <span className="text-[10px] font-bold text-agriAlert-orange bg-agriAlert-orange/10 px-2 py-1 rounded-full">Sincronizando...</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal: Registrar Nova Carga */}
      {modalCargaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-dark/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-white/60">
            <h3 className="text-lg font-heading font-bold text-forest-dark mb-4">Registrar Nova Carga no Silo</h3>
            <form onSubmit={handleSalvarCarga} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Quantidade (kg)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="Ex: 5000"
                  value={novaCargaQtd}
                  onChange={(e) => setNovaCargaQtd(e.target.value)}
                  className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald transition-all text-forest-dark placeholder-forest-light/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Data da Carga</label>
                <input
                  type="date"
                  required
                  value={novaCargaData}
                  onChange={(e) => setNovaCargaData(e.target.value)}
                  className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald transition-all text-forest-dark"
                />
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalCargaAberto(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-forest-dark bg-white/50 hover:bg-white/80 transition-colors border border-white/60"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-vivid-emerald to-vivid-lime shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-transform"
                >
                  Salvar Carga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Capacidade do Silo */}
      {editandoCapacidade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-dark/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-white/60">
            <h3 className="text-lg font-heading font-bold text-forest-dark mb-4">Capacidade Máxima do Silo</h3>
            <form onSubmit={handleSalvarCapacidade} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Capacidade (kg)</label>
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
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-vivid-emerald to-vivid-lime shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 transition-transform"
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
