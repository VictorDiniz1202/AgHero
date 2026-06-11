import React, { useState, useEffect } from "react";
import { obterLotesAtivos, obterRegistrosDiarios, obterRegistrosSanitarios, registrarExportacao } from "../firebase/services";
import { gerarCSV } from "../utils/exportadorDados";
import { auth } from "../firebase/config";
import SidebarMenu from "./SidebarMenu";

export default function CentroRelatorios({ id_fazenda, papelUsuario, onVoltar, onAbrirDashboard, onAbrirFormulario, onAbrirLotes, onAbrirConfiguracoes, onAbrirBI, onAbrirCalendario, onAbrirNutricao, onAbrirAgua, onAbrirFinanceiro }) {
  const [lotes, setLotes] = useState([]);
  const [loteSelecionado, setLoteSelecionado] = useState("");
  const [tipoRelatorio, setTipoRelatorio] = useState("Completo");
  const [gerando, setGerando] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [menuAberto, setMenuAberto] = useState(false);

  // Estados de dados da tabela
  const [registros, setRegistros] = useState({ diarios: [], sanitarios: [] });
  const [carregandoDados, setCarregandoDados] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (id_fazenda) {
      obterLotesAtivos(id_fazenda).then(dados => {
        setLotes(dados);
        if (dados.length > 0) setLoteSelecionado(dados[0].id);
      });
    }
  }, [id_fazenda]);

  useEffect(() => {
    if (id_fazenda && loteSelecionado) {
      setCarregandoDados(true);
      Promise.all([
        obterRegistrosDiarios(id_fazenda, loteSelecionado),
        obterRegistrosSanitarios(id_fazenda, loteSelecionado)
      ]).then(([diarios, sanitarios]) => {
        setRegistros({ diarios, sanitarios });
        setCarregandoDados(false);
      });
    } else {
      setRegistros({ diarios: [], sanitarios: [] });
    }
  }, [id_fazenda, loteSelecionado]);

  const loteData = lotes.find(l => l.id === loteSelecionado) || {};
  const aptidaoLote = loteData.aptidao || "corte"; // fallback

  const handleExportar = async () => {
    setGerando(true);
    
    try {
      // Mock para simular delay natural caso a conexão esteja offline/online
      await new Promise(r => setTimeout(r, 600));

      const csvString = gerarCSV(tipoRelatorio, registros, aptidaoLote);
      
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_${tipoRelatorio}_Lote_${loteData.linhagem || loteSelecionado}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const uid = auth.currentUser?.uid || 'local_user';
      await registrarExportacao(id_fazenda, uid, tipoRelatorio, { lote: loteSelecionado });
    } catch (error) {
      console.error("Erro na exportação:", error);
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-offwhite text-forest-dark relative z-10 overflow-hidden font-sans">
      <SidebarMenu
        menuAberto={menuAberto}
        setMenuAberto={setMenuAberto}
        telaAtiva="relatorios"
        papelUsuario={papelUsuario}
        onAbrirDashboard={onAbrirDashboard}
        onAbrirFormulario={onAbrirFormulario}
        onAbrirNutricao={onAbrirNutricao}
        onAbrirAgua={onAbrirAgua}
        onAbrirBI={onAbrirBI}
        onAbrirCalendario={onAbrirCalendario}
        onAbrirFinanceiro={onAbrirFinanceiro}
        onSair={onVoltar}
      />
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/20">
        <header className="no-print flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5 bg-white/30 backdrop-blur-md border-b border-white/50 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 -ml-2 text-forest-dark hover:bg-white/50 rounded-xl" onClick={() => setMenuAberto(true)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h1 className="text-xl font-heading font-extrabold tracking-tight">Exportação de Dados</h1>
              <p className="text-[10px] font-bold text-forest-light uppercase tracking-wider mt-1">Centro de Relatórios</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-6 pb-16">
        
        {isOffline && (
          <div className="bg-agriAlert-orange/20 border border-agriAlert-orange/40 text-agriAlert-orange rounded-xl p-3 flex items-center gap-2 shadow-sm animate-pulse">
            <span className="text-lg">⚠️</span>
            <p className="text-xs font-bold uppercase tracking-wider">Você está offline. O relatório conterá apenas dados sincronizados.</p>
          </div>
        )}

        <section className="glass-panel p-5 lg:p-6 rounded-2xl shadow-sm border border-white/60">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-8 h-8 rounded-full bg-vivid-emerald/10 flex items-center justify-center text-vivid-emerald">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            </span>
            <h2 className="text-lg font-heading font-bold text-forest-dark">Filtros de Exportação</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Seletor de Lote</label>
              <select
                value={loteSelecionado}
                onChange={e => setLoteSelecionado(e.target.value)}
                className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald focus:ring-1 focus:ring-vivid-emerald transition-all text-forest-dark appearance-none"
              >
                {lotes.length === 0 && <option value="">Nenhum lote ativo encontrado</option>}
                {lotes.map(l => (
                  <option key={l.id} value={l.id}>{l.linhagem} ({l.aptidao === 'postura' ? 'Postura' : 'Corte'})</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Tipo de Relatório</label>
              <select
                value={tipoRelatorio}
                onChange={e => setTipoRelatorio(e.target.value)}
                className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald focus:ring-1 focus:ring-vivid-emerald transition-all text-forest-dark appearance-none"
              >
                <option value="Completo">Completo</option>
                <option value="Consumo">Consumo Diário</option>
                <option value="Sanitário">Histórico Sanitário</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleExportar}
            disabled={gerando || !loteSelecionado}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-white font-bold tracking-wide hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_10px_20px_-5px_rgba(20,184,166,0.3)] disabled:opacity-50 flex items-center justify-center border border-white/20"
          >
            {gerando ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Gerando...
              </span>
            ) : "Gerar Relatório CSV"}
          </button>
        </section>

        {/* Prévia da Tabela */}
        <section className="glass-panel rounded-2xl shadow-sm border border-white/60 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/50 bg-white/30">
             <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wider">Prévia dos Dados</h2>
          </div>
          <div className="p-0 overflow-x-auto">
            {carregandoDados ? (
              <div className="p-8 text-center text-forest-light font-bold text-sm">Carregando dados...</div>
            ) : registros.diarios.length === 0 && registros.sanitarios.length === 0 ? (
               <div className="p-8 text-center text-forest-light font-bold text-sm border-dashed border-2 border-white/60 m-4 rounded-xl">
                  Nenhum dado encontrado para o lote selecionado.
               </div>
            ) : (
              <table className="w-full text-left text-sm text-forest-dark whitespace-nowrap">
                <thead className="bg-white/40 text-[10px] uppercase font-bold tracking-widest text-forest-light/80 border-b border-white/60">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Idade</th>
                    {tipoRelatorio !== 'Sanitário' && (
                      <>
                        <th className="px-4 py-3">Mortalidade</th>
                        <th className="px-4 py-3">Ração (kg)</th>
                        <th className="px-4 py-3">Água (L)</th>
                      </>
                    )}
                    {tipoRelatorio === 'Completo' && (
                      <>
                        {aptidaoLote === 'postura' ? (
                          <>
                            <th className="px-4 py-3">Ovos Produzidos</th>
                            <th className="px-4 py-3">% Postura</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3">Peso Médio</th>
                            <th className="px-4 py-3">GPD</th>
                          </>
                        )}
                      </>
                    )}
                    {tipoRelatorio === 'Sanitário' && (
                      <>
                        <th className="px-4 py-3">Intervenção</th>
                        <th className="px-4 py-3">Produto</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {/* Simplificando a visualização da prévia pegando max 5 registros */}
                  {(tipoRelatorio === 'Sanitário' ? registros.sanitarios : registros.diarios).slice(0, 5).map((r, i) => (
                    <tr key={i} className="hover:bg-white/20 transition-colors">
                      <td className="px-4 py-3">{r.data_registro_str || r.data_aplicacao_str || r.data_str || '--'}</td>
                      <td className="px-4 py-3">{r.idadeDias || '--'}</td>
                      {tipoRelatorio !== 'Sanitário' && (
                        <>
                          <td className="px-4 py-3">{r.mortalidade || 0}</td>
                          <td className="px-4 py-3">{r.consumo_racao || 0}</td>
                          <td className="px-4 py-3">{r.consumo_agua || 0}</td>
                        </>
                      )}
                      {tipoRelatorio === 'Completo' && (
                        <>
                          {aptidaoLote === 'postura' ? (
                            <>
                              <td className="px-4 py-3">{r.ovos_produzidos || 0}</td>
                              <td className="px-4 py-3">{r.taxa_postura ? `${r.taxa_postura}%` : '--'}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3">{r.peso_medio || 0}</td>
                              <td className="px-4 py-3">{r.gpd || 0}</td>
                            </>
                          )}
                        </>
                      )}
                      {tipoRelatorio === 'Sanitário' && (
                        <>
                          <td className="px-4 py-3">{r.tipo || 'Aplicação'}</td>
                          <td className="px-4 py-3">{r.produto || r.vacina || r.nome || '--'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {((tipoRelatorio === 'Sanitário' ? registros.sanitarios : registros.diarios).length > 5) && (
              <div className="p-3 text-center text-xs font-bold text-forest-light bg-white/20 border-t border-white/60">
                Mostrando apenas 5 registros. Exporte o CSV para ver todos.
              </div>
            )}
          </div>
        </section>
      </main>
      </div>
    </div>
  );
}
