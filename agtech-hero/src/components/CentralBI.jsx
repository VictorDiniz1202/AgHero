import { useEffect, useState, useRef } from 'react';
import { obterAlertasEnviados, obterFazenda } from '../firebase/services';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import ModalUpsell from './ModalUpsell';
import SidebarMenu from './SidebarMenu';

/**
 * Normaliza um SVG vindo da IA (n8n) para escalar fluidamente:
 * remove width/height fixos e força width="100%" height="auto",
 * garantindo responsividade no chat sem quebrar o layout lateral.
 */
function prepararSvgResponsivo(svgString) {
  let svg = svgString.replace(/<svg([^>]*)>/i, (match, attrs) => {
    const semTamanhoFixo = attrs
      .replace(/\swidth="[^"]*"/i, '')
      .replace(/\sheight="[^"]*"/i, '');
    return `<svg${semTamanhoFixo} width="100%" height="auto">`;
  });
  return svg;
}

export default function CentralBI({ id_fazenda, papelUsuario, onVoltar, onAbrirCalendario, onAbrirDashboard, onAbrirLotes, onAbrirConfiguracoes, onAbrirFormulario, onAbrirNutricao, onAbrirAgua, onAbrirFinanceiro }) {
  const [modalUpsellAberto, setModalUpsellAberto] = useState(false);
  const [mensagens, setMensagens] = useState([
    {
      id: 'msg-welcome',
      role: 'assistant',
      texto: 'Olá! Sou sua Inteligência Artificial integrada ao AgHero. Posso cruzar os dados de sua granja e trazer insights e alertas. Como posso ajudar hoje?',
      timestamp: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [limites, setLimites] = useState({ enviosHoje: 0, plano: 'Essencial', max: 3 });
  const messagesEndRef = useRef(null);
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  useEffect(() => {
    if (!id_fazenda) return;
    obterFazenda(id_fazenda).then(fazenda => {
      const plano = fazenda?.plano || 'Essencial';
      const hoje = new Date().toISOString().split('T')[0];
      const limitRef = doc(db, 'fazendas', id_fazenda, 'limites_bi', hoje);
      getDoc(limitRef).then(docSnap => {
        let envios = 0;
        if (docSnap.exists()) envios = docSnap.data().envios || 0;
        setLimites({ enviosHoje: envios, plano, max: 3 });
      });
    });
  }, [id_fazenda]);

  async function atualizarEnvioLimite() {
    if (limites.plano === 'Inteligente') return true;
    const hoje = new Date().toISOString().split('T')[0];
    const novoEnvio = limites.enviosHoje + 1;
    if (novoEnvio > limites.max) return false;
    const limitRef = doc(db, 'fazendas', id_fazenda, 'limites_bi', hoje);
    await setDoc(limitRef, { envios: novoEnvio, data: hoje }, { merge: true });
    setLimites(prev => ({ ...prev, enviosHoje: novoEnvio }));
    return true;
  }

  async function enviarMensagem(e) {
    e?.preventDefault();
    if (!input.trim() || carregando) return;
    if (limites.plano !== 'Inteligente' && limites.enviosHoje >= limites.max) {
      setMensagens(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        texto: 'Você atingiu o limite de mensagens diárias do plano Essencial. Atualize para o Inteligente para ter IA ilimitada!',
        timestamp: new Date().toISOString(),
      }]);
      return;
    }
    const textoUsuario = input.trim();
    setInput('');
    setMensagens(prev => [...prev, { id: Date.now().toString(), role: 'user', texto: textoUsuario, timestamp: new Date().toISOString() }]);
    setCarregando(true);
    try {
      const aprovado = await atualizarEnvioLimite();
      if (!aprovado) throw new Error('Limite excedido.');
      
      const payload = {
        numeroid: id_fazenda,
        conversa: textoUsuario,
        nomeuser: "Produtor",
        empresa: "AgHero",
        tipo: "texto",
        message_id: Date.now().toString()
      };

      const res = await fetch("https://n8n-n8n.tq2epq.easypanel.host/webhook-test/agtech-registro-diario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      let respostaIA = "A IA processou a solicitação, mas não retornou uma resposta em texto legível.";
      
      if (res.ok) {
        const textResponse = await res.text();
        try {
          const jsonResponse = JSON.parse(textResponse);
          // Tenta extrair a resposta se for um JSON estruturado
          respostaIA = jsonResponse.resposta || jsonResponse.output || jsonResponse.message || textResponse;
        } catch(e) {
          // Se não for JSON, assume que a resposta é o próprio texto/HTML (como um SVG)
          respostaIA = textResponse;
        }
      } else {
        throw new Error("Erro na comunicação com o servidor da IA.");
      }
      
      setMensagens(prev => [...prev, { id: Date.now().toString(), role: 'assistant', texto: respostaIA, timestamp: new Date().toISOString() }]);
    } catch (error) {
      setMensagens(prev => [...prev, { id: Date.now().toString(), role: 'system', texto: 'Ops, houve um erro ao processar sua solicitação com a IA: ' + error.message, timestamp: new Date().toISOString() }]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const elements = document.querySelectorAll('.reveal-left');
    elements.forEach((el, index) => {
      el.style.transitionDelay = `${(index % 5) * 80}ms`;
      setTimeout(() => el.classList.add('reveal-left-visible'), 50);
    });
  }, [mensagens]);

  return (
    <div className="flex h-full w-full bg-offwhite text-forest-dark relative z-10 overflow-hidden font-sans">
      {/* Sidebar */}
      <SidebarMenu
        menuAberto={menuAberto}
        setMenuAberto={setMenuAberto}
        telaAtiva="bi"
        onAbrirDashboard={onAbrirDashboard}
        onAbrirLotes={onAbrirLotes}
        onAbrirConfiguracoes={onAbrirConfiguracoes}
        onAbrirFormulario={onAbrirFormulario}
        onAbrirNutricao={onAbrirNutricao}
        onAbrirAgua={onAbrirAgua}
        onAbrirCalendario={onAbrirCalendario}
        onAbrirFinanceiro={onAbrirFinanceiro}
        onSair={onVoltar}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/20 relative">
        <header className="flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5 bg-white/30 backdrop-blur-md border-b border-white/50 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 -ml-2 text-forest-dark hover:bg-white/50 rounded-xl" onClick={() => setMenuAberto(true)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div>
              <h1 className="text-lg lg:text-xl font-heading font-bold text-forest-dark tracking-tight leading-none">Central BI & IA</h1>
              <p className="text-[10px] font-semibold text-vivid-emerald mt-1 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-vivid-emerald animate-pulse"></span> IA Online
              </p>
            </div>
          </div>
          {limites.plano !== 'Inteligente' && (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-xs font-bold text-agriAlert-orange uppercase tracking-wider">Consultas: {limites.enviosHoje}/{limites.max}</span>
              <button onClick={() => setModalUpsellAberto(true)} className="text-xs font-bold bg-agriAlert-orange text-white px-3 py-1.5 rounded-lg shadow-sm hover:scale-105 transition-transform">Fazer Upgrade</button>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 flex justify-center">
          <div className="w-full max-w-3xl flex flex-col space-y-4">
            <HistoricoAlertas
              id_fazenda={id_fazenda}
              papelUsuario={papelUsuario}
              onAbrirUpsell={() => setModalUpsellAberto(true)}
            />
            {mensagens.map(msg => {
              const ehSvg = msg.texto.trim().startsWith('<svg');
              const ehHtml = ehSvg || msg.texto.includes('<div');
              return (
              <div key={msg.id} className={`reveal-left flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${ehSvg ? 'w-full' : 'max-w-[85%]'} rounded-2xl p-4 shadow-sm text-sm font-medium leading-relaxed overflow-x-auto ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-vivid-emerald to-vivid-teal text-white rounded-tr-sm'
                    : msg.role === 'system'
                      ? 'bg-agriAlert-red/10 text-agriAlert-red border border-agriAlert-red/20 text-center w-full rounded-xl text-xs'
                      : 'glass-panel bg-white/70 border border-white/60 text-forest-dark rounded-tl-sm'
                }`}>
                  {/* Se a resposta contiver SVG, renderiza como gráfico responsivo; se for HTML, injeta direto; senão, texto puro */}
                  {ehSvg ? (
                    <div className="svg-chart-container" dangerouslySetInnerHTML={{ __html: prepararSvgResponsivo(msg.texto) }} />
                  ) : ehHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: msg.texto }} />
                  ) : (
                    msg.texto
                  )}
                </div>
              </div>
              );
            })}
            {carregando && (
              <div className="flex justify-start">
                <div className="glass-panel bg-white/70 border border-white/60 rounded-2xl rounded-tl-sm p-4 flex gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-vivid-emerald animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-vivid-emerald animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-vivid-emerald animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <div className="w-full p-4 lg:p-6 bg-gradient-to-t from-offwhite via-white/95 to-white/90 border-t border-white/40 flex flex-col items-center gap-3 shrink-0 relative z-20">
          {limites.plano !== 'Inteligente' && limites.enviosHoje >= limites.max && (
            <button
              type="button"
              onClick={() => setModalUpsellAberto(true)}
              className="w-full max-w-3xl rounded-2xl border border-agriAlert-orange/30 bg-agriAlert-orange/10 px-4 py-3 text-xs font-bold text-agriAlert-orange text-center hover:bg-agriAlert-orange/20 transition-colors"
            >
              Você atingiu o limite de {limites.max} consultas diárias do plano Essencial. Toque para conhecer o plano Inteligente e ter IA ilimitada! 🚀
            </button>
          )}
          <form onSubmit={enviarMensagem} className="w-full max-w-3xl flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={carregando || (limites.plano !== 'Inteligente' && limites.enviosHoje >= limites.max)}
              placeholder="Pergunte sobre seus lotes..."
              className="flex-1 h-14 rounded-2xl border border-white bg-white/80 px-6 text-sm font-medium text-forest-dark shadow-lg backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || carregando || (limites.plano !== 'Inteligente' && limites.enviosHoje >= limites.max)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-6 w-6 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 19-9-9 19-2-8-8-2z" /></svg>
            </button>
          </form>
        </div>
      </div>

      {modalUpsellAberto && (
        <ModalUpsell onFechar={() => setModalUpsellAberto(false)} />
      )}
    </div>
  );
}

const ICONES_TIPO_ALERTA = {
  mortalidade: '💀',
  temperatura: '🌡️',
  agua: '💧',
  racao: '🌾',
  postura: '🥚',
};

function HistoricoAlertas({ id_fazenda, papelUsuario, onAbrirUpsell }) {
  const [aberto, setAberto] = useState(false);
  const [alertas, setAlertas] = useState(null);

  useEffect(() => {
    if (!id_fazenda || !aberto || alertas !== null) return;
    obterAlertasEnviados(id_fazenda).then(setAlertas);
  }, [id_fazenda, aberto, alertas]);

  return (
    <section className="glass-panel rounded-2xl shadow-sm overflow-hidden border border-white/60">
      <button
        type="button"
        onClick={() => setAberto((atual) => !atual)}
        aria-expanded={aberto}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-sm font-heading font-bold text-forest-dark"
      >
        <span>🚨 Histórico de Alertas da IA</span>
        <svg className={`h-4 w-4 shrink-0 text-forest-light transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-3 max-h-96 overflow-y-auto">
          {alertas === null && (
            <p className="text-xs font-medium text-forest-light text-center py-2">Carregando alertas...</p>
          )}
          {alertas !== null && alertas.length === 0 && (
            <p className="rounded-xl border-2 border-dashed border-forest/20 p-4 text-center text-xs font-medium text-forest-light">
              Nenhum alerta disparado até o momento. Tudo tranquilo por aqui! ✅
            </p>
          )}
          {alertas?.map((alerta) => (
            <CardAlerta key={alerta.id} alerta={alerta} papelUsuario={papelUsuario} onAbrirUpsell={onAbrirUpsell} />
          ))}
        </div>
      )}
    </section>
  );
}

function CardAlerta({ alerta, papelUsuario, onAbrirUpsell }) {
  const [avisoPermissao, setAvisoPermissao] = useState(false);
  const enviado = alerta.status_envio === 'enviado';
  const bloqueadoPlano = alerta.status_envio === 'bloqueado_plano';
  const icone = ICONES_TIPO_ALERTA[alerta.tipo] ?? '⚠️';
  const dataFormatada = typeof alerta.data_envio?.toDate === 'function'
    ? alerta.data_envio.toDate().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
    : '';

  useEffect(() => {
    if (!avisoPermissao) return undefined;
    const timer = setTimeout(() => setAvisoPermissao(false), 3000);
    return () => clearTimeout(timer);
  }, [avisoPermissao]);

  function handleClickBadgeBloqueado() {
    if (papelUsuario === 'dono') {
      onAbrirUpsell?.();
    } else {
      setAvisoPermissao(true);
    }
  }

  return (
    <div className="rounded-xl border border-white/60 bg-white/70 p-3.5 space-y-2.5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <span className="text-lg leading-none mt-0.5 shrink-0">{icone}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-forest-dark leading-snug">{alerta.detalhe}</p>
          {alerta.mensagem_gerada && (
            <p className="mt-1 text-xs font-medium text-forest-light/80 leading-relaxed whitespace-pre-line">{alerta.mensagem_gerada}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/50">
        <span className="text-[10px] font-semibold text-forest-light/70 uppercase tracking-wider">{dataFormatada}</span>
        {enviado ? (
          <span className="shrink-0 rounded-full bg-agriAlert-green/10 px-2.5 py-1 text-[10px] font-bold text-agriAlert-green">🟢 Enviado por WhatsApp</span>
        ) : bloqueadoPlano ? (
          <button
            type="button"
            onClick={handleClickBadgeBloqueado}
            className="shrink-0 rounded-full bg-agriAlert-orange/10 px-2.5 py-1 text-[10px] font-bold text-agriAlert-orange hover:bg-agriAlert-orange/20 transition-colors cursor-pointer"
          >
            🟠 WhatsApp bloqueado (Plano Essencial)
          </button>
        ) : (
          <span className="shrink-0 rounded-full bg-agriAlert-orange/10 px-2.5 py-1 text-[10px] font-bold text-agriAlert-orange">🟠 Aguardando conexão (Fila offline)</span>
        )}
      </div>
      {avisoPermissao && (
        <p className="text-[10px] font-semibold text-forest-light/80 bg-white/60 border border-white/60 rounded-lg px-2.5 py-1.5 text-center">
          Apenas administradores podem gerenciar o plano da fazenda.
        </p>
      )}
    </div>
  );
}
