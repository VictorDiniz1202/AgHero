/**
 * src/components/FormularioManejo.jsx
 *
 * Tela de "Lançamento de Manejo Diário" adaptada para Premium Glassmorphism.
 */

import { useEffect, useRef, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  onSnapshotsInSync,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { obterFazenda, obterLotesAtivos, salvarRegistroDiario } from '../firebase/services';
import { calcularIdadeDias } from '../utils/motorAlertas';
import { calcularITU, obterPrevisaoClimatica } from '../utils/climaPreditivo';
import { useConectividade } from '../hooks/useConectividade';

const VALORES_INICIAIS = {
  agua_litros: 0,
  racao_kg: 0,
  mortalidade_qtd: 0,
  temp_max: '',
  temp_min: '',
  umidade_relativa: '',
  peso_medio_g: 0,
  producao_ovos_qtd: 0,
  ovos_descarte_qtd: 0,
  observacoes: '',
};

function dataRegistroStr(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export default function FormularioManejo({ id_fazenda, onVoltar, dataRetroativaStr }) {
  let dataUsar = new Date();
  if (dataRetroativaStr) {
    const [ano, mes, dia] = dataRetroativaStr.split('-').map(Number);
    dataUsar = new Date(ano, mes - 1, dia, 12, 0, 0);
  }

  const { isOffline } = useConectividade();
  const [lotes, setLotes] = useState(null);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState(null);
  const [valores, setValores] = useState(VALORES_INICIAIS);
  const [sincronizado, setSincronizado] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [fazendaConfig, setFazendaConfig] = useState(null);
  const [climaIndisponivel, setClimaIndisponivel] = useState(true);
  const camposEditadosManualmente = useRef({ temp_max: false, temp_min: false, umidade_relativa: false });

  const loteAtual = lotes?.find((l) => l.id === loteSelecionadoId);
  const aptidaoAtual = loteAtual?.aptidao || 'corte';

  useEffect(() => {
    if (!id_fazenda) return undefined;

    let ativo = true;
    obterLotesAtivos(id_fazenda).then((resultado) => {
      if (!ativo) return;
      setLotes(resultado);
      setLoteSelecionadoId((atual) => atual ?? resultado[0]?.id ?? null);
    });

    return () => { ativo = false; };
  }, [id_fazenda]);

  // Carrega a fazenda (alertas_config, contatos_autorizados) uma única vez,
  // em cache no state, para o motor de alertas não precisar de leituras
  // extras a cada salvamento de manejo.
  useEffect(() => {
    if (!id_fazenda) return undefined;

    let ativo = true;
    obterFazenda(id_fazenda).then((resultado) => {
      if (ativo) setFazendaConfig(resultado);
    });

    return () => { ativo = false; };
  }, [id_fazenda]);

  // Busca clima e umidade automaticamente via API em segundo plano
  useEffect(() => {
    // Reset dos valores operacionais e climáticos ao trocar lote ou data para evitar contaminação de dados
    setValores(VALORES_INICIAIS);
    camposEditadosManualmente.current = { temp_max: false, temp_min: false, umidade_relativa: false };
    setClimaIndisponivel(true);

    if (!loteAtual || !fazendaConfig) return;

    let ativo = true;
    const idadeDias = calcularIdadeDias(loteAtual.data_alojamento, dataUsar);

    obterPrevisaoClimatica(
      loteAtual.linhagem || 'Cobb 500',
      idadeDias,
      fazendaConfig.latitude,
      fazendaConfig.longitude
    ).then((dadosClima) => {
      if (!ativo) return;

      if (!dadosClima || !dadosClima.previsoes) {
        setClimaIndisponivel(true);
        return;
      }

      const dataHojeStr = dataRegistroStr(dataUsar);
      const previsaoHoje = dadosClima.previsoes.find((p) => p.data_str === dataHojeStr);

      if (previsaoHoje) {
        setValores((atual) => {
          const novaUmidade = previsaoHoje.umidade_media != null ? Math.round(previsaoHoje.umidade_media) : '';
          const novaTempMax = previsaoHoje.temp_max != null ? Math.round(previsaoHoje.temp_max) : '';
          const novaTempMin = previsaoHoje.temp_min != null ? Math.round(previsaoHoje.temp_min) : '';

          return {
            ...atual,
            umidade_relativa: camposEditadosManualmente.current.umidade_relativa ? atual.umidade_relativa : novaUmidade,
            temp_max: camposEditadosManualmente.current.temp_max ? atual.temp_max : novaTempMax,
            temp_min: camposEditadosManualmente.current.temp_min ? atual.temp_min : novaTempMin,
          };
        });
        setClimaIndisponivel(false);
      } else {
        // Sem previsão climática disponível para esta data específica
        setClimaIndisponivel(true);
      }
    }).catch((err) => {
      console.error('[FormularioManejo] Falha ao carregar clima automático:', err);
      if (ativo) {
        setClimaIndisponivel(true);
      }
    });

    return () => {
      ativo = false;
    };
  }, [
    loteSelecionadoId, 
    fazendaConfig, 
    dataRetroativaStr, 
    loteAtual?.linhagem, 
    loteAtual?.data_alojamento, 
    dataRegistroStr(dataUsar)
  ]);

  useEffect(() => {
    if (!id_fazenda) return undefined;

    const registrosRef = collection(db, 'fazendas', id_fazenda, 'registros_diarios');
    const ultimoRegistroQuery = query(registrosRef, orderBy('data_registro', 'desc'), limit(1));

    const cancelarListener = onSnapshot(
      ultimoRegistroQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        setSincronizado(!snapshot.metadata.hasPendingWrites && !snapshot.metadata.fromCache);
      },
      (erro) => console.error('[FormularioManejo] Falha no listener de sincronização:', erro)
    );

    const cancelarSync = onSnapshotsInSync(db, () => setSincronizado(true));

    return () => {
      cancelarListener();
      cancelarSync();
    };
  }, [id_fazenda]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  function atualizarCampo(campo, valor) {
    if (campo === 'temp_max' || campo === 'temp_min' || campo === 'umidade_relativa') {
      camposEditadosManualmente.current[campo] = true;
    }
    setValores((atual) => ({ ...atual, [campo]: valor }));
  }

  function handleSalvar() {
    if (!loteSelecionadoId) {
      setFeedback({ tipo: 'erro', mensagem: 'Selecione um lote antes de salvar.' });
      return;
    }

    const camposNumericos = ['agua_litros', 'racao_kg', 'mortalidade_qtd', 'peso_medio_g'];
    if (aptidaoAtual === 'postura') {
      camposNumericos.push('producao_ovos_qtd', 'ovos_descarte_qtd');
    }
    const dados = {};
    for (const campo of camposNumericos) {
      const numero = Number(valores[campo]);
      if (Number.isNaN(numero)) {
        setFeedback({ tipo: 'erro', mensagem: 'Verifique os campos preenchidos: todos devem ser números.' });
        return;
      }
      dados[campo] = numero;
    }

    // Campos climáticos opcionais
    const camposOpcionais = ['temp_max', 'temp_min', 'umidade_relativa'];
    for (const campo of camposOpcionais) {
      const valorBruto = valores[campo];
      if (valorBruto !== '' && valorBruto !== null && valorBruto !== undefined) {
        const numero = Number(valorBruto);
        if (Number.isNaN(numero)) {
          setFeedback({ tipo: 'erro', mensagem: 'Verifique os campos de temperatura e umidade: devem ser números.' });
          return;
        }
        dados[campo] = numero;
      } else {
        dados[campo] = null;
      }
    }

    if (dados.temp_max !== null && dados.temp_min !== null && dados.temp_max < dados.temp_min) {
      setFeedback({ tipo: 'erro', mensagem: 'A temperatura máxima não pode ser menor que a mínima.' });
      return;
    }

    const itu = (dados.temp_max !== null && dados.umidade_relativa !== null)
      ? calcularITU(dados.temp_max, dados.umidade_relativa)
      : null;
    if (itu !== null) {
      dados.itu = itu;
    }

    salvarRegistroDiario(id_fazenda, loteSelecionadoId, {
      ...dados,
      observacoes: valores.observacoes.trim(),
      data_registro: dataUsar,
      data_registro_str: dataRegistroStr(dataUsar),
      clima_indisponivel: climaIndisponivel,
    }).catch((erro) => {
      console.error('[FormularioManejo] Falha ao preparar registro diário:', erro);
      setFeedback({ tipo: 'erro', mensagem: 'Não foi possível salvar o registro. Tente novamente.' });
    });

    setValores(VALORES_INICIAIS);
    setFeedback({ tipo: 'sucesso', mensagem: 'Registro salvo com sucesso!' });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col text-forest-dark relative z-10">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-3 px-5 py-5 glass-panel rounded-none border-t-0 border-x-0 border-white/60 bg-offwhite/50 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {onVoltar && (
            <button
              type="button"
              onClick={onVoltar}
              aria-label="Voltar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-forest-dark shadow-sm border border-white hover:border-vivid-emerald/50 hover:text-vivid-emerald transition-all"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div>
            <h1 className="text-xl font-heading font-bold text-forest-dark tracking-tight leading-none">Manejo Diário</h1>
            <p className="text-xs font-semibold text-forest-light/80 mt-1 uppercase tracking-wider">{dataRegistroStr(dataUsar).split('-').reverse().join('/')}{dataRetroativaStr ? ' (Retroativo)' : ''}</p>
          </div>
        </div>
        <IndicadorSincronizacao sincronizado={sincronizado} />
      </header>

      <main className="flex-1 space-y-6 px-5 py-6 pb-32">
        {feedback && <Banner tipo={feedback.tipo} mensagem={feedback.mensagem} />}

        <section>
          <h2 className="mb-3 text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Selecione o Lote Ativo</h2>

          {lotes === null && <p className="text-sm font-medium text-forest-light">Carregando lotes...</p>}

          {lotes !== null && lotes.length === 0 && (
            <p className="rounded-2xl border-2 border-dashed border-forest/20 p-4 text-sm font-medium text-forest-light text-center">
              Nenhum lote ativo encontrado para esta fazenda.
            </p>
          )}

          {lotes !== null && lotes.length > 0 && (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {lotes.map((lote) => {
                const selecionado = lote.id === loteSelecionadoId;
                return (
                  <button
                    key={lote.id}
                    type="button"
                    onClick={() => setLoteSelecionadoId(lote.id)}
                    aria-pressed={selecionado}
                    className={`flex h-16 min-w-[8.5rem] shrink-0 flex-col items-center justify-center rounded-2xl border px-4 text-center transition-all duration-200 shadow-sm ${
                      selecionado
                        ? 'border-transparent bg-gradient-to-r from-vivid-emerald to-vivid-teal text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] scale-[1.02]'
                        : 'glass-panel text-forest-dark hover:border-vivid-emerald/40'
                    }`}
                  >
                    <span className="text-lg font-heading font-bold leading-tight">{lote.linhagem}</span>
                    {typeof lote.quantidade_inicial === 'number' && (
                      <span className={`text-[10px] font-semibold tracking-wider uppercase mt-0.5 ${selecionado ? 'text-white/80' : 'text-forest-light/70'}`}>
                        {lote.quantidade_inicial.toLocaleString('pt-BR')} aves
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-5">
          <div>
            <CampoContador
              id="agua_litros"
              label="Água consumida"
              unidade="Litros"
              value={valores.agua_litros}
              step={100}
              min={0}
              onChange={(valor) => atualizarCampo('agua_litros', valor)}
            />
            <CalculadoraCaixaDagua onAplicar={(resultado) => atualizarCampo('agua_litros', resultado)} />
          </div>
          <CampoContador
            id="racao_kg"
            label="Ração consumida"
            unidade="Kg"
            value={valores.racao_kg}
            step={50}
            min={0}
            onChange={(valor) => atualizarCampo('racao_kg', valor)}
          />
          <CampoContador
            id="mortalidade_qtd"
            label="Mortalidade"
            unidade="Aves"
            value={valores.mortalidade_qtd}
            step={1}
            min={0}
            onChange={(valor) => atualizarCampo('mortalidade_qtd', valor)}
          />

          <div className="space-y-4">
            {isOffline && (
              <div className="rounded-xl border border-agriAlert-orange/30 bg-agriAlert-orange/10 px-4 py-3 text-xs font-bold text-agriAlert-orange animate-fade-in flex items-start gap-2 shadow-sm">
                <span className="text-sm mt-0.5">⚠️</span>
                <p>Sincronização meteorológica suspensa (Dispositivo Offline). Insira os dados climáticos manualmente ou confie no cache.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
            <CampoContador
              id="temp_max"
              label="Temp. máxima"
              unidade="°C"
              value={valores.temp_max}
              step={1}
              min={-10}
              max={60}
              onChange={(valor) => atualizarCampo('temp_max', valor)}
            />
            <CampoContador
              id="temp_min"
              label="Temp. mínima"
              unidade="°C"
              value={valores.temp_min}
              step={1}
              min={-10}
              max={60}
              onChange={(valor) => atualizarCampo('temp_min', valor)}
            />
          </div>
        </div>

          <div>
            <CampoContador
              id="peso_medio_g"
              label="Peso Médio (Amostragem)"
              unidade="Gramas"
              value={valores.peso_medio_g}
              step={50}
              min={0}
              onChange={(valor) => atualizarCampo('peso_medio_g', valor)}
            />
            <CalculadoraPesagem onAplicar={(resultado) => atualizarCampo('peso_medio_g', resultado)} />
          </div>

          {aptidaoAtual === 'postura' && (
            <div className="grid grid-cols-2 gap-4">
              <CampoContador
                id="producao_ovos_qtd"
                label="Ovos Comerciais"
                unidade="Unid."
                value={valores.producao_ovos_qtd}
                step={10}
                min={0}
                onChange={(valor) => atualizarCampo('producao_ovos_qtd', valor)}
              />
              <CampoContador
                id="ovos_descarte_qtd"
                label="Ovos Descarte"
                unidade="Unid."
                value={valores.ovos_descarte_qtd}
                step={1}
                min={0}
                onChange={(valor) => atualizarCampo('ovos_descarte_qtd', valor)}
              />
            </div>
          )}
        </section>

        <section className="glass-panel p-4 rounded-2xl shadow-sm">
          <label htmlFor="observacoes" className="mb-2 block text-xs font-heading font-bold text-forest-dark uppercase tracking-wide">
            Observações <span className="font-semibold text-forest-light/60 normal-case tracking-normal">(opcional)</span>
          </label>
          <textarea
            id="observacoes"
            rows={3}
            value={valores.observacoes}
            onChange={(evento) => atualizarCampo('observacoes', evento.target.value)}
            placeholder="Relate comportamentos anômalos, falta de energia..."
            className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-medium text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50 resize-none"
          />
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-5 z-20">
        <div className="absolute inset-0 bg-gradient-to-t from-offwhite via-offwhite/90 to-transparent -z-10 pointer-events-none" />
        <button
          type="button"
          onClick={handleSalvar}
          disabled={!loteSelecionadoId}
          className="h-16 w-full rounded-2xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-lg font-bold text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)] transition-all active:scale-[0.98] hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
        >
          Salvar Dados do Dia
        </button>
      </footer>
    </div>
  );
}

function CampoContador({ id, label, unidade, value, step, min, max, onChange }) {
  function aplicarLimites(numero) {
    let resultado = numero;
    if (min !== undefined) resultado = Math.max(min, resultado);
    if (max !== undefined) resultado = Math.min(max, resultado);
    return resultado;
  }

  function decrementar() {
    onChange(aplicarLimites((Number(value) || 0) - step));
  }

  function incrementar() {
    onChange(aplicarLimites((Number(value) || 0) + step));
  }

  function lidarComDigitacao(evento) {
    const bruto = evento.target.value;
    if (bruto === '' || bruto === '-') {
      onChange(bruto);
      return;
    }
    const numero = Number(bruto);
    if (!Number.isNaN(numero)) {
      onChange(numero);
    }
  }

  function lidarComSaidaDeFoco() {
    if (value === '') {
      onChange('');
      return;
    }
    const numero = Number(value);
    onChange(aplicarLimites(Number.isNaN(numero) ? 0 : numero));
  }

  return (
    <div className="glass-panel p-3 rounded-2xl shadow-sm border-white/60">
      <label htmlFor={id} className="mb-2.5 block text-xs font-heading font-bold text-forest-dark uppercase tracking-wide px-1">
        {label} {unidade && <span className="font-semibold text-vivid-emerald normal-case tracking-normal ml-1 bg-vivid-emerald/10 px-1.5 py-0.5 rounded-md">{unidade}</span>}
      </label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={decrementar}
          aria-label={`Diminuir ${label}`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-3xl font-light leading-none text-forest-dark border border-white/60 shadow-sm active:bg-forest-light/10 transition-colors"
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={lidarComDigitacao}
          onBlur={lidarComSaidaDeFoco}
          className="h-14 w-full min-w-0 rounded-xl border border-white/60 bg-white/70 text-center text-2xl font-heading font-bold text-forest-dark shadow-inner focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-all"
        />
        <button
          type="button"
          onClick={incrementar}
          aria-label={`Aumentar ${label}`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-vivid-emerald to-vivid-lime text-3xl font-light leading-none text-white shadow-[0_4px_10px_-2px_rgba(16,185,129,0.4)] active:scale-95 transition-all"
        >
          +
        </button>
      </div>
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

function IndicadorSincronizacao({ sincronizado }) {
  if (sincronizado) {
    return (
      <div
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-agriAlert-green/10 px-3 py-1.5 border border-agriAlert-green/20"
        title="Tudo sincronizado com a nuvem"
      >
        <CloudIcon className="h-4 w-4 text-agriAlert-green" />
        <span className="text-[10px] font-bold text-agriAlert-green uppercase tracking-wider">Sync OK</span>
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-agriAlert-orange/10 px-3 py-1.5 border border-agriAlert-orange/20"
      title="Dados salvos neste aparelho — sincronizando quando a internet voltar"
    >
      <CloudIcon className="h-4 w-4 animate-pulse text-agriAlert-orange" />
      <span className="text-[10px] font-bold text-agriAlert-orange uppercase tracking-wider">Offline</span>
    </div>
  );
}

function CloudIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 19h11Z" />
    </svg>
  );
}

function CalculadoraCaixaDagua({ onAplicar }) {
  const [aberto, setAberto] = useState(false);
  const [capacidade, setCapacidade] = useState(3000);
  const [nivelAtual, setNivelAtual] = useState(75);
  const [nivelAnterior, setNivelAnterior] = useState(100);
  const [reabastecida, setReabastecida] = useState(false);

  if (!aberto) {
    return (
      <button 
        type="button" 
        onClick={() => setAberto(true)}
        className="mt-2 ml-1 text-[10px] font-bold text-forest-light/80 hover:text-vivid-emerald transition-colors uppercase tracking-wider flex items-center gap-1.5"
      >
        <span className="text-sm">🧮</span> Calcular por nível da caixa
      </button>
    );
  }

  let consumoL = (capacidade * (nivelAnterior - nivelAtual)) / 100;
  if (reabastecida) {
    consumoL = (capacidade * (nivelAnterior - 0)) / 100 + (capacidade * (100 - nivelAtual)) / 100;
  }
  consumoL = Math.max(0, Math.round(consumoL));

  return (
    <div className="mt-3 p-4 rounded-xl border border-vivid-emerald/30 bg-vivid-emerald/5 shadow-sm space-y-4 transition-all">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-heading font-bold text-forest-dark uppercase tracking-wide">Medidor Visual de Nível</h3>
        <button type="button" onClick={() => setAberto(false)} className="text-forest-light hover:text-forest-dark">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Capacidade (L)</label>
          <input 
            type="number" 
            value={capacidade} 
            onChange={(e) => setCapacidade(Number(e.target.value))}
            className="w-full rounded-lg border border-white/50 bg-white/60 p-2 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-1 focus:ring-vivid-emerald/50"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Nível Anterior (%)</label>
          <input 
            type="number" 
            value={nivelAnterior} 
            onChange={(e) => setNivelAnterior(Number(e.target.value))}
            className="w-full rounded-lg border border-white/50 bg-white/60 p-2 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-1 focus:ring-vivid-emerald/50"
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider">Nível Atual: {nivelAtual}%</label>
          <span className="text-[10px] font-bold text-vivid-emerald uppercase">Restam ~{Math.round(capacidade * (nivelAtual/100))}L</span>
        </div>
        <input 
          type="range" 
          min="0" max="100" 
          value={nivelAtual} 
          onChange={(e) => setNivelAtual(Number(e.target.value))}
          className="w-full h-2 bg-white/50 rounded-lg appearance-none cursor-pointer accent-vivid-emerald"
        />
      </div>

      <div className="flex items-center gap-2">
        <input 
          type="checkbox" 
          id="reabastecida" 
          checked={reabastecida} 
          onChange={(e) => setReabastecida(e.target.checked)}
          className="w-4 h-4 rounded border-white/60 text-vivid-emerald focus:ring-vivid-emerald bg-white/60"
        />
        <label htmlFor="reabastecida" className="text-xs font-semibold text-forest-dark">Caixa foi reabastecida hoje</label>
      </div>

      <div className="pt-3 border-t border-vivid-emerald/20 flex items-center justify-between">
        <span className="text-sm font-bold text-forest-dark">Consumo: {consumoL} L</span>
        <button 
          type="button" 
          onClick={() => { onAplicar(consumoL); setAberto(false); }}
          className="rounded-lg bg-gradient-to-r from-vivid-emerald to-vivid-lime px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_10px_-2px_rgba(16,185,129,0.4)] active:scale-95 transition-transform"
        >
          Aplicar Valor
        </button>
      </div>
    </div>
  );
}

function CalculadoraPesagem({ onAplicar }) {
  const [aberto, setAberto] = useState(false);
  const [pesoTotal, setPesoTotal] = useState('');
  const [tara, setTara] = useState('');
  const [quantidade, setQuantidade] = useState('');

  if (!aberto) {
    return (
      <button 
        type="button" 
        onClick={() => setAberto(true)}
        className="mt-2 ml-1 text-[10px] font-bold text-forest-light/80 hover:text-vivid-emerald transition-colors uppercase tracking-wider flex items-center gap-1.5"
      >
        <span className="text-sm">🧮</span> Calcular por amostragem (Gaiola)
      </button>
    );
  }

  let mediaG = 0;
  const pTotal = Number(pesoTotal);
  const pTara = Number(tara);
  const qtd = Number(quantidade);

  if (pTotal > 0 && qtd > 0) {
    const liquidoKg = Math.max(0, pTotal - pTara);
    mediaG = Math.round((liquidoKg * 1000) / qtd);
  }

  return (
    <div className="mt-3 p-4 rounded-xl border border-vivid-emerald/30 bg-vivid-emerald/5 shadow-sm space-y-4 transition-all">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-heading font-bold text-forest-dark uppercase tracking-wide">Amostragem por Gaiola</h3>
        <button type="button" onClick={() => setAberto(false)} className="text-forest-light hover:text-forest-dark">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Peso Total na Balança (kg)</label>
          <input 
            type="number" step="0.1" placeholder="Ex: 35.5"
            value={pesoTotal} onChange={(e) => setPesoTotal(e.target.value)}
            className="w-full rounded-lg border border-white/50 bg-white/60 p-2 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-1 focus:ring-vivid-emerald/50 placeholder:text-forest-light/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Peso da Gaiola (kg)</label>
            <input 
              type="number" step="0.1" placeholder="Ex: 2.5"
              value={tara} onChange={(e) => setTara(e.target.value)}
              className="w-full rounded-lg border border-white/50 bg-white/60 p-2 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-1 focus:ring-vivid-emerald/50 placeholder:text-forest-light/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-forest-light uppercase tracking-wider mb-1 block">Qtd. de Aves</label>
            <input 
              type="number" placeholder="Ex: 20"
              value={quantidade} onChange={(e) => setQuantidade(e.target.value)}
              className="w-full rounded-lg border border-white/50 bg-white/60 p-2 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-1 focus:ring-vivid-emerald/50 placeholder:text-forest-light/50"
            />
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-vivid-emerald/20 flex items-center justify-between">
        <span className="text-sm font-bold text-forest-dark">Média: {mediaG} g</span>
        <button 
          type="button" 
          onClick={() => { onAplicar(mediaG); setAberto(false); }}
          disabled={mediaG === 0}
          className="rounded-lg bg-gradient-to-r from-vivid-emerald to-vivid-lime px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_10px_-2px_rgba(16,185,129,0.4)] active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Aplicar Valor
        </button>
      </div>
    </div>
  );
}
