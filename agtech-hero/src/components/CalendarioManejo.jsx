import { useEffect, useState } from 'react';
import { obterLotesAtivos, obterUltimosRegistros } from '../firebase/services';
import SidebarMenu from './SidebarMenu';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function formatarDataStr(ano, mes, dia) {
  const m = String(mes + 1).padStart(2, '0');
  const d = String(dia).padStart(2, '0');
  return `${ano}-${m}-${d}`;
}

function dataRegistroStr(data) {
  return formatarDataStr(data.getFullYear(), data.getMonth(), data.getDate());
}



// --- Topbar superior, espelhando o DashboardReal ---
function Topbar({ setMenuAberto }) {
  return (
    <header className="flex items-center gap-4 px-4 lg:px-8 py-4 lg:py-5 bg-white/30 backdrop-blur-md border-b border-white/50 z-30">
      <button className="lg:hidden p-2 -ml-2 text-forest-dark hover:bg-white/50 rounded-xl" onClick={() => setMenuAberto(true)}>
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      <div>
        <h1 className="text-lg lg:text-xl font-heading font-bold text-forest-dark tracking-tight leading-none">Calendário</h1>
        <p className="text-[10px] sm:text-xs font-semibold text-forest-light/80 mt-1 uppercase tracking-wider">Auditoria Diária</p>
      </div>
    </header>
  );
}

export default function CalendarioManejo({
  id_fazenda,
  papelUsuario,
  onVoltar,
  onLancarRetroativo,
  onAbrirFormulario,
  onAbrirBI,
  onAbrirNutricao,
  onAbrirAgua,
  onAbrirFinanceiro,
  onAbrirRelatorios,
  onAbrirImportador
}) {
  const [dataAtual, setDataAtual] = useState(new Date());
  const [lotes, setLotes] = useState(null);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [diaSelecionado, setDiaSelecionado] = useState(null); // { diaStr, registro, status, isFuturo }
  const [menuAberto, setMenuAberto] = useState(false);

  // Carregar lotes
  useEffect(() => {
    if (!id_fazenda) return;
    let ativo = true;
    obterLotesAtivos(id_fazenda).then((resultado) => {
      if (!ativo) return;
      setLotes(resultado);
      setLoteSelecionadoId((atual) => atual ?? resultado[0]?.id ?? null);
    });
    return () => { ativo = false; };
  }, [id_fazenda]);

  // Carregar registros do lote selecionado
  useEffect(() => {
    if (!id_fazenda || !loteSelecionadoId) return;
    let ativo = true;
    // Buscamos um número generoso de registros para cobrir o mês
    obterUltimosRegistros(id_fazenda, 300).then((resultado) => {
      if (!ativo) return;
      const registrosDoLote = resultado.filter((r) => r.id_lote === loteSelecionadoId);
      setRegistros(registrosDoLote);
    });
    return () => { ativo = false; };
  }, [id_fazenda, loteSelecionadoId]);

  const loteAtual = lotes?.find((l) => l.id === loteSelecionadoId);
  const aptidao = loteAtual?.aptidao || 'corte';

  const ano = dataAtual.getFullYear();
  const mes = dataAtual.getMonth();
  const hoje = new Date();
  const hojeStr = dataRegistroStr(hoje);

  const primeiroDiaDoMes = new Date(ano, mes, 1);
  const ultimoDiaDoMes = new Date(ano, mes + 1, 0);
  const diaSemanaInicio = primeiroDiaDoMes.getDay();
  const totalDias = ultimoDiaDoMes.getDate();

  const dias = [];
  // Slots vazios no início
  for (let i = 0; i < diaSemanaInicio; i++) {
    dias.push({ vazio: true, key: `vazio-inicio-${i}` });
  }

  // Dias do mês
  for (let d = 1; d <= totalDias; d++) {
    const diaStr = formatarDataStr(ano, mes, d);
    const registro = registros.find((r) => r.data_registro_str === diaStr);

    let status = 'ausente'; // padrão (Vermelho) se no passado
    const isFuturo = diaStr > hojeStr;
    const isHoje = diaStr === hojeStr;

    if (isFuturo) {
      status = 'neutro'; // Futuro
    } else if (registro) {
      const temAgua = typeof registro.agua_litros === 'number' && registro.agua_litros > 0;
      const temRacao = typeof registro.racao_kg === 'number' && registro.racao_kg > 0;
      const temMort = typeof registro.mortalidade_qtd === 'number' && registro.mortalidade_qtd >= 0;
      const temOvos = typeof registro.producao_ovos_qtd === 'number';

      let completo = temAgua && temRacao && temMort;
      if (aptidao === 'postura') {
        completo = completo && temOvos;
      }

      status = completo ? 'conforme' : 'parcial';
    } else {
      status = 'ausente'; // Vermelho
    }

    dias.push({ vazio: false, dia: d, diaStr, registro, status, isFuturo, isHoje, key: `dia-${d}` });
  }

  function mudarMes(delta) {
    setDataAtual(new Date(ano, mes + delta, 1));
  }

  // --- Renderização ---

  if (lotes === null) {
    return (
      <div className="flex h-full w-full bg-offwhite text-forest-dark relative z-10 overflow-hidden font-sans">
        <SidebarMenu
          menuAberto={menuAberto}
          setMenuAberto={setMenuAberto}
          telaAtiva="calendario"
          papelUsuario={papelUsuario}
          onSair={onVoltar}
          onAbrirDashboard={onVoltar}
          onAbrirFormulario={onAbrirFormulario}
          onAbrirBI={onAbrirBI}
          onAbrirNutricao={onAbrirNutricao}
          onAbrirAgua={onAbrirAgua}
          onAbrirFinanceiro={onAbrirFinanceiro}
          onAbrirRelatorios={onAbrirRelatorios}
          onAbrirImportador={onAbrirImportador}
        />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/20">
          <Topbar setMenuAberto={setMenuAberto} />
          <main className="flex-1 flex items-center justify-center">
            <p className="text-sm font-bold text-forest-dark animate-pulse">Carregando calendário...</p>
          </main>
        </div>
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div className="flex h-full w-full bg-offwhite text-forest-dark relative z-10 overflow-hidden font-sans">
        <SidebarMenu
          menuAberto={menuAberto}
          setMenuAberto={setMenuAberto}
          telaAtiva="calendario"
          papelUsuario={papelUsuario}
          onSair={onVoltar}
          onAbrirDashboard={onVoltar}
          onAbrirFormulario={onAbrirFormulario}
          onAbrirBI={onAbrirBI}
          onAbrirNutricao={onAbrirNutricao}
          onAbrirAgua={onAbrirAgua}
          onAbrirFinanceiro={onAbrirFinanceiro}
          onAbrirRelatorios={onAbrirRelatorios}
          onAbrirImportador={onAbrirImportador}
        />
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/20">
          <Topbar setMenuAberto={setMenuAberto} />
          <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-forest-light/10 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-lg font-heading font-bold text-forest-dark mb-2">Nenhum lote ativo</h2>
            <p className="text-sm text-forest-light font-medium max-w-xs">Você precisa criar e ativar um lote para acompanhar o calendário de conformidade diária.</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-offwhite text-forest-dark relative z-10 overflow-hidden font-sans">
      <SidebarMenu
        menuAberto={menuAberto}
        setMenuAberto={setMenuAberto}
        telaAtiva="calendario"
        papelUsuario={papelUsuario}
        onSair={onVoltar}
        onAbrirDashboard={onVoltar}
        onAbrirFormulario={onAbrirFormulario}
        onAbrirBI={onAbrirBI}
        onAbrirNutricao={onAbrirNutricao}
        onAbrirAgua={onAbrirAgua}
        onAbrirFinanceiro={onAbrirFinanceiro}
        onAbrirRelatorios={onAbrirRelatorios}
        onAbrirImportador={onAbrirImportador}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/20">
        <Topbar setMenuAberto={setMenuAberto} />

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto w-full max-w-md space-y-6 pb-12">

            {/* Lote Selector */}
            <section>
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                {lotes.map((lote) => {
                  const selecionado = lote.id === loteSelecionadoId;
                  return (
                    <button
                      key={lote.id}
                      onClick={() => setLoteSelecionadoId(lote.id)}
                      className={`flex h-12 px-5 shrink-0 items-center justify-center rounded-2xl border transition-all duration-200 shadow-sm ${
                        selecionado
                          ? 'border-transparent bg-gradient-to-r from-vivid-emerald to-vivid-teal text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] scale-[1.02] font-bold'
                          : 'glass-panel text-forest-dark hover:border-vivid-emerald/40 font-semibold'
                      }`}
                    >
                      {lote.linhagem}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Mês e Navegação */}
            <section className="glass-panel p-4 rounded-[2rem] shadow-sm border border-white/60">
              <div className="flex items-center justify-between mb-6 px-2">
                <button onClick={() => mudarMes(-1)} className="p-2 rounded-xl text-forest-light hover:bg-white/60 hover:text-forest-dark transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <h2 className="text-base font-heading font-bold text-forest-dark uppercase tracking-widest">
                  {MESES[mes]} <span className="text-forest-light/60">{ano}</span>
                </h2>
                <button onClick={() => mudarMes(1)} className="p-2 rounded-xl text-forest-light hover:bg-white/60 hover:text-forest-dark transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>

              {/* Grade do Calendário */}
              <div>
                <div className="grid grid-cols-7 gap-2 mb-3">
                  {DIAS_SEMANA.map(ds => (
                    <div key={ds} className="text-center text-[10px] font-bold text-forest-light uppercase tracking-wider">{ds}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {dias.map((d) => {
                    if (d.vazio) {
                      return <div key={d.key} className="h-10"></div>;
                    }

                    let colorClasses = '';
                    if (d.status === 'conforme') {
                      colorClasses = 'bg-agriAlert-green/10 text-agriAlert-green border-agriAlert-green/30 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.3)] hover:bg-agriAlert-green/20';
                    } else if (d.status === 'parcial') {
                      colorClasses = 'bg-agriAlert-orange/10 text-agriAlert-orange border-agriAlert-orange/30 shadow-[0_2px_8px_-2px_rgba(245,158,11,0.3)] hover:bg-agriAlert-orange/20';
                    } else if (d.status === 'ausente') {
                      colorClasses = 'bg-agriAlert-red/10 text-agriAlert-red border-agriAlert-red/30 shadow-[0_2px_8px_-2px_rgba(239,68,68,0.3)] hover:bg-agriAlert-red/20';
                    } else {
                      // Neutro/Futuro
                      colorClasses = 'bg-white/40 text-forest-light/40 border-white/40 opacity-60 pointer-events-none';
                    }

                    if (d.isHoje && d.status !== 'neutro') {
                      colorClasses += ' ring-2 ring-forest-dark ring-offset-2 ring-offset-offwhite';
                    }

                    return (
                      <button
                        key={d.key}
                        onClick={() => setDiaSelecionado(d)}
                        disabled={d.status === 'neutro'}
                        className={`h-11 w-full rounded-xl border flex items-center justify-center text-sm font-bold transition-all active:scale-95 ${colorClasses}`}
                      >
                        {d.dia}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legenda */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 border-t border-forest-light/10 pt-4">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-agriAlert-green shadow-sm"></span><span className="text-[9px] font-bold text-forest-light uppercase">Conforme</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-agriAlert-orange shadow-sm"></span><span className="text-[9px] font-bold text-forest-light uppercase">Parcial</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-agriAlert-red shadow-sm"></span><span className="text-[9px] font-bold text-forest-light uppercase">Ausente</span></div>
              </div>
            </section>

          </div>
        </main>
      </div>

      {/* MODAL / GAVETA DE DETALHES */}
      {diaSelecionado && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forest-dark/40 backdrop-blur-sm transition-opacity p-0 sm:p-4">
          <div className="w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden animate-slideUp sm:animate-fadeIn border border-white/60">
            <div className="px-6 py-5 border-b border-forest-light/10 flex items-center justify-between bg-white/50">
              <div>
                <h3 className="text-lg font-heading font-bold text-forest-dark">Manejo Diário</h3>
                <p className="text-xs font-semibold text-forest-light uppercase tracking-wider mt-0.5">
                  {diaSelecionado.diaStr.split('-').reverse().join('/')}
                </p>
              </div>
              <button onClick={() => setDiaSelecionado(null)} className="p-2 rounded-full bg-forest-light/10 text-forest-dark hover:bg-forest-light/20 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-5">
              {diaSelecionado.status === 'ausente' ? (
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-agriAlert-red/10 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <h4 className="text-sm font-bold text-agriAlert-red uppercase tracking-wider mb-2">Sem Registro</h4>
                  <p className="text-xs text-forest-light font-medium mb-6">Não houve lançamento de dados zootécnicos neste dia.</p>
                  <button
                    onClick={() => {
                      if (onLancarRetroativo) {
                        onLancarRetroativo(diaSelecionado.diaStr);
                      } else {
                        alert("Redirecionando para Formulário com data retroativa: " + diaSelecionado.diaStr);
                      }
                      setDiaSelecionado(null);
                    }}
                    className="w-full py-3.5 rounded-xl bg-agriAlert-red text-white font-bold text-sm shadow-[0_4px_15px_-3px_rgba(239,68,68,0.4)] hover:bg-red-600 transition-colors"
                  >
                    Lançar Manejo Retroativo
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-panel p-3 rounded-xl border border-white/60 shadow-sm bg-white/40">
                      <p className="text-[9px] font-bold text-forest-light uppercase tracking-wider mb-1">Água</p>
                      <p className={`text-lg font-heading font-bold ${!diaSelecionado.registro.agua_litros ? 'text-agriAlert-orange' : 'text-forest-dark'}`}>
                        {diaSelecionado.registro.agua_litros || 0} <span className="text-xs font-semibold text-forest-light">L</span>
                      </p>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-white/60 shadow-sm bg-white/40">
                      <p className="text-[9px] font-bold text-forest-light uppercase tracking-wider mb-1">Ração</p>
                      <p className={`text-lg font-heading font-bold ${!diaSelecionado.registro.racao_kg ? 'text-agriAlert-orange' : 'text-forest-dark'}`}>
                        {diaSelecionado.registro.racao_kg || 0} <span className="text-xs font-semibold text-forest-light">kg</span>
                      </p>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-white/60 shadow-sm bg-white/40">
                      <p className="text-[9px] font-bold text-forest-light uppercase tracking-wider mb-1">Mortalidade</p>
                      <p className="text-lg font-heading font-bold text-forest-dark">
                        {typeof diaSelecionado.registro.mortalidade_qtd === 'number' ? diaSelecionado.registro.mortalidade_qtd : '-'} <span className="text-xs font-semibold text-forest-light">aves</span>
                      </p>
                    </div>
                    <div className="glass-panel p-3 rounded-xl border border-white/60 shadow-sm bg-white/40">
                      <p className="text-[9px] font-bold text-forest-light uppercase tracking-wider mb-1">Clima (Min/Máx)</p>
                      <p className="text-sm font-heading font-bold text-forest-dark mt-1.5">
                        {diaSelecionado.registro.temp_min || '-'}° / {diaSelecionado.registro.temp_max || '-'}°
                      </p>
                    </div>
                    {aptidao === 'postura' && (
                      <div className="glass-panel p-3 rounded-xl border border-white/60 shadow-sm bg-white/40 col-span-2">
                        <p className="text-[9px] font-bold text-forest-light uppercase tracking-wider mb-1">Postura (Ovos)</p>
                        <p className={`text-lg font-heading font-bold ${typeof diaSelecionado.registro.producao_ovos_qtd !== 'number' ? 'text-agriAlert-orange' : 'text-forest-dark'}`}>
                          {typeof diaSelecionado.registro.producao_ovos_qtd === 'number' ? diaSelecionado.registro.producao_ovos_qtd.toLocaleString('pt-BR') : '-'} <span className="text-xs font-semibold text-forest-light">ovos</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Observações / Manejo Sanitário */}
                  {diaSelecionado.registro.observacoes && (
                    <div className="p-4 rounded-xl bg-forest-light/5 border border-forest-light/10">
                      <p className="text-[10px] font-bold text-forest-dark uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <span className="text-sm">📝</span> Observações
                      </p>
                      <p className="text-sm text-forest-dark/80 font-medium leading-relaxed">
                        {diaSelecionado.registro.observacoes}
                      </p>

                      {diaSelecionado.registro.observacoes.toLowerCase().includes('vacina') && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-vivid-emerald/10 border border-vivid-emerald/20 text-[10px] font-bold text-vivid-emerald uppercase tracking-wider">
                          <span>💉</span> Manejo Sanitário Detectado
                        </div>
                      )}
                    </div>
                  )}

                  {diaSelecionado.status === 'parcial' && (
                    <div className="p-3 rounded-xl bg-agriAlert-orange/10 border border-agriAlert-orange/20 flex gap-3 items-start">
                      <span className="text-lg">⚠️</span>
                      <div>
                        <p className="text-xs font-bold text-agriAlert-orange uppercase tracking-wider mb-0.5">Lançamento Parcial</p>
                        <p className="text-[11px] text-agriAlert-orange/80 font-medium">
                          {aptidao === 'postura'
                            ? 'Algum indicador principal (água, ração ou produção de ovos) está zerado ou ausente neste dia.'
                            : 'Algum indicador principal (água ou ração) está zerado neste dia.'}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-fadeIn { animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
