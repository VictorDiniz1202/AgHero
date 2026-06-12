/**
 * src/components/Configuracoes.jsx
 *
 * Painel de Configurações da Fazenda — Premium Light Glassmorphism.
 *
 * OFFLINE-FIRST: `atualizarFazenda` enfileira a escrita no cache local
 * (IndexedDB) de forma síncrona via `setDoc(..., { merge: true })` e não é
 * "await-ada". A UI é atualizada de forma otimista imediatamente; o status
 * "salvando/sincronizado" é apenas um feedback visual baseado em
 * `onSnapshotsInSync`, sem travar o fluxo do operador sem internet.
 */

import { useEffect, useState, useMemo } from 'react';
import { onSnapshotsInSync } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  obterFazenda,
  atualizarFazenda,
  obterLotesAtivos,
  obterColaboradores,
  adicionarColaborador,
  removerColaborador,
  obterStatusFaturamento,
} from '../firebase/services';
import ModalUpsell from './ModalUpsell';

const REGEX_WHATSAPP = /^\+\d{10,15}$/;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ALERTAS_PADRAO = {
  mortalidade_critica: 0.15,
  desvio_agua: 10,
  desvio_racao: 8,
  queda_postura: 10,
};

const CARGO_LABELS = {
  owner: 'Proprietário',
  dono: 'Proprietário',
  veterinarian: 'Veterinário',
  operator: 'Operador',
  peao: 'Operador',
};

const CARGO_BADGE_CLASSES = {
  owner: 'bg-vivid-emerald/10 text-vivid-emerald border border-vivid-emerald/20',
  dono: 'bg-vivid-emerald/10 text-vivid-emerald border border-vivid-emerald/20',
  veterinarian: 'bg-vivid-teal/10 text-vivid-teal border border-vivid-teal/20',
  operator: 'bg-forest-light/10 text-forest-light border border-forest-light/20',
  peao: 'bg-forest-light/10 text-forest-light border border-forest-light/20',
};

export default function Configuracoes({ id_fazenda, papelUsuario, onVoltar }) {
  const ehOwner = papelUsuario === 'dono' || papelUsuario === 'owner';
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [tipoProducao, setTipoProducao] = useState('Corte');
  const [alertasConfig, setAlertasConfig] = useState(ALERTAS_PADRAO);
  const [contatos, setContatos] = useState([]);
  const [plano, setPlano] = useState('Essencial');
  const [compartilharDadosIA, setCompartilharDadosIA] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [novoContato, setNovoContato] = useState('');
  const [erroContato, setErroContato] = useState(null);
  const [statusSalvamento, setStatusSalvamento] = useState(null);
  const [modalUpsellAberto, setModalUpsellAberto] = useState(false);
  const [lotesAtivos, setLotesAtivos] = useState([]);
  const [freqPesagem, setFreqPesagem] = useState('semanal');
  const [diasPersonalizadosPesagem, setDiasPersonalizadosPesagem] = useState('7,14,21,28,35,42,49');

  const [abaAtual, setAbaAtual] = useState('geral');
  const [faturamentoStatus, setFaturamentoStatus] = useState(null);
  const [carregandoFaturamento, setCarregandoFaturamento] = useState(false);

  // Veterinário Responsável
  const [veterinarioNome, setVeterinarioNome] = useState('');
  const [veterinarioWhatsapp, setVeterinarioWhatsapp] = useState('');

  // Gestão de Equipe (apenas owner)
  const [colaboradores, setColaboradores] = useState([]);
  const [carregandoEquipe, setCarregandoEquipe] = useState(true);
  const [novoColabNome, setNovoColabNome] = useState('');
  const [novoColabEmail, setNovoColabEmail] = useState('');
  const [novoColabCargo, setNovoColabCargo] = useState('operator');
  const [erroColab, setErroColab] = useState(null);
  const [colabParaExcluir, setColabParaExcluir] = useState(null);

  useEffect(() => {
    if (!id_fazenda) return undefined;

    let ativo = true;
    Promise.all([
      obterFazenda(id_fazenda),
      obterLotesAtivos(id_fazenda)
    ]).then(([fazenda, lotes]) => {
      if (!ativo) return;

      if (fazenda) {
        setNome(fazenda.nome ?? '');
        setTipoProducao(fazenda.tipo_producao ?? 'Corte');
        setAlertasConfig({ ...ALERTAS_PADRAO, ...(fazenda.alertas_config ?? {}) });
        setContatos(fazenda.contatos_autorizados ?? []);
        setPlano(fazenda.plano ?? 'Essencial');
        setCompartilharDadosIA(fazenda.compartilhar_dados_ia ?? false);
        setLatitude(fazenda.latitude ?? '');
        setLongitude(fazenda.longitude ?? '');
        setFreqPesagem(fazenda.config_pesagem?.frequencia ?? 'semanal');
        setDiasPersonalizadosPesagem(
          (fazenda.config_pesagem?.dias_personalizados ?? [7, 14, 21, 28, 35, 42, 49]).join(',')
        );
        setVeterinarioNome(fazenda.veterinario_responsavel?.nome ?? '');
        setVeterinarioWhatsapp(fazenda.veterinario_responsavel?.whatsapp ?? '');
      }

      setLotesAtivos(lotes ?? []);
      setCarregando(false);
    });

    return () => { ativo = false; };
  }, [id_fazenda]);

  // Feedback de sincronização: "salvando" -> aguarda onSnapshotsInSync -> "sincronizado" -> some.
  useEffect(() => {
    if (statusSalvamento === 'salvando') {
      const cancelarSync = onSnapshotsInSync(db, () => setStatusSalvamento('sincronizado'));
      return cancelarSync;
    }

    if (statusSalvamento === 'sincronizado') {
      const timer = setTimeout(() => setStatusSalvamento(null), 3000);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [statusSalvamento]);

  useEffect(() => {
    if (!erroContato) return undefined;
    const timer = setTimeout(() => setErroContato(null), 3500);
    return () => clearTimeout(timer);
  }, [erroContato]);

  useEffect(() => {
    if (!erroColab) return undefined;
    const timer = setTimeout(() => setErroColab(null), 3500);
    return () => clearTimeout(timer);
  }, [erroColab]);

  useEffect(() => {
    if (!id_fazenda || !ehOwner) {
      setCarregandoEquipe(false);
      return undefined;
    }

    let ativo = true;
    obterColaboradores(id_fazenda).then((lista) => {
      if (!ativo) return;
      setColaboradores(lista);
      setCarregandoEquipe(false);
    });

    return () => { ativo = false; };
  }, [id_fazenda, ehOwner]);

  useEffect(() => {
    if (abaAtual === 'faturamento' && ehOwner && !faturamentoStatus) {
      let ativo = true;
      setCarregandoFaturamento(true);
      obterStatusFaturamento(id_fazenda, plano).then(res => {
        if (ativo) {
          setFaturamentoStatus(res);
          setCarregandoFaturamento(false);
        }
      });
      return () => { ativo = false; };
    }
  }, [abaAtual, ehOwner, id_fazenda, plano, faturamentoStatus]);

  const totalAves = useMemo(() => {
    return lotesAtivos.reduce((acc, lote) => acc + (lote.quantidade_inicial || 0), 0);
  }, [lotesAtivos]);

  const avesSalvasMes = Math.floor(totalAves * 0.015); // Simulação de redução de 1.5% na mortalidade
  const lucroEvitadoMes = avesSalvasMes * 15; // R$ 15,00 por ave salva
  const roi = totalAves > 0 ? ((lucroEvitadoMes - 49.90) / 49.90) * 100 : 0;

  function persistir(dadosAtualizados) {
    atualizarFazenda(id_fazenda, dadosAtualizados);
    setStatusSalvamento('salvando');
  }

  function handleNomeBlur() {
    const nomeAjustado = nome.trim();
    setNome(nomeAjustado);
    if (nomeAjustado) persistir({ nome: nomeAjustado });
  }

  function handleTipoProducaoChange(novoTipo) {
    if (novoTipo === tipoProducao) return;
    setTipoProducao(novoTipo);
    persistir({ tipo_producao: novoTipo });
  }

  function handleLatitudeBlur() {
    const latNum = Number(latitude);
    const latAjustado = Number.isFinite(latNum) ? Math.min(Math.max(latNum, -90), 90) : '';
    setLatitude(latAjustado === '' ? '' : String(latAjustado));
    persistir({ latitude: latAjustado === '' ? null : latAjustado });
  }

  function handleLongitudeBlur() {
    const lonNum = Number(longitude);
    const lonAjustado = Number.isFinite(lonNum) ? Math.min(Math.max(lonNum, -180), 180) : '';
    setLongitude(lonAjustado === '' ? '' : String(lonAjustado));
    persistir({ longitude: lonAjustado === '' ? null : lonAjustado });
  }

  function handleToggleCompartilharIA() {
    const novoValor = !compartilharDadosIA;
    setCompartilharDadosIA(novoValor);
    persistir({ compartilhar_dados_ia: novoValor });
  }

  function handleAlertaBlur(campo) {
    const valor = Number(alertasConfig[campo]);
    const valorAjustado = Number.isFinite(valor) ? Math.max(0, valor) : 0;

    setAlertasConfig((atual) => ({ ...atual, [campo]: valorAjustado }));
    persistir({ alertas_config: { ...alertasConfig, [campo]: valorAjustado } });
  }

  function atualizarAlertaLocal(campo, valor) {
    setAlertasConfig((atual) => ({ ...atual, [campo]: valor }));
  }

  function handleAdicionarContato() {
    const numero = novoContato.trim();

    if (!REGEX_WHATSAPP.test(numero)) {
      setErroContato('Número inválido. Use o formato internacional, ex: +5511999998888.');
      return;
    }

    if (contatos.includes(numero)) {
      setErroContato('Este número já está cadastrado.');
      return;
    }

    const novaLista = [...contatos, numero];
    setContatos(novaLista);
    setNovoContato('');
    setErroContato(null);
    persistir({ contatos_autorizados: novaLista });
  }

  function handleRemoverContato(numero) {
    const novaLista = contatos.filter((c) => c !== numero);
    setContatos(novaLista);
    persistir({ contatos_autorizados: novaLista });
  }

  async function handleAdicionarColaborador() {
    const nome = novoColabNome.trim();
    const email = novoColabEmail.trim().toLowerCase();

    if (!nome) {
      setErroColab('Informe o nome completo do colaborador.');
      return;
    }

    if (!REGEX_EMAIL.test(email)) {
      setErroColab('Informe um e-mail válido.');
      return;
    }

    if (colaboradores.some((colab) => colab.email?.toLowerCase() === email)) {
      setErroColab('Este e-mail já está cadastrado na equipe.');
      return;
    }

    const novoColaborador = await adicionarColaborador(id_fazenda, email, novoColabCargo, nome);
    setColaboradores((atual) => [...atual, novoColaborador]);
    setNovoColabNome('');
    setNovoColabEmail('');
    setNovoColabCargo('operator');
    setErroColab(null);
  }

  function handleConfirmarRemocaoColaborador() {
    if (!colabParaExcluir) return;
    removerColaborador(colabParaExcluir.id);
    setColaboradores((atual) => atual.filter((colab) => colab.id !== colabParaExcluir.id));
    setColabParaExcluir(null);
  }

  function montarConfigPesagem(frequencia, diasStr) {
    const config = { frequencia };
    if (frequencia === 'personalizado') {
      config.dias_personalizados = diasStr
        .split(',')
        .map((d) => parseInt(d.trim(), 10))
        .filter((d) => !isNaN(d) && d > 0)
        .sort((a, b) => a - b);
    }
    return config;
  }

  function handleFreqPesagemChange(novaFreq) {
    if (novaFreq === freqPesagem) return;
    setFreqPesagem(novaFreq);
    persistir({ config_pesagem: montarConfigPesagem(novaFreq, diasPersonalizadosPesagem) });
  }

  function handleDiasPersonalizadosBlur() {
    persistir({ config_pesagem: montarConfigPesagem(freqPesagem, diasPersonalizadosPesagem) });
  }

  function handleVeterinarioBlur() {
    persistir({
      veterinario_responsavel: {
        nome: veterinarioNome.trim(),
        whatsapp: veterinarioWhatsapp.trim()
      }
    });
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-offwhite text-forest-light relative z-10">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-vivid-emerald/20 border-t-vivid-emerald animate-spin shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
          <span className="text-sm font-bold tracking-wide uppercase">Carregando configurações...</span>
        </div>
      </div>
    );
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
            <h1 className="text-xl font-heading font-bold text-forest-dark tracking-tight leading-none">Configurações</h1>
            <p className="text-xs font-semibold text-forest-light/80 mt-1 uppercase tracking-wider">Fazenda &amp; Alertas</p>
          </div>
        </div>
      </header>

      <div className="bg-offwhite/50 border-b border-white/60 sticky top-[80px] z-40 px-5 overflow-x-auto no-scrollbar backdrop-blur-xl">
        <div className="flex items-center gap-4 py-3 min-w-max">
          <button
            onClick={() => setAbaAtual('geral')}
            className={`text-sm font-bold uppercase tracking-wide transition-colors ${abaAtual === 'geral' ? 'text-vivid-emerald border-b-2 border-vivid-emerald pb-1' : 'text-forest-light hover:text-forest-dark pb-1'}`}
          >
            Geral
          </button>
          <button
            onClick={() => setAbaAtual('faturamento')}
            className={`text-sm font-bold uppercase tracking-wide transition-colors ${abaAtual === 'faturamento' ? 'text-vivid-emerald border-b-2 border-vivid-emerald pb-1' : 'text-forest-light hover:text-forest-dark pb-1'}`}
          >
            Plano & Faturamento
          </button>
        </div>
      </div>

      <main className="flex-1 space-y-6 px-5 py-6 pb-12">
        {statusSalvamento && <StatusSalvamento status={statusSalvamento} />}

        {abaAtual === 'geral' && (
          <>

        {/* Dados Gerais */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm space-y-4">
          <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Dados Gerais da Fazenda</h2>

          <div>
            <label htmlFor="nome_fazenda" className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">
              Nome da Fazenda
            </label>
            <input
              id="nome_fazenda"
              type="text"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              onBlur={handleNomeBlur}
              placeholder="Ex: Fazenda Progresso"
              className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">Tipo de Produção</label>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/40 p-1.5 border border-white/50">
              {['Corte', 'Postura'].map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => handleTipoProducaoChange(opcao)}
                  aria-pressed={tipoProducao === opcao}
                  className={`rounded-lg py-2.5 text-sm font-bold transition-all duration-200 ${
                    tipoProducao === opcao
                      ? 'bg-gradient-to-r from-vivid-emerald to-vivid-teal text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)]'
                      : 'text-forest-light hover:text-forest-dark'
                  }`}
                >
                  {opcao}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lat_fazenda" className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">
                Latitude
              </label>
              <input
                id="lat_fazenda"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                onBlur={handleLatitudeBlur}
                placeholder="-23.5505"
                className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50"
              />
            </div>
            <div>
              <label htmlFor="lon_fazenda" className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">
                Longitude
              </label>
              <input
                id="lon_fazenda"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                onBlur={handleLongitudeBlur}
                placeholder="-46.6333"
                className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50"
              />
            </div>
          </div>
        </section>

        {/* Limites de Alerta */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Limites de Alerta</h2>
            <p className="text-xs font-medium text-forest-light/80 mt-1">Define os gatilhos para os avisos no painel e no WhatsApp.</p>
          </div>

          <CampoPercentual
            id="mortalidade_critica"
            label="Mortalidade Diária Crítica"
            descricao="Acima deste valor, a IA dispara alerta vermelho."
            value={alertasConfig.mortalidade_critica}
            placeholder="0.15"
            onChange={(valor) => atualizarAlertaLocal('mortalidade_critica', valor)}
            onBlur={() => handleAlertaBlur('mortalidade_critica')}
          />
          <CampoPercentual
            id="desvio_agua"
            label="Desvio de Consumo de Água"
            descricao="Variação aceitável antes de alertar queda ou estresse térmico."
            value={alertasConfig.desvio_agua}
            placeholder="10"
            onChange={(valor) => atualizarAlertaLocal('desvio_agua', valor)}
            onBlur={() => handleAlertaBlur('desvio_agua')}
          />
          <CampoPercentual
            id="desvio_racao"
            label="Variação de Consumo de Ração"
            descricao="Variação aceitável em relação à média móvel de 3 dias."
            value={alertasConfig.desvio_racao}
            placeholder="8"
            onChange={(valor) => atualizarAlertaLocal('desvio_racao', valor)}
            onBlur={() => handleAlertaBlur('desvio_racao')}
          />
          {tipoProducao === 'Postura' && (
            <CampoPercentual
              id="queda_postura"
              label="Alerta de Queda de Postura"
              descricao="Queda percentual máxima na produção diária antes de gerar alerta."
              value={alertasConfig.queda_postura}
              placeholder="10"
              onChange={(valor) => atualizarAlertaLocal('queda_postura', valor)}
              onBlur={() => handleAlertaBlur('queda_postura')}
            />
          )}
        </section>

        {/* Como Funciona o Alerta Climático? */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm border border-vivid-emerald/20 bg-gradient-to-br from-white/60 to-vivid-emerald/5">
          <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide flex items-center gap-2">
            <span>🌬️</span> Como funciona o Alerta Climático?
          </h2>
          <p className="text-xs font-medium text-forest-dark/80 mt-2 leading-relaxed">
            A IA do AgBoy cruza os dados do clima local (Temperatura e Umidade Relativa) com a idade e aptidão do lote (Corte ou Postura) para calcular o <strong>ITU (Índice de Temperatura e Umidade)</strong>.
          </p>
          <ul className="mt-3 space-y-1 text-xs font-medium text-forest-dark/70 list-disc pl-5">
            <li>Se o ITU sair da faixa de conforto ideal, a IA sugere manejos imediatos no painel principal.</li>
            <li>Em casos críticos (Extremo Perigo), o Veterinário Responsável e os Contatos de WhatsApp recebem um aviso via WhatsApp com as recomendações da IA (ex: ligar nebulizadores, ajustar ventilação).</li>
          </ul>
        </section>

        {/* Gestão de Pesagens */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Gestão de Pesagens</h2>
            <p className="text-xs font-medium text-forest-light/80 mt-1">Frequência padrão para registrar o peso médio das aves e manter os índices zootécnicos atualizados.</p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">Frequência de Pesagem</label>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/40 p-1.5 border border-white/50">
              {[
                { valor: 'semanal', label: 'Semanal' },
                { valor: 'diario', label: 'Diária' },
                { valor: 'personalizado', label: 'Personalizada' },
              ].map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  onClick={() => handleFreqPesagemChange(opcao.valor)}
                  aria-pressed={freqPesagem === opcao.valor}
                  className={`rounded-lg py-2.5 text-xs sm:text-sm font-bold transition-all duration-200 ${
                    freqPesagem === opcao.valor
                      ? 'bg-gradient-to-r from-vivid-emerald to-vivid-teal text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)]'
                      : 'text-forest-light hover:text-forest-dark'
                  }`}
                >
                  {opcao.label}
                </button>
              ))}
            </div>
          </div>

          {freqPesagem === 'personalizado' && (
            <div>
              <label htmlFor="dias_pesagem" className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">
                Dias do Ciclo para Pesagem
              </label>
              <input
                id="dias_pesagem"
                type="text"
                inputMode="numeric"
                value={diasPersonalizadosPesagem}
                onChange={(evento) => setDiasPersonalizadosPesagem(evento.target.value)}
                onBlur={handleDiasPersonalizadosBlur}
                placeholder="7,14,21,28,35,42,49"
                className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50"
              />
              <p className="mt-2 text-[11px] font-medium text-forest-light/80">Lista de dias do ciclo separados por vírgula (ex: 7,14,21).</p>
            </div>
          )}
        </section>

        {/* Veterinário Responsável */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Veterinário Responsável</h2>
            <p className="text-xs font-medium text-forest-light/80 mt-1">Contato principal para receber alertas sanitários críticos em tempo real.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="vet_nome" className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">
                Nome do Veterinário
              </label>
              <input
                id="vet_nome"
                type="text"
                value={veterinarioNome}
                onChange={(e) => setVeterinarioNome(e.target.value)}
                onBlur={handleVeterinarioBlur}
                placeholder="Ex: Dr. Carlos"
                className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50"
              />
            </div>
            <div>
              <label htmlFor="vet_whatsapp" className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">
                WhatsApp (com DDI e DDD)
              </label>
              <input
                id="vet_whatsapp"
                type="tel"
                value={veterinarioWhatsapp}
                onChange={(e) => setVeterinarioWhatsapp(e.target.value)}
                onBlur={handleVeterinarioBlur}
                placeholder="+5511999998888"
                className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50"
              />
            </div>
          </div>
        </section>

        {/* Contatos WhatsApp */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Contatos de WhatsApp Autorizados</h2>
            <p className="text-xs font-medium text-forest-light/80 mt-1">Números que recebem alertas automáticos do n8n em caso de anomalias.</p>
          </div>

          {contatos.length === 0 && (
            <p className="rounded-xl border-2 border-dashed border-forest/20 p-3 text-center text-xs font-medium text-forest-light">
              Nenhum contato cadastrado.
            </p>
          )}

          {contatos.length > 0 && (
            <ul className="space-y-2">
              {contatos.map((numero) => (
                <li
                  key={numero}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/60 px-3.5 py-2.5"
                >
                  <span className="text-sm font-bold text-forest-dark tabular-nums">{numero}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoverContato(numero)}
                    aria-label={`Remover ${numero}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-agriAlert-red/10 text-agriAlert-red hover:bg-agriAlert-red/20 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="tel"
                inputMode="tel"
                value={novoContato}
                onChange={(evento) => setNovoContato(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') {
                    evento.preventDefault();
                    handleAdicionarContato();
                  }
                }}
                placeholder="+5511999998888"
                className="w-full min-w-0 rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50"
              />
              <button
                type="button"
                onClick={handleAdicionarContato}
                className="shrink-0 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime px-4 text-sm font-bold text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)] active:scale-95 transition-transform"
              >
                Adicionar
              </button>
            </div>
            {erroContato && (
              <p className="text-xs font-bold text-agriAlert-red">{erroContato}</p>
            )}
          </div>
        </section>

        {/* Plano de Assinatura */}
        <section className="space-y-4">
          <div className="glass-panel p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Plano de Assinatura</h2>
              <p className="text-xs font-medium text-forest-light/80 mt-1">Controla os limites e gatilhos de IA/WhatsApp.</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                plano === 'Inteligente'
                  ? 'bg-vivid-emerald/10 text-vivid-emerald border border-vivid-emerald/20'
                  : 'bg-forest-light/10 text-forest-light border border-forest-light/20'
              }`}
            >
              {plano}
            </span>
          </div>

          {plano === 'Essencial' && (
            <div className="rounded-2xl p-[1px] bg-gradient-to-br from-vivid-emerald/60 via-vivid-teal/40 to-vivid-lime/30 shadow-xl">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest-dark to-forest p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-vivid-lime/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                      <span className="text-vivid-emerald text-lg">✨</span>
                    </div>
                    <p className="text-sm font-heading font-bold text-white uppercase tracking-wide">Plano Inteligente</p>
                  </div>

                  <ul className="space-y-2 text-sm font-medium text-white/80">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-vivid-emerald" />
                      Análises de IA explicativa (XAI) sobre anomalias de consumo e mortalidade.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-vivid-emerald" />
                      Alertas diretos no WhatsApp do veterinário responsável.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-vivid-emerald" />
                      Detecção preditiva de quedas de consumo via médias móveis.
                    </li>
                  </ul>

                  {/* Simulador de ROI */}
                  {totalAves > 0 && (
                    <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                      <h3 className="text-xs font-bold text-white/90 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <span className="text-vivid-emerald">📈</span> Simulador de Retorno (Mês)
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white/70">Aves Protegidas:</span>
                          <span className="font-bold text-white">{totalAves.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-white/70">Mortalidade Evitada (1.5%):</span>
                          <span className="font-bold text-white">{avesSalvasMes.toLocaleString('pt-BR')} aves</span>
                        </div>
                        <div className="h-px w-full bg-white/10 my-2" />
                        <div className="flex justify-between items-end">
                          <div>
                            <span className="block text-xs text-white/60 mb-1">Lucro Estimado Salvo</span>
                            <span className="text-lg font-bold text-vivid-lime">R$ {lucroEvitadoMes.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-xs text-white/60 mb-1">Custo do Plano</span>
                            <span className="text-sm font-medium text-white/90">R$ 49,90</span>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/10">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-white/80">ROI Projetado:</span>
                            <span className="text-sm font-black text-vivid-emerald bg-white/10 px-2 py-1 rounded-lg">
                              {roi.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                    <button
                      type="button"
                      onClick={() => setModalUpsellAberto(true)}
                      className="w-full mt-4 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime py-3 text-sm font-bold text-white shadow-[0_10px_25px_-8px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-transform"
                    >
                      Fazer Upgrade para o Plano Inteligente
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

        {/* Inteligência Coletiva (Data Lake Sprint 30) */}
        <section className="glass-panel p-4 rounded-2xl shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide flex items-center gap-2">
              <span className="text-lg">🤝</span> Inteligência Coletiva & Privacidade
            </h2>
            <p className="text-xs font-medium text-forest-light/80 mt-1">Ao ativar, seus lotes encerrados ajudarão a calibrar as previsões do AgBoy na sua região, e você terá acesso ao painel de benchmarking regional de conversão alimentar.</p>
          </div>
          
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input
                type="checkbox"
                checked={compartilharDadosIA}
                onChange={handleToggleCompartilharIA}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors duration-300 ease-in-out ${compartilharDadosIA ? 'bg-vivid-emerald' : 'bg-white border border-forest/20'}`}>
                <div className={`absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-300 ease-in-out ${compartilharDadosIA ? 'translate-x-5 bg-white shadow-sm' : 'bg-forest/30'}`} />
              </div>
            </div>
            <div className="flex-1">
              <span className="block text-sm font-bold text-forest-dark group-hover:text-vivid-emerald transition-colors">Compartilhar Métricas de Lote de Forma Anônima</span>
              <span className="block text-[10px] font-medium text-forest-light/70 mt-1">Nenhum dado pessoal (nome, exata localização, telefone) é compartilhado. Apenas região (CEP), linhagem e índices zootécnicos.</span>
            </div>
          </label>
        </section>

        {/* Gestão da Equipe */}
        {ehOwner && (
          <section className="glass-panel p-4 rounded-2xl shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Gestão da Equipe</h2>
              <p className="text-xs font-medium text-forest-light/80 mt-1">Convide colaboradores e controle o acesso de cada um aos módulos da fazenda.</p>
            </div>

            {carregandoEquipe ? (
              <p className="rounded-xl border-2 border-dashed border-forest/20 p-3 text-center text-xs font-medium text-forest-light">
                Carregando equipe...
              </p>
            ) : colaboradores.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-forest/20 p-3 text-center text-xs font-medium text-forest-light">
                Nenhum colaborador cadastrado ainda.
              </p>
            ) : (
              <ul className="space-y-2">
                {colaboradores.map((colab) => (
                  <li
                    key={colab.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/60 px-3.5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-forest-dark truncate">{colab.nome || colab.email}</p>
                      <p className="text-xs font-medium text-forest-light/80 truncate">{colab.email}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CARGO_BADGE_CLASSES[colab.role] || CARGO_BADGE_CLASSES.operator}`}>
                          {CARGO_LABELS[colab.role] || 'Operador'}
                        </span>
                        {colab.uid ? (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-agriAlert-green/10 text-agriAlert-green border border-agriAlert-green/20">
                            Ativo
                          </span>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-agriAlert-orange/10 text-agriAlert-orange border border-agriAlert-orange/20">
                            Pendente - Aguardando Primeiro Acesso
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setColabParaExcluir(colab)}
                      aria-label={`Remover ${colab.nome || colab.email}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-agriAlert-red/10 text-agriAlert-red hover:bg-agriAlert-red/20 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-3 rounded-xl border border-white/50 bg-white/40 p-3.5">
              <h3 className="text-xs font-bold text-forest-dark uppercase tracking-wide">Adicionar Membro</h3>

              <div>
                <label htmlFor="novo_colab_nome" className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">
                  Nome Completo
                </label>
                <input
                  id="novo_colab_nome"
                  type="text"
                  value={novoColabNome}
                  onChange={(evento) => setNovoColabNome(evento.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50"
                />
              </div>

              <div>
                <label htmlFor="novo_colab_email" className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">
                  E-mail
                </label>
                <input
                  id="novo_colab_email"
                  type="email"
                  inputMode="email"
                  value={novoColabEmail}
                  onChange={(evento) => setNovoColabEmail(evento.target.value)}
                  placeholder="colaborador@email.com"
                  className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50"
                />
              </div>

              <div>
                <label htmlFor="novo_colab_cargo" className="mb-2 block text-xs font-bold text-forest-light uppercase tracking-wide">
                  Cargo / Permissão
                </label>
                <select
                  id="novo_colab_cargo"
                  value={novoColabCargo}
                  onChange={(evento) => setNovoColabCargo(evento.target.value)}
                  className="w-full rounded-xl border border-white/50 bg-white/60 p-3 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow"
                >
                  <option value="owner">Dono (Acesso Total)</option>
                  <option value="veterinarian">Veterinário (Acesso a Manejos &amp; Sanidade)</option>
                  <option value="operator">Operador de Galpão (Apenas Manejo Diário)</option>
                </select>
              </div>

              {erroColab && (
                <p className="text-xs font-bold text-agriAlert-red">{erroColab}</p>
              )}

              <button
                type="button"
                onClick={handleAdicionarColaborador}
                className="w-full rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime py-3 text-sm font-bold text-white shadow-[0_10px_25px_-8px_rgba(16,185,129,0.6)] active:scale-[0.98] transition-transform"
              >
                Adicionar Membro
              </button>
            </div>
          </section>
        )}
        </>
        )}

        {abaAtual === 'faturamento' && (
          <div className="space-y-6">
            {!ehOwner ? (
              <div className="glass-panel p-6 rounded-2xl shadow-sm text-center">
                <span className="text-3xl mb-2 block">🔒</span>
                <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Acesso Restrito</h2>
                <p className="text-xs font-medium text-forest-light mt-2">
                  Apenas proprietários da fazenda podem visualizar e gerenciar o faturamento e assinatura.
                </p>
              </div>
            ) : (
              <>
                <section className="glass-panel p-6 rounded-2xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Seu Plano Atual</h2>
                      <p className="text-xs font-medium text-forest-light/80 mt-1">Gerencie sua assinatura e recursos.</p>
                    </div>
                    {plano === 'Inteligente' ? (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vivid-emerald opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-vivid-emerald shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                      </span>
                    ) : (
                      <span className="h-3 w-3 rounded-full bg-forest-light/40"></span>
                    )}
                  </div>

                  <div className={`rounded-xl p-5 border ${plano === 'Inteligente' ? 'border-vivid-emerald/30 bg-vivid-emerald/5' : 'border-white/50 bg-white/40'}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xl font-black ${plano === 'Inteligente' ? 'text-vivid-emerald' : 'text-forest-dark'}`}>{plano}</span>
                      {plano === 'Inteligente' && <span className="bg-vivid-emerald/20 text-vivid-emerald px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Ativo</span>}
                    </div>
                    {plano === 'Essencial' && (
                      <p className="text-xs text-forest-light font-medium mb-4">Atualize para o Plano Inteligente e desbloqueie alertas pelo WhatsApp, BI ilimitado e muito mais.</p>
                    )}
                    {plano === 'Inteligente' && faturamentoStatus && (
                      <p className="text-xs text-forest-dark/80 font-semibold mb-4">
                        Próxima cobrança: <span className="text-vivid-emerald">{faturamentoStatus.renovacao || 'Em breve'}</span>
                      </p>
                    )}
                    
                    {plano === 'Essencial' ? (
                      <button
                        onClick={() => setModalUpsellAberto(true)}
                        className="w-full bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white font-bold py-3 rounded-xl shadow-[0_8px_20px_-6px_rgba(16,185,129,0.5)] hover:scale-[1.02] transition-transform min-h-[48px]"
                      >
                        Fazer Upgrade para Inteligente
                      </button>
                    ) : (
                      <button className="w-full bg-white border border-forest-light/20 text-forest-dark font-bold py-3 rounded-xl hover:bg-offwhite transition-colors">
                        Gerenciar Assinatura
                      </button>
                    )}
                  </div>
                </section>

                {plano === 'Inteligente' && (
                  <section className="glass-panel p-6 rounded-2xl shadow-sm space-y-4">
                    <h2 className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Histórico de Transações</h2>
                    {carregandoFaturamento ? (
                      <p className="text-xs text-center text-forest-light py-4">Carregando...</p>
                    ) : faturamentoStatus?.historico?.length > 0 ? (
                      <ul className="space-y-3">
                        {faturamentoStatus.historico.map((trx, idx) => (
                          <li key={idx} className="flex items-center justify-between p-3 rounded-lg border border-white/40 bg-white/30">
                            <div>
                              <p className="text-sm font-bold text-forest-dark">{trx.descricao || 'Renovação - Plano Inteligente'}</p>
                              <p className="text-[10px] text-forest-light font-medium">{trx.data}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-forest-dark">R$ {trx.valor}</p>
                              <span className="text-[10px] text-vivid-emerald font-bold uppercase tracking-wider">{trx.status}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-center text-forest-light py-4">Nenhuma transação encontrada.</p>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {modalUpsellAberto && (
        <ModalUpsell id_fazenda={id_fazenda} onFechar={() => setModalUpsellAberto(false)} />
      )}

      {colabParaExcluir && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-forest-dark/40 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-heading font-bold text-forest-dark">Remover colaborador?</h3>
            <p className="mt-2 text-sm font-medium text-forest-light leading-relaxed">
              <span className="font-bold text-forest-dark">{colabParaExcluir.nome || colabParaExcluir.email}</span> perderá o acesso à fazenda imediatamente. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={handleConfirmarRemocaoColaborador}
                className="w-full rounded-xl bg-agriAlert-red py-3 text-sm font-bold text-white active:scale-[0.98] transition-transform"
              >
                Remover
              </button>
              <button
                type="button"
                onClick={() => setColabParaExcluir(null)}
                className="w-full rounded-xl bg-forest-light/10 py-3 text-sm font-bold text-forest-dark hover:bg-forest-light/20 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CampoPercentual({ id, label, descricao, value, placeholder, onChange, onBlur }) {
  function lidarComDigitacao(evento) {
    const bruto = evento.target.value;
    if (bruto === '' || bruto === '.' || bruto === '-') {
      onChange(bruto);
      return;
    }
    const numero = Number(bruto);
    if (!Number.isNaN(numero)) {
      onChange(numero);
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold text-forest-dark">
        {label}
      </label>
      {descricao && <p className="mb-2 text-xs font-medium text-forest-light/80">{descricao}</p>}
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          placeholder={placeholder}
          onChange={lidarComDigitacao}
          onBlur={onBlur}
          className="w-full rounded-xl border border-white/50 bg-white/60 p-3 pr-10 text-sm font-semibold text-forest-dark focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 focus:border-vivid-emerald/50 transition-shadow placeholder:text-forest-light/50"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-bold text-forest-light/70">%</span>
      </div>
    </div>
  );
}

function StatusSalvamento({ status }) {
  if (status === 'salvando') {
    return (
      <div role="status" className="rounded-xl border border-agriAlert-orange/30 bg-agriAlert-orange/10 backdrop-blur-md px-4 py-3 text-xs font-bold text-agriAlert-orange flex items-center gap-2.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-agriAlert-orange animate-pulse" />
        Configurações salvas localmente e sincronizando...
      </div>
    );
  }

  return (
    <div role="status" className="rounded-xl border border-agriAlert-green/30 bg-agriAlert-green/10 backdrop-blur-md px-4 py-3 text-xs font-bold text-agriAlert-green flex items-center gap-2.5">
      <span className="h-2 w-2 shrink-0 rounded-full bg-agriAlert-green" />
      Sincronizado com a nuvem.
    </div>
  );
}
