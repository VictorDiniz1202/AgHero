import { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  obterLotesAtivos,
  obterFazenda,
  obterRegistrosSanitarios,
  salvarRegistroSanitario,
  atualizarPlanoVacinalLote,
} from '../firebase/services';
import { BANCO_VACINAS } from '../data/bancoVacinas';

// ─────────────────────────────────────────────────────────────────────────
// Planos Vacinais Padrão (referência zootécnica simplificada)
// ─────────────────────────────────────────────────────────────────────────

export const VACINAS_PADRAO = {
  Corte: [
    { nome: 'Marek', idade_dias: 1, via: 'injecao' },
    { nome: 'Gumboro 1ª dose', idade_dias: 7, via: 'agua' },
    { nome: 'Newcastle + Bronquite', idade_dias: 10, via: 'spray' },
    { nome: 'Gumboro 2ª dose', idade_dias: 14, via: 'agua' },
    { nome: 'Newcastle reforço', idade_dias: 21, via: 'agua' },
  ],
  Postura: [
    { nome: 'Marek', idade_dias: 1, via: 'injecao' },
    { nome: 'Gumboro 1ª dose', idade_dias: 7, via: 'agua' },
    { nome: 'Newcastle + Bronquite', idade_dias: 10, via: 'spray' },
    { nome: 'Gumboro 2ª dose', idade_dias: 14, via: 'agua' },
    { nome: 'Bouba Aviária', idade_dias: 28, via: 'injecao' },
    { nome: 'Coriza', idade_dias: 42, via: 'injecao' },
    { nome: 'Newcastle + Bronquite (reforço)', idade_dias: 70, via: 'spray' },
  ],
};

export const SINTOMAS_CHECKLIST = [
  'Coriza',
  'Espirros / Tosse',
  'Diarreia',
  'Penas eriçadas',
  'Apatia / Letargia',
  'Queda de postura',
  'Torcicolo (Newcastle)',
  'Manqueira',
];

const VIA_LABELS = { spray: 'Spray 💨', agua: 'Água 💧', injecao: 'Injeção 💉' };

export function calcularIdadeLote(dataAlojamento) {
  if (!dataAlojamento) return 0;
  const data = dataAlojamento instanceof Timestamp ? dataAlojamento.toDate() : new Date(dataAlojamento);
  return Math.max(1, Math.floor((new Date() - data) / (1000 * 60 * 60 * 24)));
}

/**
 * Retorna a lista de itens do plano vacinal que já passaram da idade
 * programada e ainda não possuem registro de aplicação.
 */
export function obterVacinasAtrasadas(tipoProducao, idadeDias, registrosSanitarios, planoCustomizado) {
  const plano = planoCustomizado || VACINAS_PADRAO[tipoProducao] || VACINAS_PADRAO.Corte;
  return plano.filter((item) => {
    const aplicada = (registrosSanitarios || []).some(
      (r) => r.tipo === 'vacina' && r.nome === item.nome && r.status === 'aplicada'
    );
    return !appliedCheck(registrosSanitarios, item.nome) && idadeDias > item.idade_dias;
  });
}

function appliedCheck(registrosSanitarios, nomeVacina) {
  return (registrosSanitarios || []).some(
    (r) => r.tipo === 'vacina' && r.nome.toLowerCase().includes(nomeVacina.toLowerCase()) && r.status === 'aplicada'
  );
}

function dataHojeStr() {
  const d = new Date();
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export default function ManejoSanitario({ id_fazenda, onVoltar }) {
  const [lotes, setLotes] = useState(null);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState(null);
  const [tipoProducao, setTipoProducao] = useState('Corte');
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [feedback, setFeedback] = useState(null);

  const [vacinaEmEdicao, setVacinaEmEdicao] = useState(null); // item do plano sendo marcado como aplicado
  const [aplicacaoForm, setAplicacaoForm] = useState({ data: dataHojeStr(), dosagem: '', via_aplicacao: 'agua' });

  const [novaAplicacao, setNovaAplicacao] = useState({ nome: '', data: dataHojeStr(), dosagem: '', via_aplicacao: 'agua' });

  const [sintomasSelecionados, setSintomasSelecionados] = useState([]);
  const [suspeita, setSuspeita] = useState('');
  const [observacoesSintomas, setObservacoesSintomas] = useState('');

  // Busca e agendamento de vacinas
  const [buscaVacina, setBuscaVacina] = useState('');
  const [vacinaAgendadaForm, setVacinaAgendadaForm] = useState({ nome: '', idade_dias: '', via: 'agua' });

  // Carrega lotes ativos
  useEffect(() => {
    if (!id_fazenda) return undefined;
    let ativo = true;
    obterLotesAtivos(id_fazenda).then((resultado) => {
      if (!ativo) return;
      setLotes(resultado);
      setLoteSelecionadoId((atual) => atual ?? resultado[0]?.id ?? null);
      if (resultado.length === 0) setCarregando(false);
    });
    return () => { ativo = false; };
  }, [id_fazenda]);

  // Carrega tipo de produção da fazenda
  useEffect(() => {
    if (!id_fazenda) return undefined;
    let ativo = true;
    obterFazenda(id_fazenda).then((fazenda) => {
      if (!ativo) return;
      setTipoProducao(fazenda?.tipo_producao === 'Postura' ? 'Postura' : 'Corte');
    });
    return () => { ativo = false; };
  }, [id_fazenda]);

  const loteAtual = lotes?.find((l) => l.id === loteSelecionadoId);
  const idadeDias = loteAtual ? calcularIdadeLote(loteAtual.data_alojamento) : 0;

  // Inicializa o plano vacinal do lote se não houver no Firestore
  useEffect(() => {
    if (!id_fazenda || !loteSelecionadoId || !lotes || !tipoProducao) return;
    const lote = lotes.find((l) => l.id === loteSelecionadoId);
    if (lote && !lote.plano_vacinal) {
      const planoDefault = VACINAS_PADRAO[tipoProducao] || VACINAS_PADRAO.Corte;
      atualizarPlanoVacinalLote(id_fazenda, loteSelecionadoId, planoDefault)
        .then(() => {
          setLotes((prev) =>
            prev.map((l) => (l.id === loteSelecionadoId ? { ...l, plano_vacinal: planoDefault } : l))
          );
        })
        .catch((err) => console.error('[ManejoSanitario] Falha ao inicializar plano vacinal do lote:', err));
    }
  }, [id_fazenda, loteSelecionadoId, lotes, tipoProducao]);

  // Carrega registros sanitários do lote selecionado
  useEffect(() => {
    if (!id_fazenda || !loteSelecionadoId) return undefined;
    let ativo = true;
    setCarregando(true);
    obterRegistrosSanitarios(id_fazenda, loteSelecionadoId).then((resultado) => {
      if (!ativo) return;
      const ordenado = [...resultado].sort((a, b) => (b.data_str || '').localeCompare(a.data_str || ''));
      setRegistros(ordenado);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [id_fazenda, loteSelecionadoId]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const planoVacinal = loteAtual?.plano_vacinal || VACINAS_PADRAO[tipoProducao] || VACINAS_PADRAO.Corte;

  function statusVacina(item) {
    const aplicada = registros.find((r) => r.tipo === 'vacina' && r.nome.toLowerCase().includes(item.nome.toLowerCase()) && r.status === 'aplicada');
    if (aplicada) return { status: 'aplicada', registro: aplicada };
    if (idadeDias > item.idade_dias) return { status: 'atrasada' };
    if (idadeDias === item.idade_dias) return { status: 'hoje' };
    return { status: 'pendente' };
  }

  function lidarComSelecaoBanco(vacina) {
    setVacinaAgendadaForm({
      nome: vacina.nome,
      idade_dias: vacina.idade_recomendada,
      via: vacina.via,
    });
    setBuscaVacina('');
  }

  function handleAgendarVacina() {
    if (!loteSelecionadoId) {
      setFeedback({ tipo: 'erro', mensagem: 'Selecione um lote primeiro.' });
      return;
    }
    if (!vacinaAgendadaForm.nome.trim()) {
      setFeedback({ tipo: 'erro', mensagem: 'O nome da vacina é obrigatório.' });
      return;
    }
    const idadeNum = Number(vacinaAgendadaForm.idade_dias);
    if (Number.isNaN(idadeNum) || idadeNum <= 0) {
      setFeedback({ tipo: 'erro', mensagem: 'A idade planejada deve ser maior que zero.' });
      return;
    }

    const novoItem = {
      nome: vacinaAgendadaForm.nome.trim(),
      idade_dias: idadeNum,
      via: vacinaAgendadaForm.via,
    };

    const planoAtual = loteAtual?.plano_vacinal || VACINAS_PADRAO[tipoProducao] || VACINAS_PADRAO.Corte;
    const novoPlano = [...planoAtual.filter((v) => v.nome.toLowerCase() !== novoItem.nome.toLowerCase()), novoItem].sort(
      (a, b) => a.idade_dias - b.idade_dias
    );

    atualizarPlanoVacinalLote(id_fazenda, loteSelecionadoId, novoPlano)
      .then(() => {
        setLotes((prev) =>
          prev.map((l) => (l.id === loteSelecionadoId ? { ...l, plano_vacinal: novoPlano } : l))
        );
        setFeedback({ tipo: 'sucesso', mensagem: `Vacina "${novoItem.nome}" agendada com sucesso!` });
        setVacinaAgendadaForm({ nome: '', idade_dias: '', via: 'agua' });
        setBuscaVacina('');
      })
      .catch((err) => {
        console.error('[ManejoSanitario] Falha ao agendar vacina:', err);
        setFeedback({ tipo: 'erro', mensagem: 'Não foi possível agendar a vacina.' });
      });
  }

  function handleRemoverVacina(nomeVacina) {
    if (!loteSelecionadoId) return;
    const planoAtual = loteAtual?.plano_vacinal || VACINAS_PADRAO[tipoProducao] || VACINAS_PADRAO.Corte;
    const novoPlano = planoAtual.filter((v) => v.nome.toLowerCase() !== nomeVacina.toLowerCase());

    atualizarPlanoVacinalLote(id_fazenda, loteSelecionadoId, novoPlano)
      .then(() => {
        setLotes((prev) =>
          prev.map((l) => (l.id === loteSelecionadoId ? { ...l, plano_vacinal: novoPlano } : l))
        );
        setFeedback({ tipo: 'sucesso', mensagem: 'Vacina removida do cronograma.' });
      })
      .catch((err) => {
        console.error('[ManejoSanitario] Falha ao remover vacina:', err);
        setFeedback({ tipo: 'erro', mensagem: 'Não foi possível remover a vacina.' });
      });
  }

  function adicionarRegistroLocal(registro) {
    setRegistros((atual) => {
      const semDuplicado = atual.filter((r) => r.id !== registro.id);
      return [registro, ...semDuplicado].sort((a, b) => (b.data_str || '').localeCompare(a.data_str || ''));
    });
  }

  function confirmarAplicacaoPlanejada(item) {
    if (!loteSelecionadoId) return;
    const [ano, mes, dia] = aplicacaoForm.data.split('-').map(Number);
    const dataObj = new Date(ano, mes - 1, dia, 12, 0, 0);

    const dados = {
      tipo: 'vacina',
      nome: item.nome,
      data: Timestamp.fromDate(dataObj),
      data_str: aplicacaoForm.data,
      dosagem: aplicacaoForm.dosagem,
      via_aplicacao: aplicacaoForm.via_aplicacao,
      status: 'aplicada',
      idade_programada_dias: item.idade_dias,
      idade_aplicacao_dias: idadeDias,
    };

    salvarRegistroSanitario(id_fazenda, loteSelecionadoId, dados)
      .then((registro) => adicionarRegistroLocal(registro))
      .catch((erro) => console.error('[ManejoSanitario] Falha ao registrar vacina:', erro));

    setVacinaEmEdicao(null);
    setAplicacaoForm({ data: dataHojeStr(), dosagem: '', via_aplicacao: 'agua' });
    setFeedback({ tipo: 'sucesso', mensagem: `${item.nome} registrada como aplicada!` });
  }

  function handleSalvarAplicacaoExtra() {
    if (!loteSelecionadoId) {
      setFeedback({ tipo: 'erro', mensagem: 'Selecione um lote antes de salvar.' });
      return;
    }
    if (!novaAplicacao.nome.trim()) {
      setFeedback({ tipo: 'erro', mensagem: 'Informe o nome da vacina ou medicamento.' });
      return;
    }

    const [ano, mes, dia] = novaAplicacao.data.split('-').map(Number);
    const dataObj = new Date(ano, mes - 1, dia, 12, 0, 0);

    const dados = {
      tipo: 'vacina',
      nome: novaAplicacao.nome.trim(),
      data: Timestamp.fromDate(dataObj),
      data_str: novaAplicacao.data,
      dosagem: novaAplicacao.dosagem,
      via_aplicacao: novaAplicacao.via_aplicacao,
      status: 'aplicada',
      idade_aplicacao_dias: idadeDias,
    };

    salvarRegistroSanitario(id_fazenda, loteSelecionadoId, dados)
      .then((registro) => adicionarRegistroLocal(registro))
      .catch((erro) => console.error('[ManejoSanitario] Falha ao registrar aplicação extra:', erro));

    setNovaAplicacao({ nome: '', data: dataHojeStr(), dosagem: '', via_aplicacao: 'agua' });
    setFeedback({ tipo: 'sucesso', mensagem: 'Aplicação registrada com sucesso!' });
  }

  function alternarSintoma(sintoma) {
    setSintomasSelecionados((atual) =>
      atual.includes(sintoma) ? atual.filter((s) => s !== sintoma) : [...atual, sintoma]
    );
  }

  function handleSalvarSintomas() {
    if (!loteSelecionadoId) {
      setFeedback({ tipo: 'erro', mensagem: 'Selecione um lote antes de salvar.' });
      return;
    }
    if (sintomasSelecionados.length === 0 && !suspeita.trim() && !observacoesSintomas.trim()) {
      setFeedback({ tipo: 'erro', mensagem: 'Selecione ao menos um sintoma ou descreva a observação.' });
      return;
    }

    const hojeStr = dataHojeStr();
    const dados = {
      tipo: 'sintoma',
      nome: sintomasSelecionados[0] || suspeita.trim() || 'Observação Sanitária',
      data: Timestamp.fromDate(new Date()),
      data_str: hojeStr,
      sintomas: sintomasSelecionados,
      suspeita_doenca: suspeita.trim(),
      observacoes: observacoesSintomas.trim(),
    };

    salvarRegistroSanitario(id_fazenda, loteSelecionadoId, dados)
      .then((registro) => adicionarRegistroLocal(registro))
      .catch((erro) => console.error('[ManejoSanitario] Falha ao registrar sintomas:', erro));

    setSintomasSelecionados([]);
    setSuspeita('');
    setObservacoesSintomas('');
    setFeedback({ tipo: 'sucesso', mensagem: 'Checklist sanitário registrado!' });
  }

  if (lotes === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-offwhite text-forest-dark">
        <p className="text-sm font-bold animate-pulse">Carregando manejo sanitário...</p>
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-offwhite text-forest-dark">
        <header className="flex items-center gap-3 px-5 py-5 glass-panel rounded-none border-t-0 border-x-0 border-white/60 bg-offwhite/50 shadow-sm backdrop-blur-xl">
          <button onClick={onVoltar} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-forest-dark shadow-sm border border-white hover:border-vivid-emerald/50 hover:text-vivid-emerald transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-heading font-bold">Manejo Sanitário</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-forest-light/10 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">💉</span>
          </div>
          <h2 className="text-lg font-heading font-bold text-forest-dark mb-2">Nenhum lote ativo</h2>
          <p className="text-sm text-forest-light font-medium max-w-xs">Crie e aloje um lote para começar a registrar vacinas, medicamentos e sintomas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col text-forest-dark relative z-10 bg-offwhite/30">
      {/* HEADER */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-5 py-5 glass-panel rounded-none border-t-0 border-x-0 border-white/60 bg-offwhite/50 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={onVoltar} aria-label="Voltar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-forest-dark shadow-sm border border-white hover:border-vivid-emerald/50 hover:text-vivid-emerald transition-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl font-heading font-bold text-forest-dark tracking-tight leading-none">Manejo Sanitário</h1>
            <p className="text-xs font-semibold text-forest-light/80 mt-1 uppercase tracking-wider">Vacinas, medicamentos e sintomas</p>
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-6 px-5 py-6 pb-12 relative z-10">
        {feedback && <Banner tipo={feedback.tipo} mensagem={feedback.mensagem} />}

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
                  {lote.linhagem} <span className="ml-2 text-[10px] opacity-70">{calcularIdadeLote(lote.data_alojamento)}d</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Plano Vacinal */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm border border-white/60">
          <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="text-lg">💉</span> Plano Vacinal ({tipoProducao})
          </h2>
          <div className="space-y-2.5">
            {planoVacinal.map((item) => {
              const { status, registro } = statusVacina(item);
              const isEditing = vacinaEmEdicao?.nome === item.nome;
              return (
                <div key={item.nome} className="rounded-xl border border-white/60 bg-white/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-forest-dark">{item.nome}</p>
                      <p className="text-[10px] font-semibold text-forest-light uppercase tracking-wider mt-0.5">
                        Programada: dia {item.idade_dias} • {VIA_LABELS[item.via]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {status === 'aplicada' ? (
                        <span className="text-[10px] font-bold text-agriAlert-green bg-agriAlert-green/10 border border-agriAlert-green/20 px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                          ✓ Aplicada {registro?.data_str ? `(${registro.data_str.split('-').reverse().join('/')})` : ''}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {status === 'atrasada' ? (
                            <span className="text-[10px] font-bold text-agriAlert-red bg-agriAlert-red/10 border border-agriAlert-red/20 px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse whitespace-nowrap">
                              Atrasada
                            </span>
                          ) : status === 'hoje' ? (
                            <span className="text-[10px] font-bold text-agriAlert-orange bg-agriAlert-orange/10 border border-agriAlert-orange/20 px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                              Hoje
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-forest-light bg-white/50 border border-white/60 px-2.5 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                              Pendente
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoverVacina(item.nome)}
                            title="Remover do plano"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-agriAlert-red hover:bg-agriAlert-red/10 border border-transparent hover:border-agriAlert-red/20 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {status !== 'aplicada' && (
                    <div className="mt-2.5">
                      {isEditing ? (
                        <div className="space-y-2 bg-white/60 rounded-xl p-3 border border-vivid-emerald/30">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Data</label>
                              <input
                                type="date"
                                value={aplicacaoForm.data}
                                onChange={(e) => setAplicacaoForm((a) => ({ ...a, data: e.target.value }))}
                                className="w-full rounded-lg border border-white/50 bg-white/80 p-2 text-xs font-semibold text-forest-dark focus:outline-none focus:ring-1 focus:ring-vivid-emerald/50"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Via</label>
                              <select
                                value={aplicacaoForm.via_aplicacao}
                                onChange={(e) => setAplicacaoForm((a) => ({ ...a, via_aplicacao: e.target.value }))}
                                className="w-full rounded-lg border border-white/50 bg-white/80 p-2 text-xs font-semibold text-forest-dark focus:outline-none focus:ring-1 focus:ring-vivid-emerald/50"
                              >
                                <option value="agua">Água 💧</option>
                                <option value="spray">Spray 💨</option>
                                <option value="injecao">Injeção 💉</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Dosagem</label>
                            <input
                              type="text"
                              placeholder="Ex: 1 dose/ave"
                              value={aplicacaoForm.dosagem}
                              onChange={(e) => setAplicacaoForm((a) => ({ ...a, dosagem: e.target.value }))}
                              className="w-full rounded-lg border border-white/50 bg-white/80 p-2 text-xs font-semibold text-forest-dark focus:outline-none focus:ring-1 focus:ring-vivid-emerald/50 placeholder:text-forest-light/50"
                            />
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <button
                              onClick={() => setVacinaEmEdicao(null)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-forest-dark bg-white/60 hover:bg-white border border-white/60 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => confirmarAplicacaoPlanejada(item)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-vivid-emerald to-vivid-lime shadow-sm active:scale-95 transition-transform"
                            >
                              Confirmar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setVacinaEmEdicao(item);
                            setAplicacaoForm({ data: dataHojeStr(), dosagem: '', via_aplicacao: item.via });
                          }}
                          className="text-[11px] font-bold text-vivid-emerald uppercase tracking-wider hover:underline"
                        >
                          Marcar como aplicada
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Agendar Nova Vacina */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm border border-white/60">
          <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="text-lg">📅</span> Agendar Nova Vacina
          </h2>
          <div className="space-y-3">
            {/* Campo de Busca no Banco */}
            <div className="relative">
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Buscar no Banco de Vacinas</label>
              <input
                type="text"
                placeholder="Pesquisar por nome ou doença..."
                value={buscaVacina}
                onChange={(e) => setBuscaVacina(e.target.value)}
                className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 placeholder:text-forest-light/50"
              />
              
              {/* Resultados da busca */}
              {buscaVacina.trim() !== '' && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-white/60 bg-white/95 p-2 shadow-xl backdrop-blur-xl">
                  {BANCO_VACINAS.filter(v => 
                    v.nome.toLowerCase().includes(buscaVacina.toLowerCase()) ||
                    v.doenca.toLowerCase().includes(buscaVacina.toLowerCase())
                  ).length === 0 ? (
                    <p className="text-xs font-semibold text-forest-light p-3 text-center">Nenhuma vacina encontrada. Digite abaixo para cadastrar uma personalizada.</p>
                  ) : (
                    BANCO_VACINAS.filter(v => 
                      v.nome.toLowerCase().includes(buscaVacina.toLowerCase()) ||
                      v.doenca.toLowerCase().includes(buscaVacina.toLowerCase())
                    ).map(v => (
                      <button
                        key={v.nome}
                        type="button"
                        onClick={() => lidarComSelecaoBanco(v)}
                        className="w-full text-left p-2.5 rounded-lg hover:bg-forest-light/10 active:bg-forest-light/20 transition-colors border-b border-forest-light/5 last:border-b-0"
                      >
                        <p className="text-xs font-bold text-forest-dark">{v.nome}</p>
                        <p className="text-[10px] font-semibold text-forest-light/80 mt-0.5">{v.doenca} · Recomendado: dia {v.idade_recomendada}</p>
                        <p className="text-[9px] text-forest-light font-medium mt-0.5 line-clamp-1">{v.descricao}</p>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Formulário de Agendamento */}
            <div className="rounded-xl border border-white/50 bg-white/40 p-3.5 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block font-heading">Nome da Vacina</label>
                <input
                  type="text"
                  placeholder="Nome da vacina..."
                  value={vacinaAgendadaForm.nome}
                  onChange={(e) => setVacinaAgendadaForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full rounded-xl border border-white/50 bg-white/60 p-2.5 text-xs font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block font-heading">Idade (dias)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 7"
                    value={vacinaAgendadaForm.idade_dias}
                    onChange={(e) => setVacinaAgendadaForm(prev => ({ ...prev, idade_dias: e.target.value }))}
                    className="w-full rounded-xl border border-white/50 bg-white/60 p-2.5 text-xs font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block font-heading">Via</label>
                  <select
                    value={vacinaAgendadaForm.via}
                    onChange={(e) => setVacinaAgendadaForm(prev => ({ ...prev, via: e.target.value }))}
                    className="w-full rounded-xl border border-white/50 bg-white/60 p-2.5 text-xs font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50"
                  >
                    <option value="agua">Água 💧</option>
                    <option value="spray">Spray 💨</option>
                    <option value="injecao">Injeção 💉</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAgendarVacina}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-xs font-bold text-white shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all"
              >
                Adicionar ao Plano Vacinal
              </button>
            </div>
          </div>
        </section>

        {/* Aplicação Extra */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm border border-white/60">
          <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="text-lg">💊</span> Registrar Aplicação Extra
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Nome (vacina ou medicamento)</label>
              <input
                type="text"
                placeholder="Ex: Vitamina ADE, Antibiótico..."
                value={novaAplicacao.nome}
                onChange={(e) => setNovaAplicacao((a) => ({ ...a, nome: e.target.value }))}
                className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 placeholder:text-forest-light/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Data</label>
                <input
                  type="date"
                  value={novaAplicacao.data}
                  onChange={(e) => setNovaAplicacao((a) => ({ ...a, data: e.target.value }))}
                  className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Via de Aplicação</label>
                <select
                  value={novaAplicacao.via_aplicacao}
                  onChange={(e) => setNovaAplicacao((a) => ({ ...a, via_aplicacao: e.target.value }))}
                  className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 appearance-none"
                >
                  <option value="agua">Água 💧</option>
                  <option value="spray">Spray 💨</option>
                  <option value="injecao">Injeção 💉</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Dosagem</label>
              <input
                type="text"
                placeholder="Ex: 5ml por litro de água"
                value={novaAplicacao.dosagem}
                onChange={(e) => setNovaAplicacao((a) => ({ ...a, dosagem: e.target.value }))}
                className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 placeholder:text-forest-light/50"
              />
            </div>
            <button
              onClick={handleSalvarAplicacaoExtra}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] active:scale-[0.98] hover:scale-[1.01] transition-transform"
            >
              Salvar Aplicação
            </button>
          </div>
        </section>

        {/* Checklist de Sintomas */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm border border-white/60">
          <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="text-lg">🩺</span> Checklist de Sintomas
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {SINTOMAS_CHECKLIST.map((sintoma) => {
              const ativo = sintomasSelecionados.includes(sintoma);
              return (
                <button
                  key={sintoma}
                  onClick={() => alternarSintoma(sintoma)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    ativo
                      ? 'bg-agriAlert-orange/15 border-agriAlert-orange/40 text-agriAlert-orange'
                      : 'bg-white/40 border-white/60 text-forest-light hover:border-agriAlert-orange/30'
                  }`}
                >
                  {sintoma}
                </button>
              );
            })}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Suspeita de Doença (opcional)</label>
              <input
                type="text"
                placeholder="Ex: Coriza Infecciosa, Newcastle..."
                value={suspeita}
                onChange={(e) => setSuspeita(e.target.value)}
                className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 placeholder:text-forest-light/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Observações</label>
              <textarea
                rows={3}
                placeholder="Detalhe o que foi observado no lote..."
                value={observacoesSintomas}
                onChange={(e) => setObservacoesSintomas(e.target.value)}
                className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-medium text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 placeholder:text-forest-light/50 resize-none"
              />
            </div>
            <button
              onClick={handleSalvarSintomas}
              className="w-full py-3 rounded-xl bg-agriAlert-orange text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(245,158,11,0.5)] active:scale-[0.98] hover:scale-[1.01] transition-transform"
            >
              Registrar Observação Sanitária
            </button>
          </div>
        </section>

        {/* Histórico Recente */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm border border-white/60">
          <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide mb-3 flex items-center gap-2">
            <span className="text-lg">📋</span> Histórico Recente
          </h2>
          {carregando ? (
            <p className="text-sm font-medium text-forest-light">Carregando...</p>
          ) : registros.length === 0 ? (
            <p className="text-sm font-medium text-forest-light text-center py-4">Nenhum registro sanitário ainda.</p>
          ) : (
            <div className="space-y-2">
              {registros.slice(0, 10).map((r) => (
                <div key={r.id} className="flex items-start gap-3 rounded-xl border border-white/60 bg-white/40 p-3">
                  <span className="text-lg shrink-0">{r.tipo === 'vacina' ? '💉' : '🩺'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-forest-dark truncate">{r.nome}</p>
                      <span className="text-[10px] font-semibold text-forest-light uppercase tracking-wider shrink-0">
                        {r.data_str ? r.data_str.split('-').reverse().join('/') : ''}
                      </span>
                    </div>
                    {r.tipo === 'vacina' ? (
                      <p className="text-[11px] text-forest-light font-medium mt-0.5">
                        {r.dosagem ? `${r.dosagem} • ` : ''}{VIA_LABELS[r.via_aplicacao] || r.via_aplicacao}
                      </p>
                    ) : (
                      <>
                        {r.sintomas?.length > 0 && (
                          <p className="text-[11px] text-forest-light font-medium mt-0.5">{r.sintomas.join(', ')}</p>
                        )}
                        {r.suspeita_doenca && (
                          <p className="text-[11px] text-agriAlert-orange font-bold mt-0.5">Suspeita: {r.suspeita_doenca}</p>
                        )}
                        {r.observacoes && (
                          <p className="text-[11px] text-forest-dark/70 font-medium mt-0.5">{r.observacoes}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Banner({ tipo, mensagem }) {
  const estilos =
    tipo === 'sucesso'
      ? 'border-agriAlert-green/30 bg-agriAlert-green/10 text-agriAlert-green shadow-[0_4px_20px_-5px_rgba(16,185,129,0.2)]'
      : 'border-agriAlert-red/30 bg-agriAlert-red/10 text-agriAlert-red shadow-[0_4px_20px_-5px_rgba(239,68,68,0.2)]';

  return (
    <div role="status" className={`rounded-xl border backdrop-blur-md px-4 py-3.5 text-sm font-bold flex items-center gap-3 ${estilos}`}>
      <span className="text-xl">{tipo === 'sucesso' ? '✨' : '⚠️'}</span>
      {mensagem}
    </div>
  );
}
