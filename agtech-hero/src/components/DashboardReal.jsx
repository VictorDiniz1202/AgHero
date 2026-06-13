import React, { useState, useEffect } from "react";
import { obterLotesAtivos, obterUltimosRegistros, obterFazenda, obterRegistrosSanitarios, obterAlertasEnviados, normalizarPlano } from "../firebase/services";
import { VACINAS_PADRAO, obterVacinasAtrasadas, calcularIdadeLote } from "./ManejoSanitario";
import { Timestamp, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import ModalUpsell from "./ModalUpsell";
import { obterPrevisaoClimatica, calcularITU } from "../utils/climaPreditivo";
import { DIRETRIZES_ZOOTECNICAS } from "../data/DiretrizesZootecnicas";

// --- Tabelas Zootécnicas Oficiais ---
function obterPesoPadraoCobb500(dias) {
  const tabela = [
    { dia: 1, peso: 42 },
    { dia: 7, peso: 200 },
    { dia: 14, peso: 490 },
    { dia: 21, peso: 950 },
    { dia: 28, peso: 1560 },
    { dia: 35, peso: 2270 },
    { dia: 42, peso: 2980 },
    { dia: 49, peso: 3600 }
  ];
  if (dias <= 1) return 42;
  if (dias >= 49) return 3600;
  
  for (let i = 0; i < tabela.length - 1; i++) {
    const p1 = tabela[i];
    const p2 = tabela[i+1];
    if (dias >= p1.dia && dias <= p2.dia) {
      const prop = (dias - p1.dia) / (p2.dia - p1.dia);
      return p1.peso + prop * (p2.peso - p1.peso);
    }
  }
  return 2000;
}

// --- Curva Padrão de Postura Lohmann (% postura por semana de idade) ---
function obterCurvaPosturaLohmann(semana) {
  const tabela = [
    { semana: 17, pct: 1 },
    { semana: 18, pct: 5 },
    { semana: 19, pct: 30 },
    { semana: 20, pct: 65 },
    { semana: 21, pct: 80 },
    { semana: 22, pct: 88 },
    { semana: 24, pct: 92 },
    { semana: 28, pct: 95 },
    { semana: 50, pct: 92 },
    { semana: 70, pct: 85 },
    { semana: 90, pct: 75 },
  ];
  if (semana <= tabela[0].semana) return tabela[0].pct;
  if (semana >= tabela[tabela.length - 1].semana) return tabela[tabela.length - 1].pct;

  for (let i = 0; i < tabela.length - 1; i++) {
    const p1 = tabela[i];
    const p2 = tabela[i + 1];
    if (semana >= p1.semana && semana <= p2.semana) {
      const prop = (semana - p1.semana) / (p2.semana - p1.semana);
      return p1.pct + prop * (p2.pct - p1.pct);
    }
  }
  return 90;
}

// --- Curva Padrão de Peso Corporal Lohmann (g, por semana de idade) ---
// Interpola a partir das metas semanais oficiais em DiretrizesZootecnicas.js
function obterPesoPadraoLohmann(semana) {
  const metas = DIRETRIZES_ZOOTECNICAS["Lohmann"].metas_semanais;
  const semanas = Object.keys(metas).map(Number).sort((a, b) => a - b);

  if (semana <= semanas[0]) return metas[semanas[0]].peso_g;
  if (semana >= semanas[semanas.length - 1]) return metas[semanas[semanas.length - 1]].peso_g;

  for (let i = 0; i < semanas.length - 1; i++) {
    const s1 = semanas[i];
    const s2 = semanas[i + 1];
    if (semana >= s1 && semana <= s2) {
      const prop = (semana - s1) / (s2 - s1);
      return metas[s1].peso_g + prop * (metas[s2].peso_g - metas[s1].peso_g);
    }
  }
  return metas[semanas[semanas.length - 1]].peso_g;
}

// Formata um valor numérico como moeda BRL
function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formata um Date para "YYYY-MM-DD" local (mesma convenção de data_registro_str)
function formatarDataStr(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const dia = String(date.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// --- Marcos do Ciclo de Produção (Linha do Tempo Adaptativa) ---
const MARCOS_CORTE = [
  { nome: "Alojamento", ini: 1, fim: 1, dica: "Dia 1: Galpão pré-aquecido a 32-34°C. Pintinhos devem ficar bem distribuídos, sem amontoar nos cantos." },
  { nome: "Aquecimento", ini: 1, fim: 7, dica: "Dias 1-7: Mantenha a campânula ativa, reduzindo cerca de 1°C a cada 2-3 dias conforme o emplumamento." },
  { nome: "Transição Ração", ini: 8, fim: 14, dica: "Dias 8-14: Transição da ração pré-inicial para inicial. Garanta espaço de comedouro suficiente para todas as aves." },
  { nome: "Engorda", ini: 15, fim: 42, dica: "Dias 15-42: Fase de maior ganho de peso. Monitore o consumo de água/ração diariamente e ajuste a ventilação mínima." },
  { nome: "Pré-abate", ini: 43, fim: 48, dica: "Dias 43-48: Reavalie a densidade do galpão e ajuste o programa de luz para preparar o lote para o carregamento." },
  { nome: "Abate", ini: 49, fim: 49, dica: "Dia 49: Período recomendado para o abate. Suspenda a ração de 6 a 8h antes do carregamento (jejum pré-abate)." },
];

const MARCOS_POSTURA = [
  { nome: "Cria", ini: 1, fim: 5, dica: "Semanas 1-5: Temperatura de 32-34°C com redução gradual. Foco no desenvolvimento do sistema imunológico e do trato digestivo." },
  { nome: "Recria", ini: 6, fim: 17, dica: "Semanas 6-17: Uniformidade de peso corporal é essencial para um início de postura sincronizado. Acompanhe o programa de luz." },
  { nome: "Produção", ini: 18, fim: 79, dica: "Semana 18+: Pico de postura esperado entre as semanas 25-30. Garanta fornecimento extra de cálcio (casca de ovo) à tarde." },
  { nome: "Descarte", ini: 80, fim: 90, dica: "Semanas 80-90: Avalie a viabilidade econômica do plantel e planeje o descarte ou a muda forçada conforme a queda de postura." },
];

// --- Sub-componentes Estilizados ---

const LineChart = ({ historico, id_fazenda, onAbrirFormulario }) => {
  const W = 260, H = 90;
  const faltamDados = historico.length < 2;
  const isDemoFazenda = id_fazenda === 'fazenda_demo_123';

  if (faltamDados && !isDemoFazenda) {
    return (
      <div className="glass-panel rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-vivid-emerald/10 flex items-center justify-center text-xl mb-1">
          📊
        </div>
        <p className="text-sm font-bold text-forest-dark">Este lote ainda não possui registros salvos.</p>
        <p className="text-xs text-forest-light font-medium max-w-xs">
          Use o botão '+' para registrar consumo de água, ração, temperatura e mortalidade hoje!
        </p>
        <button onClick={onAbrirFormulario} className="mt-2 px-4 py-2 bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white rounded-xl text-xs font-bold shadow-sm hover:scale-105 transition-transform">
          + Novo Manejo
        </button>
      </div>
    );
  }

  const isDemo = faltamDados && isDemoFazenda;

  // Dados de fallback para demonstração
  const demoWater = [40, 55, 48, 62, 58, 70, 65, 80, 74, 88, 82, 95];
  const demoFeed  = [30, 38, 35, 50, 45, 60, 55, 72, 66, 78, 70, 84];
  const maxDemo = 100;

  let ptsWater = "";
  let ptsFeed = "";
  let chartDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  if (isDemo) {
    const pts = (arr) =>
      arr
        .map((v, i) => `${(i / (arr.length - 1)) * W},${H - (v / maxDemo) * H}`)
        .join(" ");
    ptsWater = pts(demoWater);
    ptsFeed = pts(demoFeed);
  } else {
    // Pega no máximo os últimos 7 registros para exibir
    const ultimos7 = historico.slice(-7);
    const maxVal = Math.max(
      ...ultimos7.map(r => r.agua_litros || 0),
      ...ultimos7.map(r => (r.racao_kg || 0) * 2), // Escala a ração para visualização
      100
    );

    const getY = (val) => H - (val / maxVal) * H;
    const getX = (index) => (index / (ultimos7.length - 1)) * W;

    ptsWater = ultimos7.map((r, i) => `${getX(i)},${getY(r.agua_litros || 0)}`).join(" ");
    ptsFeed = ultimos7.map((r, i) => `${getX(i)},${getY((r.racao_kg || 0) * 2)}`).join(" ");
    
    chartDays = ultimos7.map(r => {
      // Pega os últimos dois caracteres da data (o dia)
      const partes = r.data_registro_str.split("-");
      return partes[2] || "Dia";
    });
  }

  return (
    <div className="glass-panel rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-heading font-bold text-forest-dark uppercase tracking-wide flex items-center gap-1.5">
          Consumo Água/Ração 
          {isDemo && <span className="text-[9px] font-semibold text-agriAlert-orange lowercase bg-agriAlert-orange/10 px-1.5 py-0.5 rounded-full">(demo)</span>}
        </p>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-forest-light">
            <span className="w-2 h-2 rounded-full bg-vivid-emerald shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            Água
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-forest-light">
            <span className="w-2 h-2 rounded-full bg-vivid-lime shadow-[0_0_6px_rgba(132,204,22,0.5)]" />
            Ração (x2)
          </span>
        </div>
      </div>
      <div className="h-28 w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-vivid-emerald)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-vivid-emerald)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gFeed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-vivid-lime)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--color-vivid-lime)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Water fill */}
          <polygon points={`0,${H} ${ptsWater} ${W},${H}`} fill="url(#gWater)" />
          {/* Feed fill */}
          <polygon points={`0,${H} ${ptsFeed} ${W},${H}`} fill="url(#gFeed)" />
          {/* Water line */}
          <polyline
            points={ptsWater}
            fill="none"
            stroke="var(--color-vivid-emerald)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0px 4px 6px rgba(16,185,129,0.3))" }}
          />
          {/* Feed line */}
          <polyline
            points={ptsFeed}
            fill="none"
            stroke="var(--color-vivid-lime)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0px 4px 6px rgba(132,204,22,0.3))" }}
          />
        </svg>
      </div>
      <div className="flex justify-between mt-2 px-1">
        {chartDays.map((d, idx) => (
          <span key={idx} className="text-[10px] text-forest-light/70 font-semibold">
            {d}
          </span>
        ))}
      </div>
      {isDemo && (
        <p className="text-[10px] text-agriAlert-orange mt-3 text-center font-semibold bg-agriAlert-orange/10 py-1.5 rounded-lg border border-agriAlert-orange/20">
          ⚠️ Insira pelo menos 2 manejos no lote para visualizar dados reais.
        </p>
      )}
    </div>
  );
};

// --- Curva de Crescimento Corporal: Real vs Padrão (Cobb 500 / Lohmann) ---
const GrowthChart = ({ historico, aptidao, dataAlojamento }) => {
  const W = 280, H = 120;
  const isPostura = aptidao === 'postura';
  const linhagemPadrao = isPostura ? 'Lohmann' : 'Cobb 500';

  // Pesagens reais registradas (idade do lote no dia x peso médio)
  const pontosReais = (dataAlojamento ? historico : [])
    .filter(r => typeof r.peso_medio_g === 'number' && r.peso_medio_g > 0)
    .map(r => {
      const dataRegistro = new Date(`${r.data_registro_str}T00:00:00`);
      const idadeDiasRegistro = Math.max(1, Math.round((dataRegistro - dataAlojamento) / (1000 * 60 * 60 * 24)) + 1);
      const eixo = isPostura ? Math.max(1, Math.ceil(idadeDiasRegistro / 7)) : idadeDiasRegistro;
      return { eixo, peso: r.peso_medio_g };
    })
    .sort((a, b) => a.eixo - b.eixo);

  if (pontosReais.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-heading font-bold text-forest-dark uppercase tracking-wide mb-3">Curva de Crescimento Corporal</p>
        <div className="h-28 flex items-center justify-center px-2">
          <p className="text-[11px] font-semibold text-agriAlert-orange bg-agriAlert-orange/10 px-3 py-2 rounded-lg border border-agriAlert-orange/20 text-center">
            ⚠️ Registre pesagens para visualizar a curva de crescimento.
          </p>
        </div>
      </div>
    );
  }

  const obterPesoPadrao = (eixo) => isPostura ? obterPesoPadraoLohmann(eixo) : obterPesoPadraoCobb500(eixo);

  const eixoMax = Math.max(...pontosReais.map(p => p.eixo), isPostura ? 18 : 7);

  // Curva guia: amostra uniforme do padrão zootécnico ao longo do eixo
  const N = 12;
  const guia = Array.from({ length: N + 1 }, (_, i) => {
    const eixo = (eixoMax / N) * i;
    return { eixo, peso: obterPesoPadrao(eixo) };
  });

  const pesoMax = Math.max(...guia.map(g => g.peso), ...pontosReais.map(p => p.peso)) * 1.1;

  const getX = (eixo) => (eixo / eixoMax) * W;
  const getY = (peso) => H - (peso / pesoMax) * H;

  const ptsGuia = guia.map(g => `${getX(g.eixo)},${getY(g.peso)}`).join(' ');
  const ptsReal = pontosReais.map(p => `${getX(p.eixo)},${getY(p.peso)}`).join(' ');

  // Desvio percentual final: último peso real vs padrão na mesma idade
  const ultimo = pontosReais[pontosReais.length - 1];
  const pesoPadraoUltimo = obterPesoPadrao(ultimo.eixo);
  const desvioFinalPct = ((ultimo.peso - pesoPadraoUltimo) / pesoPadraoUltimo) * 100;

  return (
    <div className="glass-panel rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow break-inside-avoid">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs font-heading font-bold text-forest-dark uppercase tracking-wide">Curva de Crescimento Corporal</p>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${desvioFinalPct >= 0 ? 'bg-vivid-emerald/10 text-vivid-emerald' : 'bg-agriAlert-orange/10 text-agriAlert-orange'}`}>
          {desvioFinalPct > 0 ? '+' : ''}{desvioFinalPct.toFixed(1)}% vs {linhagemPadrao}
        </span>
      </div>
      <div className="h-32 w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
          {/* Linha guia: padrão zootécnico oficial */}
          <polyline
            points={ptsGuia}
            fill="none"
            stroke="var(--color-forest-light)"
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
          {/* Linha real: pesagens registradas no lote */}
          <polyline
            points={ptsReal}
            fill="none"
            stroke="var(--color-vivid-emerald)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0px 4px 6px rgba(16,185,129,0.3))" }}
          />
          {pontosReais.map((p, i) => (
            <circle key={i} cx={getX(p.eixo)} cy={getY(p.peso)} r="3" fill="var(--color-vivid-emerald)" stroke="white" strokeWidth="1.5" />
          ))}
        </svg>
      </div>
      <div className="flex items-center justify-between mt-2 px-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-forest-light">
            <span className="w-3 border-t-2 border-dashed border-forest-light/70" />
            Padrão {linhagemPadrao}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-forest-light">
            <span className="w-2 h-2 rounded-full bg-vivid-emerald shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            Real (Lote)
          </span>
        </div>
        <span className="text-[10px] font-semibold text-forest-light/70">
          Eixo: {isPostura ? 'semanas' : 'dias'} de vida
        </span>
      </div>
    </div>
  );
};

// --- Classificação de Estresse Térmico por ITU (Índice de Temperatura e Umidade) ---
// < 74 Confortável | 74-79 Alerta | 79-84 Emergência | >= 84 Crítico
function classificarITU(itu) {
  if (itu == null || Number.isNaN(itu)) return null;
  if (itu >= 84) {
    return { nivel: 'critico', label: 'Crítico', corTexto: 'text-agriAlert-red', corFundo: 'bg-agriAlert-red/10', corBorda: 'border-agriAlert-red/40', pulsante: true };
  }
  if (itu >= 79) {
    return { nivel: 'emergencia', label: 'Emergência', corTexto: 'text-orange-600', corFundo: 'bg-orange-500/10', corBorda: 'border-orange-500/30', pulsante: false };
  }
  if (itu >= 74) {
    return { nivel: 'alerta', label: 'Alerta', corTexto: 'text-amber-600', corFundo: 'bg-amber-400/10', corBorda: 'border-amber-400/30', pulsante: false };
  }
  return { nivel: 'confortavel', label: 'Confortável', corTexto: 'text-vivid-emerald', corFundo: 'bg-vivid-emerald/10', corBorda: 'border-vivid-emerald/30', pulsante: false };
}

export default function DashboardReal({ id_fazenda, papelUsuario, onAbrirFormulario, onVoltar, onAbrirLotes, onAbrirConfiguracoes, onAbrirBI, onAbrirCalendario, onAbrirNutricao, onAbrirAgua, onAbrirFinanceiro, onAbrirRelatorios, onAbrirImportador, querPagarPro, onResetQuerPagarPro }) {
  const [lotes, setLotes] = useState(null);
  const [loteSelecionadoId, setLoteSelecionadoId] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [alertasConfig, setAlertasConfig] = useState({ mortalidade_critica: 0.15, desvio_agua: 10, desvio_racao: 8 });
  const [marcoAberto, setMarcoAberto] = useState(null);
  const [alertasRecentes, setAlertasRecentes] = useState([]);
  const [modalUpsellAberto, setModalUpsellAberto] = useState(false);
  const [avisoPermissaoBanner, setAvisoPermissaoBanner] = useState(false);
  const [previsaoClimatica, setPrevisaoClimatica] = useState(null);
  const [carregandoClima, setCarregandoClima] = useState(false);
  const [dropdownLoteAberto, setDropdownLoteAberto] = useState(false);
  const [configPesagemFazenda, setConfigPesagemFazenda] = useState(null);
  const [localizacaoFazenda, setLocalizacaoFazenda] = useState({ latitude: null, longitude: null });
  const [registrosSanitarios, setRegistrosSanitarios] = useState([]);
  const [vacinaAberta, setVacinaAberta] = useState(null);
  const [planoFazenda, setPlanoFazenda] = useState('Essencial');

  useEffect(() => {
    if (querPagarPro && (papelUsuario === 'owner' || papelUsuario === 'dono')) {
      setModalUpsellAberto(true);
      if (onResetQuerPagarPro) onResetQuerPagarPro();
    }
  }, [querPagarPro, papelUsuario, onResetQuerPagarPro]);

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

  // Carrega os limites de alerta configurados pelo dono e ouve o plano em tempo real
  useEffect(() => {
    if (!id_fazenda) return;
    
    const unsub = onSnapshot(
      doc(db, 'fazendas', id_fazenda),
      (docSnap) => {
        if (docSnap.exists()) {
          const fazenda = docSnap.data();
          if (fazenda?.alertas_config) {
            setAlertasConfig((prev) => ({ ...prev, ...fazenda.alertas_config }));
          }
          if (fazenda?.config_pesagem) {
            setConfigPesagemFazenda(fazenda.config_pesagem);
          }
          if (fazenda?.latitude != null && fazenda?.longitude != null) {
            setLocalizacaoFazenda({ latitude: fazenda.latitude, longitude: fazenda.longitude });
          }
          if (fazenda?.plano) {
            setPlanoFazenda(fazenda.plano);
          }
        }
      },
      (error) => {
        console.error('[DashboardReal] Falha no listener da fazenda:', error);
      }
    );
    
    return () => unsub();
  }, [id_fazenda]);

  // Carrega os registros sanitários (vacinas aplicadas) do lote selecionado,
  // usados nos marcos vacinais 💉 da linha do tempo e no motor de alertas.
  useEffect(() => {
    if (!id_fazenda || !loteSelecionadoId) {
      setRegistrosSanitarios([]);
      return;
    }
    let ativo = true;
    obterRegistrosSanitarios(id_fazenda, loteSelecionadoId).then((res) => {
      if (ativo) setRegistrosSanitarios(res ?? []);
    });
    return () => { ativo = false; };
  }, [id_fazenda, loteSelecionadoId]);

  // Carrega o histórico de alertas da IA, usado para o gatilho de upsell
  // (anomalia crítica bloqueada pelo plano Essencial nas últimas 24h).
  useEffect(() => {
    if (!id_fazenda) return;
    let ativo = true;
    obterAlertasEnviados(id_fazenda).then((res) => {
      if (ativo) setAlertasRecentes(res ?? []);
    });
    return () => { ativo = false; };
  }, [id_fazenda]);

  // Limpa o aviso de permissão do banner de upsell após alguns segundos.
  useEffect(() => {
    if (!avisoPermissaoBanner) return undefined;
    const timer = setTimeout(() => setAvisoPermissaoBanner(false), 3500);
    return () => clearTimeout(timer);
  }, [avisoPermissaoBanner]);

  // Carrega o histórico de registros do lote selecionado
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

  // Carrega a previsão climática preditiva (3 dias) para o lote selecionado
  useEffect(() => {
    const lote = lotes?.find((l) => l.id === loteSelecionadoId);
    if (!lote) {
      setPrevisaoClimatica(null);
      return;
    }

    let ativo = true;
    setCarregandoClima(true);

    const dataAlojamento = lote.data_alojamento instanceof Timestamp
      ? lote.data_alojamento.toDate()
      : new Date(lote.data_alojamento);
    const idade = Math.max(1, Math.floor((new Date() - dataAlojamento) / (1000 * 60 * 60 * 24)));

    obterPrevisaoClimatica(lote.linhagem, idade, localizacaoFazenda.latitude, localizacaoFazenda.longitude).then((res) => {
      if (!ativo) return;
      setPrevisaoClimatica(res);
      setCarregandoClima(false);
    });

    return () => { ativo = false; };
  }, [loteSelecionadoId, lotes, localizacaoFazenda.latitude, localizacaoFazenda.longitude]);

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


  // Achar lote ativo
  const loteAtual = lotes?.find(l => l.id === loteSelecionadoId);

  // Aptidão do lote: "corte" (padrão para compatibilidade reversa) ou "postura"
  const aptidao = loteAtual?.aptidao || "corte";

  // --- Cálculos de KPIs ---
  const qtdInicial = loteAtual?.quantidade_inicial || 0;
  const totalMortes = historico.reduce((sum, r) => sum + (r.mortalidade_qtd || 0), 0);
  const avesAtivas = Math.max(0, qtdInicial - totalMortes);
  const mortalidadeAcumulada = qtdInicial > 0 ? (totalMortes / qtdInicial) * 100 : 0;
  const totalRacaoAcumulada = historico.reduce((sum, r) => sum + (r.racao_kg || 0), 0);

  // --- Cálculos Zootécnicos Adaptativos ---
  // Corte: CA, GMD, IEP, Desvio vs Cobb 500 | Postura: % Postura, CA/Dúzia, Ovos, Desvio vs Lohmann
  let fcrExibido = "--";
  let isFcrEstimado = false;
  let gmdExibido = "--";
  let iepExibido = "--";
  let iepClassificacao = null;
  let desvioPeso = null;

  let pctPosturaExibido = "--";
  let caDuziaExibido = "--";
  let totalOvosComerciais = 0;
  let totalOvosDescarte = 0;
  let desvioPostura = null;

  let idadeDias = 0;
  let idadeSemanas = 0;
  let desvioAtualPct = null;
  let pesagemPendente = false;
  let diaAlvoPesagemPendente = null;
  let dataAlojamentoLote = null;

  if (loteAtual) {
    const dataAlojamento = loteAtual.data_alojamento instanceof Timestamp
      ? loteAtual.data_alojamento.toDate()
      : new Date(loteAtual.data_alojamento);
    dataAlojamentoLote = dataAlojamento;

    idadeDias = Math.max(1, Math.floor((new Date() - dataAlojamento) / (1000 * 60 * 60 * 24)));
    idadeSemanas = Math.floor((idadeDias - 1) / 7) + 1;

    if (historico.length > 0) {
      const totalRacao = historico.reduce((sum, r) => sum + (r.racao_kg || 0), 0);

      if (aptidao === "postura") {
        // --- KPIs de Postura (Lohmann) ---
        const ultimoRegistro = historico[historico.length - 1];
        const ovosComerciaisHoje = ultimoRegistro.producao_ovos_qtd || 0;

        if (avesAtivas > 0) {
          pctPosturaExibido = ((ovosComerciaisHoje / avesAtivas) * 100).toFixed(1);
        }

        totalOvosComerciais = historico.reduce((sum, r) => sum + (r.producao_ovos_qtd || 0), 0);
        totalOvosDescarte = historico.reduce((sum, r) => sum + (r.ovos_descarte_qtd || 0), 0);

        if (totalOvosComerciais > 0 && totalRacao > 0) {
          caDuziaExibido = (totalRacao / (totalOvosComerciais / 12)).toFixed(2);
        }

        if (avesAtivas > 0) {
          const ultimosRegistros = historico.slice(-7);
          const mediaPosturaSemana =
            ultimosRegistros.reduce((sum, r) => sum + ((r.producao_ovos_qtd || 0) / avesAtivas) * 100, 0) /
            ultimosRegistros.length;

          const pctPadrao = obterCurvaPosturaLohmann(idadeSemanas);
          const diffPct = ((mediaPosturaSemana - pctPadrao) / pctPadrao) * 100;
          desvioPostura = {
            valor: `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%`,
            isPositivo: diffPct >= 0
          };
          desvioAtualPct = diffPct;
        }
      } else {
        // --- KPIs de Corte (Cobb 500) ---
        const ultimoRegistroComPeso = [...historico].reverse().find(r => typeof r.peso_medio_g === 'number' && r.peso_medio_g > 0);
        const pesoRealG = ultimoRegistroComPeso ? ultimoRegistroComPeso.peso_medio_g : null;

        if (pesoRealG) {
           const ganhoPesoKg = avesAtivas * ((pesoRealG / 1000) - 0.042);
           if (ganhoPesoKg > 0 && totalRacao > 0) {
             fcrExibido = (totalRacao / ganhoPesoKg).toFixed(2);
           }

           const gmd = (pesoRealG - 42) / idadeDias;
           gmdExibido = gmd.toFixed(1);

           const viabilidadePct = qtdInicial > 0 ? (avesAtivas / qtdInicial) * 100 : 0;
           const caNum = parseFloat(fcrExibido);
           if (caNum > 0) {
             const iep = (viabilidadePct * gmd) / (caNum * 10);
             iepExibido = Math.round(iep).toString();
             if (iep >= 350) {
               iepClassificacao = { texto: 'Excelente', cor: 'text-vivid-emerald', bg: 'bg-vivid-emerald/10', dot: 'bg-vivid-emerald' };
             } else if (iep >= 300) {
               iepClassificacao = { texto: 'Bom', cor: 'text-vivid-lime', bg: 'bg-vivid-lime/10', dot: 'bg-vivid-lime' };
             } else {
               iepClassificacao = { texto: 'Atenção', cor: 'text-agriAlert-orange', bg: 'bg-agriAlert-orange/10', dot: 'bg-agriAlert-orange' };
             }
           }

           const pesoPadrao = obterPesoPadraoCobb500(idadeDias);
           const diffPct = ((pesoRealG - pesoPadrao) / pesoPadrao) * 100;
           desvioPeso = {
             valor: `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%`,
             isPositivo: diffPct >= 0
           };
           desvioAtualPct = diffPct;
        } else {
           isFcrEstimado = true;
           const pesoMedioKg = Math.min(3.5, 0.042 * Math.pow(1.11, idadeDias));
           const ganhoPesoKg = avesAtivas * (pesoMedioKg - 0.042);
           if (ganhoPesoKg > 0 && totalRacao > 0) {
             const fcrCalculado = totalRacao / ganhoPesoKg;
             if (fcrCalculado > 0.5 && fcrCalculado < 5.0) fcrExibido = fcrCalculado.toFixed(2);
           }
        }
      }
    }

    // --- Verificação de Pesagem Pendente (frequencia_pesagem) ---
    const freqPesagem = loteAtual.frequencia_pesagem || configPesagemFazenda?.frequencia || "semanal";
    let diasAlvoPesagem;
    if (freqPesagem === "personalizado") {
      const diasPersonalizados = (Array.isArray(loteAtual.dias_pesagem_personalizados) && loteAtual.dias_pesagem_personalizados.length > 0)
        ? loteAtual.dias_pesagem_personalizados
        : configPesagemFazenda?.dias_personalizados;
      diasAlvoPesagem = (Array.isArray(diasPersonalizados) && diasPersonalizados.length > 0)
        ? [...diasPersonalizados].filter(d => d > 0).sort((a, b) => a - b)
        : [7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84];
    } else if (freqPesagem === "diario") {
      diasAlvoPesagem = null; // toda data de registro deveria conter peso médio
    } else {
      diasAlvoPesagem = [7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84];
    }

    const ultimoAlvoAtingido = diasAlvoPesagem === null
      ? idadeDias
      : [...diasAlvoPesagem].reverse().find(d => d <= idadeDias);

    if (ultimoAlvoAtingido) {
      const dataAlvo = new Date(dataAlojamento);
      dataAlvo.setDate(dataAlvo.getDate() + (ultimoAlvoAtingido - 1));
      const dataAlvoStr = formatarDataStr(dataAlvo);

      const temPesoNoCiclo = historico.some(
        r => r.data_registro_str >= dataAlvoStr && typeof r.peso_medio_g === 'number' && r.peso_medio_g > 0
      );
      pesagemPendente = !temPesoNoCiclo;
      if (pesagemPendente) diaAlvoPesagemPendente = ultimoAlvoAtingido;
    }
  }

  // --- Painel de Viabilidade Econômica ---
  // Calculado apenas se o lote possuir dados financeiros cadastrados (Sub-sprint 14.1).
  let painelFinanceiro = null;
  if (loteAtual?.financeiro) {
    const custoPintinho = loteAtual.financeiro.custoPintinho || 0;
    const custoRacaoKg = loteAtual.financeiro.custoRacaoKg || 0;
    const precoVendaEstimado = loteAtual.financeiro.precoVendaEstimado || 0;

    const custoAcumulado = (qtdInicial * custoPintinho) + (totalRacaoAcumulada * custoRacaoKg);

    const ultimoRegistroComPeso = [...historico].reverse().find(r => typeof r.peso_medio_g === 'number' && r.peso_medio_g > 0);
    const pesoMedioEstimadoKg = (ultimoRegistroComPeso ? ultimoRegistroComPeso.peso_medio_g : obterPesoPadraoCobb500(idadeDias)) / 1000;

    const receitaEstimada = avesAtivas * pesoMedioEstimadoKg * precoVendaEstimado;

    painelFinanceiro = {
      custoAcumulado,
      receitaEstimada,
      lucroPrejuizo: receitaEstimada - custoAcumulado,
      pesoMedioEstimadoKg,
    };
  }

  // --- Motor de Alertas Local (XAI) ---
  const alertas = [];
  const hoje = historico[historico.length - 1];

  if (hoje) {
    // 1. Estresse térmico
    if (hoje.temp_max > 32.0) {
      alertas.push({
        tipo: 'perigo',
        titulo: 'Alerta Térmico',
        mensagem: `Temperatura crítica de ${hoje.temp_max}°C registrada no Lote ${loteAtual?.linhagem || ""}. Perigo de mortalidade por calor. Acione os exaustores e a nebulização agora.`
      });
    }

    // 2. Queda de consumo de água (comparado à média móvel de 3 dias dos dias anteriores)
    if (historico.length >= 4) {
      const registrosAnteriores = historico.slice(-4, -1);
      const somaAgua = registrosAnteriores.reduce((sum, r) => sum + (r.agua_litros || 0), 0);
      const mediaAguaMM = somaAgua / 3;
      
      if (mediaAguaMM > 0) {
        const quedaAgua = (mediaAguaMM - (hoje.agua_litros || 0)) / mediaAguaMM;
        if (quedaAgua > 0.10) {
          const pct = Math.round(quedaAgua * 100);
          alertas.push({
            tipo: 'aviso',
            titulo: 'Queda de Consumo de Água',
            mensagem: `O consumo de água caiu ${pct}% no Lote ${loteAtual?.linhagem || ""}. Sinal clássico de início de infecção ou entupimento de bebedouro.`
          });
        }
      }
    }

    // 3. Relação Água/Ração fora dos limites normais
    if (hoje.racao_kg > 0) {
      const ratio = (hoje.agua_litros || 0) / hoje.racao_kg;
      if (ratio < 1.6 || ratio > 2.5) {
        alertas.push({
          tipo: 'aviso',
          titulo: 'Desvio Água/Ração',
          mensagem: `Relação Água/Ração de ${ratio.toFixed(2)} está fora da faixa recomendada (1.6 a 2.5). Verifique os equipamentos.`
        });
      }
    }
  }

  // 4. Vacinas atrasadas no plano sanitário (Manejo Sanitário)
  const vacinasAtrasadas = loteAtual
    ? obterVacinasAtrasadas(aptidao === 'postura' ? 'Postura' : 'Corte', idadeDias, registrosSanitarios, loteAtual.plano_vacinal)
    : [];
  if (vacinasAtrasadas.length > 0) {
    alertas.push({
      tipo: 'aviso',
      titulo: 'Vacina(s) Atrasada(s)',
      mensagem: `${vacinasAtrasadas.map(v => v.nome).join(', ')} atrasada(s) no plano vacinal do Lote ${loteAtual?.linhagem || ""}. Registre a aplicação em Manejo Sanitário.`
    });
  }

  // --- Estresse Térmico / ITU (Sub-sprint 21.2) ---
  const ituAtual = hoje?.itu ?? calcularITU(hoje?.temp_max, hoje?.umidade_relativa);
  const classificacaoItuAtual = classificarITU(ituAtual);

  // Painel de Recomendação de Manejo Ativo: considera o ITU atual (lotes com
  // mais de 14 dias) e, na ausência de alerta atual, a previsão dos próximos dias.
  let recomendacaoManejo = null;
  if (idadeDias > 14) {
    const MENSAGENS_ITU = {
      critico: (itu) => `🚨 ITU Crítico (${itu}): Risco extremo de mortalidade por calor! Nebulizadores devem estar ligados, evite manuseio das aves e reduza a densidade de cortinas.`,
      emergencia: (itu) => `🔥 ITU de Emergência (${itu}): Risco alto de estresse térmico. Acione nebulizadores, maximize a exaustão e monitore as aves continuamente.`,
      alerta: (itu) => `⚠️ ITU de Alerta (${itu}): Risco moderado de estresse térmico. Ligue exaustores nas horas mais quentes e verifique vazão de bebedouros.`,
    };

    if (classificacaoItuAtual && classificacaoItuAtual.nivel !== 'confortavel') {
      recomendacaoManejo = {
        ...classificacaoItuAtual,
        itu: ituAtual,
        previsto: false,
        mensagem: MENSAGENS_ITU[classificacaoItuAtual.nivel](ituAtual),
      };
    } else if (previsaoClimatica?.previsoes?.length) {
      for (const dia of previsaoClimatica.previsoes) {
        const classificacaoDia = classificarITU(dia.itu);
        if (classificacaoDia && classificacaoDia.nivel !== 'confortavel') {
          recomendacaoManejo = {
            ...classificacaoDia,
            itu: dia.itu,
            previsto: true,
            data: dia.data_curta,
            mensagem: `${MENSAGENS_ITU[classificacaoDia.nivel](dia.itu)} (Previsão para ${dia.data_curta})`,
          };
          break;
        }
      }
    }
  }

  // --- Cor Dinâmica da Linha de Eficiência (Verde/Laranja/Vermelho) ---
  const limiteMortalidadeCritica = (alertasConfig.mortalidade_critica || 0.15) * 100;
  const temAlertaConsumo = alertas.some(a => a.tipo === 'aviso');

  let corLinha = 'verde';
  if (mortalidadeAcumulada > limiteMortalidadeCritica || (desvioAtualPct !== null && desvioAtualPct < -12)) {
    corLinha = 'vermelho';
  } else if (temAlertaConsumo || (desvioAtualPct !== null && desvioAtualPct < -5)) {
    corLinha = 'laranja';
  }

  const CORES_LINHA = {
    verde: { linha: 'bg-vivid-emerald/30', marco: 'border-vivid-emerald bg-white shadow-[0_0_15px_rgba(16,185,129,0.4)]', texto: 'text-vivid-emerald', label: 'Eficiência Ideal' },
    laranja: { linha: 'bg-agriAlert-orange/30', marco: 'border-agriAlert-orange bg-white shadow-[0_0_15px_rgba(245,158,11,0.4)]', texto: 'text-agriAlert-orange', label: 'Atenção' },
    vermelho: { linha: 'bg-agriAlert-red/30', marco: 'border-agriAlert-red bg-white shadow-[0_0_15px_rgba(239,68,68,0.4)]', texto: 'text-agriAlert-red', label: 'Alerta Crítico' },
  };

  // --- Gatilho de Upsell: anomalia crítica bloqueada pelo Plano Essencial ---
  // Verifica se há, nas últimas 24h, algum alerta da IA para o lote ativo que
  // não pôde ser enviado ao WhatsApp por restrição de plano.
  const VINTE_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;
  const alertaBloqueadoCritico = normalizarPlano(planoFazenda) !== 'Inteligente' && alertasRecentes.find((alerta) => {
    if (alerta.status_envio !== 'bloqueado_plano') return false;
    if (alerta.id_lote !== loteSelecionadoId) return false;
    const dataEnvio = typeof alerta.data_envio?.toDate === 'function' ? alerta.data_envio.toDate() : null;
    if (!dataEnvio) return false;
    return (Date.now() - dataEnvio.getTime()) <= VINTE_QUATRO_HORAS_MS;
  });

  function handleClickBannerUpsell() {
    if (papelUsuario === 'dono' || papelUsuario === 'owner') {
      setModalUpsellAberto(true);
    } else {
      setAvisoPermissaoBanner(true);
    }
  }

  // --- Marcos do Ciclo Adaptados à Aptidão do Lote ---
  const marcos = aptidao === 'postura' ? MARCOS_POSTURA : MARCOS_CORTE;
  const idadeCiclo = aptidao === 'postura' ? idadeSemanas : idadeDias;

  // Plano vacinal adaptado (marcos interativos 💉 na linha do tempo)
  const planoVacinal = loteAtual?.plano_vacinal || VACINAS_PADRAO[aptidao === 'postura' ? 'Postura' : 'Corte'] || VACINAS_PADRAO.Corte;

  const [menuAberto, setMenuAberto] = useState(false);

  const handleExportarCSV = () => {
    if (!historico || historico.length === 0) {
      alert("Não há dados para exportar neste lote.");
      return;
    }
    const header = "Data,Agua (L),Racao (kg),Mortalidade,Temp Max,Temp Min\n";
    const rows = historico.map(r => {
      return `${r.data_registro_str},${r.agua_litros||0},${r.racao_kg||0},${r.mortalidade_qtd||0},${r.temp_max||''},${r.temp_min||''}`;
    }).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + header + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_lote_${loteSelecionadoId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImprimirRelatorio = () => {
    window.print();
  };
  return (
    <div className="flex h-full w-full bg-offwhite text-forest-dark relative z-10 overflow-hidden font-sans">
      {/* --- SIDEBAR (Desktop e Mobile Drawer) --- */}
      

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/20">
        
        {/* Topbar */}
        <header className="no-print flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5 bg-white/30 backdrop-blur-md border-b border-white/50 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 -ml-2 text-forest-dark hover:bg-white/50 rounded-xl" onClick={() => setMenuAberto(true)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h1 className="text-lg lg:text-xl font-heading font-bold text-forest-dark tracking-tight leading-none">
                Olá, Produtor 👋
              </h1>
              <p className="hidden sm:block text-xs font-semibold text-forest-light/80 mt-1 uppercase tracking-wider">
                Sua visão geral de hoje
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
             {/* Lote Selector Custom (Premium Dropdown) */}
             {lotes && lotes.length > 0 ? (
               <div className="relative">
                 <button
                   onClick={() => setDropdownLoteAberto(!dropdownLoteAberto)}
                   className="flex items-center justify-between min-w-[140px] rounded-xl border border-white/60 bg-white/50 px-4 py-2 text-sm sm:text-base font-bold text-forest-dark shadow-sm hover:border-vivid-emerald/50 focus:outline-none transition-all backdrop-blur-md cursor-pointer"
                 >
                   <span>Lote: {lotes.find(l => l.id === loteSelecionadoId)?.linhagem || "Selecione"}</span>
                   <svg className={`h-4 w-4 ml-3 text-forest-light transition-transform ${dropdownLoteAberto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                 </button>
                 
                 {/* Dropdown Menu */}
                 {dropdownLoteAberto && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setDropdownLoteAberto(false)} />
                     <div className="absolute right-0 mt-2 w-full min-w-[160px] bg-white/95 backdrop-blur-xl border border-white/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] z-50 overflow-hidden animate-slideDown origin-top-right">
                       {lotes.map((l) => (
                         <button
                           key={l.id}
                           onClick={() => {
                             setLoteSelecionadoId(l.id);
                             setDropdownLoteAberto(false);
                           }}
                           className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors ${l.id === loteSelecionadoId ? 'bg-vivid-emerald/10 text-vivid-emerald' : 'text-forest-dark hover:bg-black/5'}`}
                         >
                           {l.linhagem}
                         </button>
                       ))}
                     </div>
                   </>
                 )}
               </div>
             ) : (
               <button onClick={onAbrirLotes} className="rounded-xl border border-agriAlert-orange/40 bg-agriAlert-orange/10 px-4 py-2 text-sm font-bold text-agriAlert-orange shadow-sm hover:bg-agriAlert-orange/20 transition-colors animate-pulse">
                 Sem Lotes - Criar Lote
               </button>
             )}
             

             {/* Lotes & Configurações Buttons */}
             <div className="flex items-center gap-2 no-print">
               <button 
                 onClick={handleExportarCSV}
                 title="Exportar CSV"
                 className="hidden md:flex p-2 rounded-xl glass-panel border border-white/60 hover:border-vivid-emerald/50 hover:shadow-md transition-all text-forest-dark"
               >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
               </button>
               <button 
                 onClick={handleImprimirRelatorio}
                 title="Imprimir Relatório (PDF)"
                 className="hidden md:flex p-2 rounded-xl glass-panel border border-white/60 hover:border-vivid-emerald/50 hover:shadow-md transition-all text-forest-dark"
               >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
               </button>
               <button 
                 onClick={onAbrirLotes}
                 title="Gestão de Lotes"
                 className="p-2 rounded-xl glass-panel border border-white/60 hover:border-vivid-emerald/50 hover:shadow-md transition-all text-forest-dark"
               >
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
               </button>
               {papelUsuario !== "peao" && papelUsuario !== "operator" && (
                 <button
                   onClick={onAbrirConfiguracoes}
                   title="Configurações da Fazenda"
                   className="p-2 rounded-xl glass-panel border border-white/60 hover:border-vivid-emerald/50 hover:shadow-md transition-all text-forest-dark"
                 >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                 </button>
               )}
             </div>

             <button
               onClick={onAbrirFormulario}
               className="no-print hidden sm:flex items-center gap-2 rounded-xl bg-gradient-to-r from-vivid-emerald to-vivid-lime px-4 py-2 text-sm font-bold text-white shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] hover:scale-105 transition-transform"
             >
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
               Manejo
             </button>
          </div>
        </header>

        {/* Cabeçalho exclusivo para impressão (Relatório PDF) */}
        <div className="print-only hidden px-4 lg:px-8 pt-4">
          <h1 className="text-xl font-heading font-extrabold">Relatório de Manejo — {loteAtual?.linhagem || "Lote"}</h1>
          <p className="text-xs mt-1">
            {aptidao === 'postura' ? 'Postura' : 'Corte'} · Idade do Lote: {idadeDias} dias · Gerado em {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>

        {/* Banner de Upsell: Anomalia Crítica bloqueada pelo Plano Essencial */}
        {alertaBloqueadoCritico && (
          <div className="no-print px-4 lg:px-8 pt-4">
            <button
              type="button"
              onClick={handleClickBannerUpsell}
              className="w-full text-left rounded-2xl border border-agriAlert-red/30 bg-gradient-to-r from-agriAlert-red/15 via-agriAlert-orange/10 to-agriAlert-red/15 backdrop-blur-md shadow-[0_0_25px_-5px_rgba(239,68,68,0.5)] px-4 py-3.5 flex items-center gap-3 animate-pulse hover:animate-none hover:shadow-[0_0_25px_-2px_rgba(239,68,68,0.6)] transition-shadow"
            >
              <span className="text-2xl shrink-0">⚠️</span>
              <p className="text-xs sm:text-sm font-bold text-agriAlert-red leading-relaxed">
                Anomalia Crítica Detectada! A IA detectou desvios no Lote {loteAtual?.linhagem || ""} hoje.{' '}
                <span className="underline decoration-2 underline-offset-2">Clique aqui para ativar o Plano Pro</span>{' '}
                e liberar o envio automático via WhatsApp para seu veterinário.
              </p>
            </button>
            {avisoPermissaoBanner && (
              <p className="mt-2 text-[10px] font-semibold text-forest-light/80 bg-white/60 border border-white/60 rounded-lg px-2.5 py-1.5 text-center">
                Apenas administradores podem gerenciar o plano da fazenda.
              </p>
            )}
          </div>
        )}

        {/* Banner de Pesagem Pendente */}
        {pesagemPendente && (
          <div className="no-print px-4 lg:px-8 pt-4">
            <div className="rounded-2xl border border-agriAlert-orange/30 bg-agriAlert-orange/10 backdrop-blur-md px-4 py-3.5 flex items-center gap-3 shadow-sm animate-pulse">
              <span className="text-2xl shrink-0">⚖️</span>
              <p className="text-xs sm:text-sm font-bold text-agriAlert-orange leading-relaxed">
                Pesagem pendente para o Dia {diaAlvoPesagemPendente}. Registre o peso médio para atualizar os índices.
              </p>
            </div>
          </div>
        )}

        {/* Dashboard Scrollable Body */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {carregando ? (
            <div className="flex flex-col items-center justify-center h-64 text-forest-light space-y-4">
              <div className="w-10 h-10 rounded-full border-4 border-vivid-emerald/20 border-t-vivid-emerald animate-spin shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
              <span className="text-sm font-bold tracking-wide uppercase">Sincronizando...</span>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto space-y-6 pb-24 lg:pb-0">

              {/* Previsão Climática Preditiva */}
              {carregandoClima && !previsaoClimatica && (
                <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm animate-pulse">
                  <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest">Carregando previsão climática...</p>
                </div>
              )}
              {previsaoClimatica && (
                <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-heading font-bold text-forest-dark">
                        Previsão Climática Preditiva - {previsaoClimatica.cidade}
                      </p>
                      <p className="text-[10px] text-forest-light font-medium mt-0.5">
                        Faixa ideal para a idade: {previsaoClimatica.conforto_atual.min}°C a {previsaoClimatica.conforto_atual.max}°C
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalUpsellAberto(true)}
                      className="no-print text-[11px] font-bold text-vivid-emerald bg-vivid-emerald/10 border border-vivid-emerald/30 px-3 py-1.5 rounded-full hover:bg-vivid-emerald/20 transition-colors whitespace-nowrap"
                    >
                      💬 Receber alertas no WhatsApp
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3 sm:grid sm:grid-cols-3">
                    {previsaoClimatica?.previsoes?.map((dia) => {
                      const estilos = {
                        critico: 'bg-agriAlert-red/10 border-agriAlert-red/30 text-agriAlert-red animate-pulse',
                        alerta: 'bg-agriAlert-orange/10 border-agriAlert-orange/20 text-agriAlert-orange',
                        normal: 'bg-vivid-emerald/5 border-vivid-emerald/15 text-forest-dark',
                      };
                      const classificacaoDia = classificarITU(dia.itu);
                      return (
                        <div key={dia.data_str} className={`flex-1 min-w-[150px] rounded-xl border p-3 ${estilos[dia.severidade] || estilos.normal}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold uppercase tracking-wide">{dia.data_curta}</span>
                            <span className="text-xs font-bold">{dia.temp_min}° / {dia.temp_max}°</span>
                          </div>
                          {classificacaoDia && (
                            <div className={`inline-flex items-center gap-1 mb-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${classificacaoDia.corFundo} ${classificacaoDia.corTexto}`}>
                              ITU {dia.itu} · {classificacaoDia.label}
                            </div>
                          )}
                          <p className="text-[11px] font-semibold leading-relaxed">
                            {dia.alerta || "Temperatura dentro da faixa de conforto. Nenhuma ação necessária."}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Card de Estresse Térmico / ITU */}
              {classificacaoItuAtual && (
                <div className={`reveal-left glass-panel rounded-2xl p-5 shadow-sm border ${classificacaoItuAtual.corBorda} ${classificacaoItuAtual.corFundo} ${classificacaoItuAtual.pulsante ? 'animate-pulse' : ''}`}>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Índice de Temperatura e Umidade (ITU)</p>
                      <div className="flex items-baseline gap-2">
                        <p className={`text-4xl font-heading font-extrabold leading-none ${classificacaoItuAtual.corTexto}`}>{ituAtual}</p>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${classificacaoItuAtual.corFundo} ${classificacaoItuAtual.corTexto} ${classificacaoItuAtual.corBorda}`}>
                          {classificacaoItuAtual.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-forest-light font-medium mt-1.5">
                        Último registro: Temp. máx. {hoje?.temp_max}°C · Umidade {hoje?.umidade_relativa}%
                      </p>
                    </div>
                    <div className="text-3xl shrink-0">
                      {classificacaoItuAtual.nivel === 'critico' ? '🚨' : classificacaoItuAtual.nivel === 'emergencia' ? '🔥' : classificacaoItuAtual.nivel === 'alerta' ? '⚠️' : '🌬️'}
                    </div>
                  </div>
                </div>
              )}

              {/* Painel de Recomendação de Manejo Ativo (ITU em alerta/emergência/crítico) */}
              {recomendacaoManejo && (
                <div className={`reveal-left glass-panel rounded-2xl p-5 shadow-sm border space-y-1.5 ${recomendacaoManejo.corBorda} ${recomendacaoManejo.corFundo} ${recomendacaoManejo.pulsante ? 'animate-pulse' : ''}`}>
                  <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest">Recomendação de Manejo Ativo</p>
                  <p className={`text-sm font-bold leading-relaxed ${recomendacaoManejo.corTexto}`}>
                    {recomendacaoManejo.mensagem}
                  </p>
                </div>
              )}

              {/* Main KPIs Row */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                 {/* Card 1: Aves */}
                 <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform">
                   <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Aves Ativas</p>
                   <p className="text-3xl font-heading font-extrabold text-forest-dark leading-none">{avesAtivas.toLocaleString("pt-BR")}</p>
                   <p className="text-[10px] font-semibold text-vivid-emerald mt-2 bg-vivid-emerald/10 inline-flex items-center gap-1 px-2 py-0.5 rounded-md w-max">
                      <span className="w-1.5 h-1.5 rounded-full bg-vivid-emerald animate-pulse" /> Lote Ativo
                   </p>
                 </div>
                 {/* Card 2: Mortalidade */}
                 <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform">
                   <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Mortalidade Acum.</p>
                   <p className="text-3xl font-heading font-extrabold text-forest-dark leading-none">{mortalidadeAcumulada.toFixed(2)}%</p>
                   <p className="text-[10px] font-semibold text-agriAlert-green mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                      Dentro da meta
                   </p>
                 </div>
                 {/* Card 3: Idade */}
                 <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform col-span-2 lg:col-span-1">
                   <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Idade do Lote</p>
                   <p className="text-3xl font-heading font-extrabold text-forest-dark leading-none">
                     {idadeDias} <span className="text-xl">dias</span>
                   </p>
                   <p className="text-[10px] font-semibold text-forest-light/80 mt-2">
                      Ciclo de terminação
                   </p>
                 </div>
              </div>

              {/* Zootecnia de Elite KPIs (Adaptativo: Corte vs Postura) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {aptidao === "postura" ? (
                  <>
                    {/* % Postura Diária & Desvio Lohmann */}
                    <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform relative overflow-hidden border border-vivid-emerald/20">
                       <div className="absolute -right-6 -top-6 w-24 h-24 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none" />
                       <div className="flex justify-between items-start">
                         <div>
                           <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5">% Postura Diária</p>
                           <p className="text-3xl font-heading font-extrabold text-forest-dark leading-none">{pctPosturaExibido}{pctPosturaExibido !== "--" ? "%" : ""}</p>
                         </div>
                         {desvioPostura && (
                           <div className="flex flex-col items-end">
                             <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${desvioPostura.isPositivo ? 'bg-vivid-emerald/10 text-vivid-emerald' : 'bg-agriAlert-orange/10 text-agriAlert-orange'}`}>
                               {desvioPostura.valor}
                             </span>
                             <span className="text-[8px] text-forest-light/70 font-semibold uppercase mt-0.5 tracking-wider">vs Lohmann</span>
                           </div>
                         )}
                       </div>
                       {!desvioPostura && <p className="text-[9px] font-semibold text-agriAlert-orange mt-2 flex items-center gap-1">⚠️ Dados insuficientes</p>}
                    </div>
                    {/* CA por Dúzia de Ovos */}
                    <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform relative overflow-hidden border border-vivid-emerald/20">
                       <div className="absolute -right-6 -top-6 w-24 h-24 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none" />
                       <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Conversão (CA/Dúzia)</p>
                       <p className="text-3xl font-heading font-extrabold text-forest-dark leading-none">{caDuziaExibido} <span className="text-base font-semibold text-forest-light">kg/dz</span></p>
                       {caDuziaExibido === "--" ? (
                         <p className="text-[9px] font-semibold text-agriAlert-orange mt-2 flex items-center gap-1">⚠️ Sem ovos registrados</p>
                       ) : (
                         <p className="text-[10px] font-semibold text-vivid-emerald mt-2 flex items-center gap-1">Calculado do histórico</p>
                       )}
                    </div>
                    {/* Total de Ovos Coletados */}
                    <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform relative overflow-hidden border border-vivid-emerald/20">
                       <div className="absolute -right-6 -top-6 w-24 h-24 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none" />
                       <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Ovos Coletados (Total)</p>
                       <p className="text-3xl font-heading font-extrabold text-forest-dark leading-none">{(totalOvosComerciais + totalOvosDescarte).toLocaleString('pt-BR')}</p>
                       <p className="text-[10px] font-semibold mt-2 flex items-center gap-3">
                         <span className="text-vivid-emerald font-bold">Comerciais: {totalOvosComerciais.toLocaleString('pt-BR')}</span>
                         <span className="text-agriAlert-orange font-bold">Descarte: {totalOvosDescarte.toLocaleString('pt-BR')}</span>
                       </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* FCR */}
                    <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform relative overflow-hidden border border-vivid-emerald/20">
                       <div className="absolute -right-6 -top-6 w-24 h-24 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none" />
                       <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                         Conversão (CA) {isFcrEstimado && <span className="bg-agriAlert-orange/10 text-agriAlert-orange px-1.5 py-0.5 rounded text-[8px] animate-pulse">ESTIMADO</span>}
                       </p>
                       <p className="text-3xl font-heading font-extrabold text-forest-dark leading-none">{fcrExibido}</p>
                       {isFcrEstimado ? (
                         <p className="text-[9px] font-semibold text-agriAlert-orange mt-2 flex items-center gap-1">⚠️ Pese as aves p/ cálculo real</p>
                       ) : (
                         <p className="text-[10px] font-semibold text-vivid-emerald mt-2 flex items-center gap-1">Calculado do histórico</p>
                       )}
                    </div>
                    {/* GMD & Desvio */}
                    <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform relative overflow-hidden border border-vivid-emerald/20">
                       <div className="absolute -right-6 -top-6 w-24 h-24 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none" />
                       <div className="flex justify-between items-start">
                         <div>
                           <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Ganho (GMD)</p>
                           <p className="text-3xl font-heading font-extrabold text-forest-dark leading-none">{gmdExibido} <span className="text-base font-semibold text-forest-light">g/dia</span></p>
                         </div>
                         {desvioPeso && (
                           <div className="flex flex-col items-end">
                             <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${desvioPeso.isPositivo ? 'bg-vivid-emerald/10 text-vivid-emerald' : 'bg-agriAlert-orange/10 text-agriAlert-orange'}`}>
                               {desvioPeso.valor}
                             </span>
                             <span className="text-[8px] text-forest-light/70 font-semibold uppercase mt-0.5 tracking-wider">vs Cobb 500</span>
                           </div>
                         )}
                       </div>
                       {!desvioPeso && <p className="text-[9px] font-semibold text-agriAlert-orange mt-2 flex items-center gap-1">⚠️ Sem amostra de peso</p>}
                    </div>
                    {/* IEP */}
                    <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm hover:scale-[1.02] transition-transform relative overflow-hidden border border-vivid-emerald/20">
                       <div className="absolute -right-6 -top-6 w-24 h-24 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none" />
                       <div className="flex justify-between items-start">
                         <div>
                           <p className="text-[10px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Índice (IEP)</p>
                           <p className="text-3xl font-heading font-extrabold text-forest-dark leading-none">{iepExibido}</p>
                         </div>
                         {iepClassificacao && (
                           <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${iepClassificacao.bg} ${iepClassificacao.cor} flex items-center gap-1`}>
                             <span className={`w-1.5 h-1.5 rounded-full ${iepClassificacao.dot} animate-pulse`} />
                             {iepClassificacao.texto}
                           </span>
                         )}
                       </div>
                       {!iepClassificacao && <p className="text-[9px] font-semibold text-agriAlert-orange mt-2 flex items-center gap-1">⚠️ Dados insuficientes</p>}
                    </div>
                  </>
                )}
              </div>

              {/* Painel de Viabilidade Econômica */}
              {papelUsuario !== 'peao' && papelUsuario !== 'operator' && (
                <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div>
                      <p className="text-[10px] font-heading font-bold text-forest-dark uppercase tracking-wide">Viabilidade Econômica</p>
                      <p className="text-[10px] text-forest-light font-medium mt-0.5">Estimativa em tempo real do ciclo atual</p>
                    </div>
                    {painelFinanceiro && (
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${painelFinanceiro.lucroPrejuizo >= 0 ? 'bg-vivid-emerald/10 text-vivid-emerald' : 'bg-agriAlert-red/10 text-agriAlert-red'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${painelFinanceiro.lucroPrejuizo >= 0 ? 'bg-vivid-emerald' : 'bg-agriAlert-red'}`} />
                        {painelFinanceiro.lucroPrejuizo >= 0 ? 'Lucro Projetado' : 'Prejuízo Projetado'}
                      </span>
                    )}
                  </div>

                  {!painelFinanceiro ? (
                    <div className="rounded-xl border-2 border-dashed border-forest-light/20 p-4 text-center">
                      <p className="text-xs font-semibold text-forest-light">
                        Cadastre o custo do pintinho, da ração e o preço de venda estimado em Gestão de Lotes para acompanhar o lucro do ciclo em tempo real.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="glass-panel p-4 rounded-xl border border-white/60 shadow-sm bg-white/40">
                        <p className="text-[9px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Custo Acumulado</p>
                        <p className="text-2xl font-heading font-extrabold text-forest-dark leading-none">{formatarMoeda(painelFinanceiro.custoAcumulado)}</p>
                        <p className="text-[10px] font-semibold text-forest-light/80 mt-2">Pintinhos + ração consumida</p>
                      </div>
                      <div className="glass-panel p-4 rounded-xl border border-white/60 shadow-sm bg-white/40">
                        <p className="text-[9px] font-bold text-forest-light uppercase tracking-widest mb-1.5">Receita Estimada</p>
                        <p className="text-2xl font-heading font-extrabold text-forest-dark leading-none">{formatarMoeda(painelFinanceiro.receitaEstimada)}</p>
                        <p className="text-[10px] font-semibold text-forest-light/80 mt-2">~{painelFinanceiro.pesoMedioEstimadoKg.toFixed(2)} kg/ave viva</p>
                      </div>
                      <div className={`p-4 rounded-xl border shadow-sm relative overflow-hidden ${
                        painelFinanceiro.lucroPrejuizo >= 0
                          ? 'border-vivid-emerald/40 bg-gradient-to-br from-vivid-emerald/15 to-vivid-lime/5 shadow-[0_0_20px_-5px_rgba(16,185,129,0.5)]'
                          : 'border-agriAlert-red/30 bg-gradient-to-br from-agriAlert-red/10 to-agriAlert-orange/10'
                      }`}>
                        <p className={`text-[9px] font-bold uppercase tracking-widest mb-1.5 ${painelFinanceiro.lucroPrejuizo >= 0 ? 'text-vivid-emerald' : 'text-agriAlert-red'}`}>
                          {painelFinanceiro.lucroPrejuizo >= 0 ? 'Lucro do Ciclo' : 'Prejuízo do Ciclo'}
                        </p>
                        <p className={`text-2xl font-heading font-extrabold leading-none ${painelFinanceiro.lucroPrejuizo >= 0 ? 'text-vivid-emerald' : 'text-agriAlert-red'}`}>
                          {formatarMoeda(painelFinanceiro.lucroPrejuizo)}
                        </p>
                        <p className={`text-[10px] font-semibold mt-2 ${painelFinanceiro.lucroPrejuizo >= 0 ? 'text-vivid-emerald/80' : 'text-agriAlert-red/80'}`}>
                          Receita - Custo acumulado
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Middle Area: Chart & Kanban/Insights */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Side: Chart (2 cols on Desktop) */}
                <div className="lg:col-span-2 space-y-6">
                   <LineChart historico={historico} id_fazenda={id_fazenda} onAbrirFormulario={onAbrirFormulario} />

                   {loteAtual && (
                     <GrowthChart historico={historico} aptidao={aptidao} dataAlojamento={dataAlojamentoLote} />
                   )}

                   {/* Kanban / Tasks Preview */}
                   <div className="glass-panel rounded-2xl p-5 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                         <div>
                            <p className="text-sm font-heading font-bold text-forest-dark uppercase tracking-wide">Tarefas de Manejo</p>
                            <p className="text-[10px] text-forest-light font-medium mt-0.5">Rotina baseada na idade do lote</p>
                         </div>
                         <span className="bg-white/50 text-[10px] font-bold text-forest-dark px-3 py-1 rounded-full border border-white/60 w-max">Rotina Padrão</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         {/* A Fazer */}
                         <div className="bg-white/30 border border-white/50 rounded-xl p-3 space-y-3">
                            <div className="flex justify-between items-center px-1">
                               <p className="text-xs font-bold text-forest-dark">A Fazer</p>
                               <span className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded text-forest-light font-bold">2</span>
                            </div>
                            <div className="bg-white/80 border border-white p-3 rounded-lg shadow-sm hover:border-vivid-emerald/40 cursor-pointer transition-colors">
                               <p className="text-xs font-bold text-forest-dark">Checagem de Exaustores</p>
                               <div className="flex justify-between items-center mt-3">
                                  <span className="text-[9px] bg-agriAlert-orange/10 text-agriAlert-orange font-bold px-2 py-0.5 rounded-full">Alta</span>
                                  <span className="text-[9px] font-medium text-forest-light">Hoje 14h</span>
                               </div>
                            </div>
                            <div className="bg-white/80 border border-white p-3 rounded-lg shadow-sm hover:border-vivid-emerald/40 cursor-pointer transition-colors">
                               <p className="text-xs font-bold text-forest-dark">Coleta de mortalidade</p>
                               <div className="flex justify-between items-center mt-3">
                                  <span className="text-[9px] bg-forest-light/10 text-forest-light font-bold px-2 py-0.5 rounded-full">Normal</span>
                                  <span className="text-[9px] font-medium text-forest-light">Fim do dia</span>
                               </div>
                            </div>
                         </div>
                         {/* Concluído */}
                         <div className="bg-white/30 border border-white/50 rounded-xl p-3 space-y-3">
                            <div className="flex justify-between items-center px-1">
                               <p className="text-xs font-bold text-forest-dark">Concluído</p>
                               <span className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded text-forest-light font-bold">1</span>
                            </div>
                            <div className="bg-white/50 border border-white p-3 rounded-lg shadow-sm opacity-70">
                               <div className="flex justify-between">
                                  <p className="text-xs font-bold text-forest-dark line-through decoration-forest-light/40">Registro matinal</p>
                                  <span className="text-agriAlert-green">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
                                  </span>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Right Side: AI & Workload */}
                <div className="lg:col-span-1 space-y-6">
                   {/* AI Insights Card */}
                   <div className="reveal-left rounded-2xl p-[1px] bg-gradient-to-br from-vivid-emerald/50 to-vivid-lime/20 shadow-lg relative overflow-hidden">
                     <div className="bg-gradient-to-br from-forest-dark to-forest w-full h-full rounded-2xl p-5 relative">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-vivid-emerald/10 rounded-full blur-2xl pointer-events-none" />
                       <div className="absolute bottom-0 left-0 w-24 h-24 bg-vivid-lime/10 rounded-full blur-2xl pointer-events-none" />
                       
                       <div className="flex items-center gap-3 mb-5 relative z-10">
                         <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                           <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-vivid-emerald" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                             <path d="M12 2a5 5 0 0 1 5 5v2a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5Z" />
                             <path d="M12 14v4m-4 2h8" />
                           </svg>
                         </div>
                         <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-vivid-emerald drop-shadow-sm">IA Local XAI</p>
                       </div>

                       <div className="relative z-10">
                         {alertas.length > 0 ? (
                           <div className="space-y-3">
                             {alertas.map((alerta, idx) => (
                               <div key={idx} className={`rounded-xl p-3.5 border backdrop-blur-sm ${alerta.tipo === 'perigo' ? 'bg-agriAlert-red/10 border-agriAlert-red/30' : 'bg-agriAlert-orange/10 border-agriAlert-orange/30'}`}>
                                 <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${alerta.tipo === 'perigo' ? 'text-agriAlert-red' : 'text-agriAlert-orange'}`}>{alerta.titulo}</p>
                                 <p className="text-sm font-medium leading-relaxed text-offwhite/90">{alerta.mensagem}</p>
                               </div>
                             ))}
                           </div>
                         ) : (
                           <div className="bg-white/5 rounded-xl p-4 border border-white/10 backdrop-blur-md">
                             <div className="flex gap-3 items-start">
                               <span className="text-xl">✨</span>
                               <div>
                                 <p className="text-sm font-heading font-bold text-white mb-1">Tudo sob controle</p>
                                 <p className="text-xs font-medium leading-relaxed text-white/70">Nenhuma anomalia sanitária ou de consumo detectada. Curva de crescimento ideal.</p>
                               </div>
                             </div>
                           </div>
                         )}
                       </div>
                     </div>
                   </div>

                   {/* Activity List */}
                   <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm hidden sm:block">
                      <p className="text-[10px] font-heading font-bold text-forest-dark uppercase tracking-wide mb-4">Atividade Recente</p>
                      <div className="space-y-4">
                         <div className="flex items-start gap-3">
                            <span className="mt-1 w-2 h-2 rounded-full bg-vivid-emerald shrink-0"></span>
                            <p className="text-xs font-medium text-forest-light leading-relaxed">Manejo de água e ração registrado com sucesso via offline sync.</p>
                         </div>
                         <div className="flex items-start gap-3">
                            <span className="mt-1 w-2 h-2 rounded-full bg-agriAlert-green shrink-0"></span>
                            <p className="text-xs font-medium text-forest-light leading-relaxed">Taxa de mortalidade ajustada abaixo do limite histórico da linhagem.</p>
                         </div>
                      </div>
                   </div>

                </div>
              </div>

              {/* Bottom Row: Linha de Eficiência Inteligente */}
              <div className="reveal-left glass-panel rounded-2xl p-5 shadow-sm mt-6">
                 <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                   <p className="text-[10px] font-heading font-bold text-forest-dark uppercase tracking-wide">Linha de Eficiência Inteligente</p>
                   <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${CORES_LINHA[corLinha].texto} ${corLinha === 'verde' ? 'bg-vivid-emerald/10' : corLinha === 'laranja' ? 'bg-agriAlert-orange/10' : 'bg-agriAlert-red/10'} flex items-center gap-1.5`}>
                     <span className={`w-1.5 h-1.5 rounded-full ${corLinha === 'verde' ? 'bg-vivid-emerald' : corLinha === 'laranja' ? 'bg-agriAlert-orange' : 'bg-agriAlert-red'} animate-pulse`} />
                     {CORES_LINHA[corLinha].label}
                   </span>
                 </div>
                 <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-0">
                    <div className={`hidden md:block absolute left-8 right-8 top-3 h-1 rounded-full ${CORES_LINHA[corLinha].linha}`}></div>

                    {marcos.map((marco, i) => {
                      const done = idadeCiclo > marco.fim;
                      const active = idadeCiclo >= marco.ini && idadeCiclo <= marco.fim;
                      const unidade = aptidao === 'postura' ? 'Semana' : 'Dia';
                      const periodo = marco.ini === marco.fim ? `${unidade} ${marco.ini}` : `${unidade}s ${marco.ini}-${marco.fim}`;
                      const isOpen = marcoAberto === i;
                      return (
                      <div key={i} className={`relative ${isOpen ? 'z-30' : 'z-10'} flex flex-col w-full md:w-auto`}>
                        <div className="flex md:flex-col items-center gap-3 md:gap-2 w-full">
                           <button
                             type="button"
                             onClick={() => setMarcoAberto(marcoAberto === i ? null : i)}
                             className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-shadow ${done ? 'border-vivid-emerald bg-vivid-emerald text-white' : active ? CORES_LINHA[corLinha].marco : 'border-white/60 bg-offwhite'}`}
                           >
                              {done && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>}
                           </button>
                           <button type="button" onClick={() => setMarcoAberto(marcoAberto === i ? null : i)} className="flex flex-col items-start md:items-center text-left md:text-center">
                             <span className={`text-xs font-bold ${active ? (corLinha === 'verde' ? 'text-vivid-emerald' : corLinha === 'laranja' ? 'text-agriAlert-orange' : 'text-agriAlert-red') : done ? 'text-forest-dark' : 'text-forest-light'}`}>{marco.nome}</span>
                             <span className="text-[9px] text-forest-light/70 font-semibold">{periodo}</span>
                           </button>
                        </div>
                        {marcoAberto === i && (
                          <div className="mt-3 md:absolute md:top-10 md:mt-2 left-0 md:left-1/2 md:-translate-x-1/2 w-full md:w-64 max-w-[90vw] bg-white/95 backdrop-blur-md border border-white/80 rounded-xl shadow-lg md:shadow-[0_10px_30px_rgba(0,0,0,0.15)] p-4 z-40 animate-slideDown origin-top">
                            <p className="text-[10px] font-bold text-forest-dark uppercase tracking-wide mb-1">Dica Técnica</p>
                            <p className="text-xs text-forest-light leading-relaxed">{marco.dica}</p>
                          </div>
                        )}
                      </div>
                      );
                    })}
                 </div>

                 {/* Marcos Vacinais do Plano Sanitário */}
                 {planoVacinal.length > 0 && (
                   <div className="mt-6 pt-5 border-t border-white/40">
                     <p className="text-[10px] font-heading font-bold text-forest-dark uppercase tracking-wide mb-3">Plano Vacinal do Ciclo</p>
                     <div className="flex flex-wrap gap-2">
                       {planoVacinal.map((item, i) => {
                         const aplicada = registrosSanitarios.find(r => r.tipo === 'vacina' && r.nome === item.nome && r.status === 'aplicada');
                         const unidade = aptidao === 'postura' ? 'Semana' : 'Dia';
                         const idadeRef = aptidao === 'postura' ? Math.max(1, Math.ceil(item.idade_dias / 7)) : item.idade_dias;
                         const status = aplicada ? 'aplicada' : idadeDias > item.idade_dias ? 'atrasada' : idadeDias === item.idade_dias ? 'hoje' : 'pendente';
                         const estilos = {
                           aplicada: 'bg-vivid-emerald/10 border-vivid-emerald/30 text-vivid-emerald',
                           atrasada: 'bg-agriAlert-red/10 border-agriAlert-red/30 text-agriAlert-red',
                           hoje: 'bg-agriAlert-orange/10 border-agriAlert-orange/30 text-agriAlert-orange animate-pulse',
                           pendente: 'bg-white/40 border-white/60 text-forest-light',
                         };
                         const isOpen = vacinaAberta === i;
                         return (
                           <div key={i} className="relative">
                             <button
                               type="button"
                               onClick={() => setVacinaAberta(isOpen ? null : i)}
                               className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-colors ${estilos[status]}`}
                             >
                               💉 {item.nome}
                               <span className="opacity-70 font-semibold">· {unidade} {idadeRef}</span>
                             </button>
                             {isOpen && (
                               <div className="absolute left-0 top-full mt-2 w-56 max-w-[80vw] bg-white/95 backdrop-blur-md border border-white/80 rounded-xl shadow-lg p-3 z-40 animate-slideDown origin-top">
                                 <p className="text-[10px] font-bold text-forest-dark uppercase tracking-wide mb-1">{item.nome}</p>
                                 <p className="text-xs text-forest-light leading-relaxed">
                                   {status === 'aplicada'
                                     ? `Aplicada em ${aplicada.data_str || '--'}${aplicada.via_aplicacao ? ` (via ${aplicada.via_aplicacao})` : ''}.`
                                     : status === 'atrasada'
                                       ? `Atrasada! Programada para o ${unidade.toLowerCase()} ${idadeRef}. Registre a aplicação em Manejo Sanitário.`
                                       : status === 'hoje'
                                         ? `Programada para hoje (${unidade.toLowerCase()} ${idadeRef}). Registre a aplicação em Manejo Sanitário.`
                                         : `Programada para o ${unidade.toLowerCase()} ${idadeRef}.`}
                                 </p>
                               </div>
                             )}
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 )}
              </div>

            </div>
          )}
        </main>
      </div>
      
      {/* Mobile Fab for Manejo */}
      <div className="no-print lg:hidden fixed bottom-6 right-6 z-40">
        <button
           onClick={onAbrirFormulario}
           className="w-14 h-14 rounded-full bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white shadow-[0_10px_25px_rgba(16,185,129,0.5)] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform border border-white/20"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
        </button>
      </div>

      {modalUpsellAberto && (
        <ModalUpsell id_fazenda={id_fazenda} onFechar={() => setModalUpsellAberto(false)} />
      )}
    </div>
  );
}
