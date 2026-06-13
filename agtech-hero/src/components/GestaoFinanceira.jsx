import React, { useState, useEffect } from "react";
import { functions } from "../firebase/config";
import { httpsCallable } from "firebase/functions";
import { registrarTransacao, obterTransacoesLote } from "../firebase/services";

export default function GestaoFinanceira({
  id_fazenda,
  papelUsuario,
  onVoltar,
  onAbrirDashboard,
  onAbrirFormulario,
  onAbrirNutricao,
  onAbrirAgua,
  onAbrirBI,
  onAbrirCalendario,
  onAbrirRelatorios,
  onAbrirImportador
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transacoes, setTransacoes] = useState([
    { id: 1, tipo: "receita", valor: 15000, data: "2026-06-10", categoria: "Venda de Lote", descricao: "Lote Cobb 500" },
    { id: 2, tipo: "despesa", valor: 4500, data: "2026-06-05", categoria: "Ração", descricao: "Compra de ração inicial" },
    { id: 3, tipo: "despesa", valor: 1200, data: "2026-06-01", categoria: "Sanidade", descricao: "Vacinas e vitaminas" }
  ]);
  const [auditoria, setAuditoria] = useState(null);
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await obterTransacoesLote(id_fazenda, "geral");
      if (data && data.length > 0) {
        setTransacoes(data.map(d => ({ ...d, data: d.data_str || d.data })));
      }
    }
    if (id_fazenda) load();
  }, [id_fazenda]);

  const [novaTransacao, setNovaTransacao] = useState({
    tipo: "receita",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    categoria: "Venda",
    descricao: ""
  });

  const totalReceita = transacoes.filter(t => t.tipo === "receita").reduce((acc, t) => acc + (parseFloat(t.valor) || 0), 0);
  const totalDespesa = transacoes.filter(t => t.tipo === "despesa").reduce((acc, t) => acc + (parseFloat(t.valor) || 0), 0);
  const lucroLiquido = totalReceita - totalDespesa;

  const handleAuditoriaIA = async () => {
    setCarregandoAuditoria(true);
    setAuditoria(null);
    try {
      const chatComAgBoy = httpsCallable(functions, 'chatComAgBoy');
      const res = await chatComAgBoy({
        id_fazenda: id_fazenda,
        mensagem: `Gere uma auditoria financeira detalhada. Sou o dono da granja. 
Os dados do lote são: Receita Total: R$ ${totalReceita}, Despesa Total: R$ ${totalDespesa}, Lucro Líquido: R$ ${lucroLiquido}. 
As transações registradas foram: ${JSON.stringify(transacoes)}.
Forneça insights de eficiência e aponte possíveis gargalos. Foque os cálculos nestes números.`
      });

      setAuditoria(res.data.resposta);
    } catch (err) {
      setAuditoria(`Ops, houve um erro ao processar sua auditoria com o AgBoy: ${err.message}`);
    } finally {
      setCarregandoAuditoria(false);
    }
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!novaTransacao.valor || isNaN(parseFloat(novaTransacao.valor)) || parseFloat(novaTransacao.valor) <= 0) return;
    
    const transData = { 
      ...novaTransacao, 
      valor: parseFloat(novaTransacao.valor),
      data_str: novaTransacao.data
    };

    try {
      const res = await registrarTransacao(id_fazenda, "geral", transData);
      setTransacoes([
        { ...transData, id: res.id },
        ...transacoes
      ]);
      setIsModalOpen(false);
      setNovaTransacao({
        tipo: "receita",
        valor: "",
        data: new Date().toISOString().split("T")[0],
        categoria: "Venda",
        descricao: ""
      });
    } catch (err) {
      console.error(err);
    }
  };

  const formatarMoeda = (valor) => {
    const num = parseFloat(valor);
    if (isNaN(num)) return "R$ 0,00";
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarData = (dataVal) => {
    if (!dataVal) return "N/A";
    try {
      let dateObj;
      if (typeof dataVal.toDate === 'function') {
        dateObj = dataVal.toDate();
      } else if (dataVal.seconds) {
        dateObj = new Date(dataVal.seconds * 1000);
      } else {
        dateObj = new Date(dataVal);
      }
      if (isNaN(dateObj.getTime())) return "Data inválida";
      return dateObj.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    } catch (e) {
      return "Data inválida";
    }
  };

  return (
    <div className="flex h-full w-full bg-offwhite text-forest-dark relative z-10 overflow-hidden font-sans">
      

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/20">
        <header className="flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5 bg-white/30 backdrop-blur-md border-b border-white/50 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 -ml-2 text-forest-dark hover:bg-white/50 rounded-xl" onClick={() => setMenuAberto(true)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h1 className="text-lg lg:text-xl font-heading font-bold text-forest-dark tracking-tight leading-none">
                Gestão Financeira
              </h1>
              <p className="hidden sm:block text-xs font-semibold text-forest-light/80 mt-1 uppercase tracking-wider">
                Controle de Receitas e Despesas
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime px-4 py-2 text-sm font-bold text-white shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] hover:scale-105 transition-transform"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
            <span className="hidden sm:inline">Nova Movimentação</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6 pb-24 lg:pb-0">
            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform border border-white/60">
                <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-vivid-emerald"></span> Receita Total
                </p>
                <p className="text-3xl font-heading font-extrabold text-vivid-emerald leading-none">
                  {formatarMoeda(totalReceita)}
                </p>
              </div>
              <div className="glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform border border-white/60">
                <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-agriAlert-red"></span> Despesa Total
                </p>
                <p className="text-3xl font-heading font-extrabold text-agriAlert-red leading-none">
                  {formatarMoeda(totalDespesa)}
                </p>
              </div>
              <div className={`glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform border border-white/60 ${lucroLiquido >= 0 ? "bg-vivid-emerald/5" : "bg-agriAlert-red/5"}`}>
                <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Lucro Líquido</p>
                <p className={`text-3xl font-heading font-extrabold leading-none ${lucroLiquido >= 0 ? "text-vivid-emerald" : "text-agriAlert-red"}`}>
                  {formatarMoeda(lucroLiquido)}
                </p>
              </div>
            </div>

            {/* Auditoria IA (Sprint 30) */}
            <div className="glass-panel rounded-2xl p-6 shadow-sm border border-vivid-emerald/30 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-vivid-emerald/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg font-heading font-bold text-forest-dark flex items-center gap-2">
                    <span className="text-xl">🤖</span> Auditor Financeiro IA (AgBoy)
                  </h2>
                  <p className="text-sm text-forest-light">Obtenha um diagnóstico completo do ROI e da eficiência financeira do lote.</p>
                </div>
                <button
                  onClick={handleAuditoriaIA}
                  disabled={carregandoAuditoria}
                  className="shrink-0 flex items-center gap-2 rounded-xl bg-forest-dark px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-forest transition-colors disabled:opacity-50"
                >
                  {carregandoAuditoria ? (
                    <span className="animate-pulse">Analisando dados...</span>
                  ) : (
                    <>Gerar Relatório de Auditoria <span className="text-vivid-emerald">✨</span></>
                  )}
                </button>
              </div>
              
              {auditoria && (
                <div className="mt-4 p-5 bg-white/80 border border-white/60 rounded-xl shadow-inner text-sm font-medium text-forest-dark leading-relaxed whitespace-pre-wrap">
                  {auditoria}
                </div>
              )}
            </div>

            {/* Transações */}
            <div className="glass-panel rounded-2xl p-5 shadow-sm border border-white/60">
              <h2 className="text-sm font-heading font-bold text-forest-dark mb-4 uppercase tracking-widest">Transações Recentes</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-forest-light/20 text-forest-light">
                      <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[10px]">Data</th>
                      <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[10px]">Categoria</th>
                      <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[10px]">Descrição</th>
                      <th className="py-3 px-4 font-semibold uppercase tracking-wider text-[10px] text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transacoes.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="py-8 text-center text-forest-light text-xs font-semibold">
                          Nenhuma movimentação registrada.
                        </td>
                      </tr>
                    ) : (
                      transacoes.map((t) => (
                        <tr key={t.id} className="border-b border-white/50 hover:bg-white/40 transition-colors">
                          <td className="py-3 px-4 text-forest-dark font-medium whitespace-nowrap">
                            {formatarData(t.data)}
                          </td>
                          <td className="py-3 px-4 text-forest-dark">
                            <span className="bg-white/60 px-2 py-1 rounded-md text-[10px] font-bold uppercase border border-white/80 shadow-sm">
                              {t.categoria}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-forest-light font-medium">{t.descricao}</td>
                          <td className={`py-3 px-4 text-right font-bold ${t.tipo === "receita" ? "text-vivid-emerald" : "text-agriAlert-red"}`}>
                            {t.tipo === "receita" ? "+" : "-"}{formatarMoeda(t.valor)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modal Nova Movimentação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-dark/40 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl relative border border-white/80 animate-slide-up">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-forest-light hover:text-agriAlert-red transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-xl font-heading font-bold text-forest-dark mb-6 text-center">Registrar Movimentação</h2>
            
            <form onSubmit={handleSalvar} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNovaTransacao({ ...novaTransacao, tipo: "receita" })}
                  className={`py-2 rounded-xl text-sm font-bold border transition-colors ${novaTransacao.tipo === "receita" ? "bg-vivid-emerald/20 border-vivid-emerald text-vivid-emerald" : "bg-white/50 border-white/60 text-forest-light hover:bg-white/80"}`}
                >
                  Receita
                </button>
                <button
                  type="button"
                  onClick={() => setNovaTransacao({ ...novaTransacao, tipo: "despesa" })}
                  className={`py-2 rounded-xl text-sm font-bold border transition-colors ${novaTransacao.tipo === "despesa" ? "bg-agriAlert-red/20 border-agriAlert-red text-agriAlert-red" : "bg-white/50 border-white/60 text-forest-light hover:bg-white/80"}`}
                >
                  Despesa
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-forest-dark uppercase tracking-wider mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-forest-dark font-bold focus:outline-none focus:border-vivid-emerald/50"
                  value={novaTransacao.valor}
                  onChange={(e) => setNovaTransacao({ ...novaTransacao, valor: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-forest-dark uppercase tracking-wider mb-1">Data</label>
                <input
                  type="date"
                  required
                  className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-forest-dark font-bold focus:outline-none focus:border-vivid-emerald/50"
                  value={novaTransacao.data}
                  onChange={(e) => setNovaTransacao({ ...novaTransacao, data: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-forest-dark uppercase tracking-wider mb-1">Categoria</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Ração, Venda, Sanidade..."
                  className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-forest-dark font-bold focus:outline-none focus:border-vivid-emerald/50"
                  value={novaTransacao.categoria}
                  onChange={(e) => setNovaTransacao({ ...novaTransacao, categoria: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-forest-dark uppercase tracking-wider mb-1">Descrição</label>
                <input
                  type="text"
                  placeholder="Detalhes opcionais..."
                  className="w-full rounded-xl border border-white/60 bg-white/50 px-4 py-2.5 text-forest-dark font-bold focus:outline-none focus:border-vivid-emerald/50"
                  value={novaTransacao.descricao}
                  onChange={(e) => setNovaTransacao({ ...novaTransacao, descricao: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 mt-4 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white font-bold text-sm shadow-md hover:scale-[1.02] transition-transform"
              >
                Salvar Registro
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
