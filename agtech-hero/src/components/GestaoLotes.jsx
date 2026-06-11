import React, { useState, useEffect } from "react";
import { obterLotesAtivos, obterLotesInativos, adicionarLote, encerrarLote } from "../firebase/services";
import { Timestamp } from "firebase/firestore";

export default function GestaoLotes({ id_fazenda, papelUsuario, onVoltar }) {
  const ehPeao = papelUsuario === "peao";
  const [lotesAtivos, setLotesAtivos] = useState([]);
  const [lotesInativos, setLotesInativos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // Form states
  const [aptidao, setAptidao] = useState("corte");
  const [linhagem, setLinhagem] = useState("Cobb 500");
  const [quantidade, setQuantidade] = useState("");
  const [dataAlojamento, setDataAlojamento] = useState(new Date().toISOString().split("T")[0]);
  const [frequenciaPesagem, setFrequenciaPesagem] = useState("semanal");
  const [diasPersonalizados, setDiasPersonalizados] = useState("7,14,21,28,35,42,49");
  const [custoAve, setCustoAve] = useState("");
  const [custoRacao, setCustoRacao] = useState("");
  const [precoVenda, setPrecoVenda] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Modal de confirmação
  const [loteParaEncerrar, setLoteParaEncerrar] = useState(null);

  const carregarDados = async () => {
    setCarregando(true);
    const ativos = await obterLotesAtivos(id_fazenda);
    const inativos = await obterLotesInativos(id_fazenda);
    setLotesAtivos(ativos);
    setLotesInativos(inativos);
    setCarregando(false);
  };

  useEffect(() => {
    if (id_fazenda) {
      carregarDados();
    }
  }, [id_fazenda]);

  const handleAlojar = async (e) => {
    e.preventDefault();
    if (!quantidade || parseInt(quantidade) <= 0) return;
    setSalvando(true);

    try {
      const [ano, mes, dia] = dataAlojamento.split("-");
      const dataObj = new Date(ano, mes - 1, dia);

      const loteData = {
        aptidao,
        linhagem,
        quantidade_inicial: parseInt(quantidade),
        data_alojamento: Timestamp.fromDate(dataObj),
        frequencia_pesagem: frequenciaPesagem,
        financeiro: {
          custo_ave: parseFloat(custoAve) || 0,
          custo_racao: parseFloat(custoRacao) || 0,
          preco_venda: parseFloat(precoVenda) || 0,
        }
      };

      if (frequenciaPesagem === "personalizado") {
        loteData.dias_pesagem_personalizados = diasPersonalizados
          .split(",")
          .map((d) => parseInt(d.trim()))
          .filter((d) => !isNaN(d) && d > 0);
      }

      await adicionarLote(id_fazenda, loteData);

      // Reset form e atualiza a lista
      setQuantidade("");
      setAptidao("corte");
      setLinhagem("Cobb 500");
      setFrequenciaPesagem("semanal");
      setDiasPersonalizados("7,14,21,28,35,42,49");
      setCustoAve("");
      setCustoRacao("");
      setPrecoVenda("");
      await carregarDados();
    } catch (error) {
      console.error("Erro ao criar lote:", error);
      alert("Houve um problema ao processar o lote. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarEncerramento = async () => {
    if (!loteParaEncerrar) return;
    await encerrarLote(id_fazenda, loteParaEncerrar.id);
    setLoteParaEncerrar(null);
    carregarDados();
  };

  const calcularIdade = (ts) => {
    if (!ts) return 0;
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return Math.max(0, Math.floor((new Date() - date) / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="flex flex-col h-screen relative z-10 text-forest-dark overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-panel border-b border-white/50 px-4 py-4 lg:px-8 flex items-center gap-4 shadow-sm">
        <button 
          onClick={onVoltar}
          className="p-2 rounded-lg bg-white/40 border border-white/60 hover:bg-white/70 transition-colors text-forest-dark"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h1 className="text-xl font-heading font-extrabold tracking-tight">Gestão de Lotes</h1>
          <p className="text-[10px] font-bold text-forest-light uppercase tracking-wider">Alojamento e Histórico</p>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto w-full space-y-6 pb-16">
        
        {/* Formulário de Novo Lote */}
        {ehPeao ? (
          <section className="glass-panel p-5 lg:p-6 rounded-2xl shadow-sm border border-white/60 text-center">
            <p className="text-sm font-bold text-forest-light">
              Apenas proprietários podem alojar novos lotes.
            </p>
          </section>
        ) : (
        <section className="glass-panel p-5 lg:p-6 rounded-2xl shadow-sm border border-white/60">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-full bg-vivid-emerald/10 flex items-center justify-center text-vivid-emerald">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
            </span>
            <h2 className="text-lg font-heading font-bold text-forest-dark">Alojar Novo Lote</h2>
          </div>

          <form onSubmit={handleAlojar} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Aptidão</label>
              <select 
                value={aptidao} 
                onChange={e => {
                  setAptidao(e.target.value);
                  if (e.target.value === "postura") setLinhagem("Lohmann");
                  if (e.target.value === "corte" && linhagem === "Lohmann") setLinhagem("Cobb 500");
                }}
                className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald focus:ring-1 focus:ring-vivid-emerald transition-all text-forest-dark appearance-none"
              >
                <option value="corte">Corte (Carne)</option>
                <option value="postura">Postura (Ovos)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Linhagem</label>
              <select 
                value={linhagem} 
                onChange={e => setLinhagem(e.target.value)}
                className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald focus:ring-1 focus:ring-vivid-emerald transition-all text-forest-dark appearance-none"
              >
                {aptidao === "corte" ? (
                  <>
                    <option value="Cobb 500">Cobb 500</option>
                    <option value="Ross 308">Ross 308</option>
                    <option value="Hubbard">Hubbard</option>
                  </>
                ) : (
                  <option value="Lohmann">Lohmann</option>
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Qtd. Inicial (Cabeças)</label>
              <input 
                type="number" 
                required
                min="1"
                placeholder="Ex: 20000"
                value={quantidade}
                onChange={e => setQuantidade(e.target.value)}
                className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald transition-all text-forest-dark placeholder-forest-light/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Data Alojamento</label>
              <input 
                type="date" 
                required
                value={dataAlojamento}
                onChange={e => setDataAlojamento(e.target.value)}
                className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald transition-all text-forest-dark"
              />
            </div>
            {/* Planejador de Pesagens */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Frequência de Pesagem</label>
              <select
                value={frequenciaPesagem}
                onChange={e => setFrequenciaPesagem(e.target.value)}
                className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald focus:ring-1 focus:ring-vivid-emerald transition-all text-forest-dark appearance-none"
              >
                <option value="semanal">Semanal (a cada 7 dias)</option>
                <option value="diario">Diário</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
            {frequenciaPesagem === "personalizado" && (
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">Dias de Vida para Pesagem</label>
                <input
                  type="text"
                  placeholder="Ex: 7,14,21,28,35,42,49"
                  value={diasPersonalizados}
                  onChange={e => setDiasPersonalizados(e.target.value)}
                  className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald transition-all text-forest-dark placeholder-forest-light/40"
                />
                <p className="text-[10px] text-forest-light mt-1 pl-1 leading-tight font-medium">
                  <strong>Como funciona?</strong> Insira com quantos dias de vida do lote (após o alojamento) as pesagens ocorrerão. 
                  Por exemplo, <span className="font-bold text-forest-dark">7, 14, 21</span> significa que o app cobrará pesagens no 7º dia, no 14º dia e no 21º dia. Separe os números por vírgula.
                </p>
              </div>
            )}

            {/* Módulo Financeiro Simplificado */}
            <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/30">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1 flex items-center gap-1">
                  <span className="text-vivid-emerald">💰</span> Custo Inicial (R$/Ave)
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="Ex: 2.50"
                  value={custoAve}
                  onChange={e => setCustoAve(e.target.value)}
                  className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald transition-all text-forest-dark placeholder-forest-light/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">
                  Custo Ração (R$/Kg)
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="Ex: 2.20"
                  value={custoRacao}
                  onChange={e => setCustoRacao(e.target.value)}
                  className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald transition-all text-forest-dark placeholder-forest-light/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-widest pl-1">
                  Preço de Venda Esperado
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  placeholder="Ex: 6.00 (R$/kg)"
                  value={precoVenda}
                  onChange={e => setPrecoVenda(e.target.value)}
                  className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-vivid-emerald transition-all text-forest-dark placeholder-forest-light/40"
                />
              </div>
            </div>

            <div className="md:col-span-4 mt-2">
              <button
                type="submit"
                disabled={salvando}
                className="w-full h-[46px] rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white font-bold tracking-wide hover:scale-[1.02] active:scale-95 transition-transform shadow-[0_10px_20px_-5px_rgba(16,185,129,0.3)] disabled:opacity-50 flex items-center justify-center border border-white/20"
              >
                {salvando ? "Alojando..." : "Alojar Lote"}
              </button>
            </div>
          </form>
        </section>
        )}

        {/* Lotes Ativos */}
        <section>
          <h2 className="text-sm font-heading font-bold text-forest-dark mb-3 uppercase tracking-wider px-2">Lotes Ativos ({lotesAtivos.length})</h2>
          {carregando ? (
            <div className="text-center p-4 text-forest-light font-bold text-sm">Carregando...</div>
          ) : lotesAtivos.length === 0 ? (
            <div className="glass-panel p-6 rounded-2xl text-center border-dashed border-2 border-white text-forest-light font-medium text-sm">
              Nenhum lote ativo no momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lotesAtivos.map(lote => (
                <div key={lote.id} className="glass-panel p-5 rounded-2xl shadow-sm border-l-4 border-l-vivid-emerald flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold font-heading">{lote.linhagem}</h3>
                      <div className="flex gap-2">
                        {lote.aptidao && (
                          <span className="bg-forest-light/10 text-forest-dark text-[10px] font-bold px-2 py-1 rounded-md uppercase">
                            {lote.aptidao === "postura" ? "🥚 Postura" : "🍗 Corte"}
                          </span>
                        )}
                        <span className="bg-vivid-emerald/10 text-vivid-emerald text-[10px] font-bold px-2 py-1 rounded-md uppercase">Ativo</span>
                      </div>
                    </div>
                    <div className="flex gap-4 mb-4">
                      <div>
                        <p className="text-[10px] text-forest-light uppercase font-bold tracking-wider">População</p>
                        <p className="font-bold text-lg leading-none mt-1">{lote.quantidade_inicial?.toLocaleString('pt-BR')}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-forest-light uppercase font-bold tracking-wider">Idade</p>
                        <p className="font-bold text-lg leading-none mt-1">{calcularIdade(lote.data_alojamento)} <span className="text-xs">dias</span></p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/50 flex justify-end">
                    {ehPeao ? (
                      <span className="text-[10px] font-semibold text-forest-light/70 italic">
                        Apenas proprietários podem encerrar lotes
                      </span>
                    ) : (
                      <button
                        onClick={() => setLoteParaEncerrar(lote)}
                        className="text-[11px] font-bold text-agriAlert-red bg-agriAlert-red/10 border border-agriAlert-red/20 px-3 py-1.5 rounded-lg hover:bg-agriAlert-red hover:text-white transition-colors uppercase tracking-wider"
                      >
                        Encerrar Lote
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Lotes Inativos / Histórico */}
        <section>
          <h2 className="text-sm font-heading font-bold text-forest-dark mb-3 uppercase tracking-wider px-2">Histórico (Encerrados)</h2>
          {carregando ? null : lotesInativos.length === 0 ? (
            <div className="p-4 text-center text-forest-light font-medium text-sm">Nenhum histórico de lotes finalizados.</div>
          ) : (
            <div className="glass-panel rounded-2xl shadow-sm overflow-hidden border border-white/60">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/40 text-forest-dark font-bold text-[10px] uppercase tracking-widest border-b border-white/60">
                    <tr>
                      <th className="p-4">Linhagem</th>
                      <th className="p-4">Qtd. Inicial</th>
                      <th className="p-4">Alojamento</th>
                      <th className="p-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40">
                    {lotesInativos.map(lote => {
                      const dataAloja = lote.data_alojamento?.toDate ? lote.data_alojamento.toDate() : new Date(lote.data_alojamento);
                      return (
                        <tr key={lote.id} className="hover:bg-white/20 transition-colors">
                          <td className="p-4 font-bold">{lote.linhagem}</td>
                          <td className="p-4 text-forest-light font-semibold">{lote.quantidade_inicial?.toLocaleString('pt-BR')} aves</td>
                          <td className="p-4 text-forest-light font-semibold">{dataAloja.toLocaleDateString('pt-BR')}</td>
                          <td className="p-4 text-right">
                            <span className="inline-block bg-forest-light/10 text-forest-light text-[10px] font-bold px-2 py-1 rounded-md uppercase">Encerrado</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal de Confirmação de Encerramento */}
      {loteParaEncerrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-dark/40 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-2xl max-w-sm w-full shadow-2xl border border-white/60">
            <h3 className="text-lg font-heading font-bold text-forest-dark mb-2">Encerrar Lote?</h3>
            <p className="text-sm text-forest-light font-medium mb-6">
              Esta ação arquivará o lote de <strong>{loteParaEncerrar.linhagem}</strong>. Ele deixará de aparecer no painel principal e será movido para o histórico.
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setLoteParaEncerrar(null)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-forest-dark bg-white/50 hover:bg-white/80 transition-colors border border-white/60"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmarEncerramento}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-agriAlert-red hover:bg-red-600 shadow-[0_4px_15px_rgba(239,68,68,0.4)] transition-colors border border-red-500/20"
              >
                Sim, Encerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
