import { useEffect, useState, useRef } from 'react';
import { obterAlertasEnviados, obterFazenda, recuperarHistoricoChat } from '../firebase/services';
import { db } from '../firebase/config';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { functions } from "../firebase/config";
import { httpsCallable } from "firebase/functions";
import SidebarMenu from "./SidebarMenu";
import ModalUpsell from './ModalUpsell';

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

export default function CentralBI({ id_fazenda, papelUsuario, onVoltar, onAbrirCalendario, onAbrirDashboard, onAbrirLotes, onAbrirConfiguracoes, onAbrirFormulario, onAbrirNutricao, onAbrirAgua, onAbrirFinanceiro, onAbrirRelatorios, onAbrirImportador }) {
  const [modalUpsellAberto, setModalUpsellAberto] = useState(false);
  const [mensagens, setMensagens] = useState([
    {
      id: 'msg-welcome',
      role: 'assistant',
      texto: 'Olá! Sou o AgBoy, seu consultor avícola digital. Posso cruzar os dados de sua granja e trazer insights e alertas. Como posso ajudar hoje?',
      timestamp: new Date().toISOString(),
    }
  ]);
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [limites, setLimites] = useState({ enviosHoje: 0, plano: 'Essencial', max: 3 });
  const chatScrollRef = useRef(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isRecording, setIsRecording] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const mediaRecorderRef = useRef(null);
  const fileInputRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result.split(',')[1];
          setAttachment({
            type: 'audio',
            base64: base64data,
            mimeType: 'audio/webm',
            url: URL.createObjectURL(blob)
          });
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Erro ao acessar microfone", err);
      alert("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result.split(',')[1];
        setAttachment({
          type: 'image',
          base64: base64data,
          mimeType: file.type,
          url: URL.createObjectURL(file)
        });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (id_fazenda) {
      recuperarHistoricoChat(id_fazenda).then(hist => {
        if (hist.length > 0) {
          setMensagens(prev => {
            // Mantém a saudação inicial e junta o histórico
            return [prev[0], ...hist];
          });
        }
      });
    }
  }, [id_fazenda]);

  useEffect(() => {
    // Rola APENAS o container interno do chat — nunca a janela.
    // scrollIntoView() propaga o scroll para todos os ancestrais (inclusive o
    // window), e como o SystemWrapper é `fixed inset-0`, isso empurrava o app
    // inteiro para cima ao entrar na aba. Rolar o container evita esse efeito.
    const container = chatScrollRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [mensagens]);

  useEffect(() => {
    if (!id_fazenda) return;
    
    const unsubFazenda = onSnapshot(
      doc(db, 'fazendas', id_fazenda),
      (docSnap) => {
        if (docSnap.exists()) {
          const fazenda = docSnap.data();
          const plano = fazenda?.plano || 'Essencial';
          
          const hoje = new Date().toISOString().split('T')[0];
          const limitRef = doc(db, 'fazendas', id_fazenda, 'limites_bi', hoje);
          getDoc(limitRef).then(limitSnap => {
            let envios = 0;
            if (limitSnap.exists()) envios = limitSnap.data().envios || 0;
            setLimites({ enviosHoje: envios, plano, max: 3 });
          });
        }
      },
      (error) => {
        console.error('[CentralBI] Falha no listener da fazenda:', error);
      }
    );
    
    return () => unsubFazenda();
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
    if ((!input.trim() && !attachment) || carregando) return;
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
    const currentAttachment = attachment;
    
    setInput('');
    setAttachment(null);
    
    setMensagens(prev => [...prev, { 
      id: Date.now().toString(), 
      role: 'user', 
      texto: textoUsuario,
      attachment: currentAttachment ? { type: currentAttachment.type, url: currentAttachment.url } : null,
      timestamp: new Date().toISOString() 
    }]);
    
    setCarregando(true);
    try {
      const aprovado = await atualizarEnvioLimite();
      if (!aprovado) throw new Error('Limite excedido.');
      
      const chatComAgBoy = httpsCallable(functions, 'chatComAgBoy');
      const payload = {
        mensagem: textoUsuario,
        id_fazenda: id_fazenda
      };
      
      if (currentAttachment) {
        payload.mediaBase64 = currentAttachment.base64;
        payload.mediaType = currentAttachment.mimeType;
      }
      
      const res = await chatComAgBoy(payload);
      
      const respostaIA = res.data.resposta;
      
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
        papelUsuario={papelUsuario}
        onAbrirDashboard={onAbrirDashboard}
        onAbrirLotes={onAbrirLotes}
        onAbrirConfiguracoes={onAbrirConfiguracoes}
        onAbrirFormulario={onAbrirFormulario}
        onAbrirNutricao={onAbrirNutricao}
        onAbrirAgua={onAbrirAgua}
        onAbrirCalendario={onAbrirCalendario}
        onAbrirFinanceiro={onAbrirFinanceiro}
        onAbrirRelatorios={onAbrirRelatorios}
        onAbrirImportador={onAbrirImportador}
        onSair={onVoltar}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/20 relative">
        <header className="flex items-center justify-between px-4 lg:px-8 py-4 lg:py-5 bg-white/30 backdrop-blur-md border-b border-white/50 z-30 shrink-0">
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

        <main ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-8 flex justify-center">
          <div className="w-full max-w-3xl flex flex-col space-y-4">
            <HistoricoAlertas
              id_fazenda={id_fazenda}
              papelUsuario={papelUsuario}
              onAbrirUpsell={() => setModalUpsellAberto(true)}
            />
            {mensagens.map(msg => {
              const textoSafe = msg.texto || '';
              const ehSvg = textoSafe.trim().startsWith('<svg');
              const ehHtml = ehSvg || textoSafe.includes('<div');
              return (
              <div key={msg.id} className={`reveal-left flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${ehSvg ? 'w-full' : 'max-w-[85%]'} rounded-2xl p-4 shadow-sm text-sm font-medium leading-relaxed overflow-x-auto ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-vivid-emerald to-vivid-teal text-white rounded-tr-sm'
                    : msg.role === 'system'
                      ? 'bg-agriAlert-red/10 text-agriAlert-red border border-agriAlert-red/20 text-center w-full rounded-xl text-xs'
                      : 'bg-white/90 shadow-md border border-white/60 text-forest-dark rounded-tl-sm'
                }`}>
                  {msg.attachment && (
                    <div className="mb-2">
                      {msg.attachment.type === 'image' ? (
                        <img src={msg.attachment.url} alt="Anexo" className="max-w-full rounded-lg shadow-sm border border-white/20" />
                      ) : msg.attachment.type === 'audio' ? (
                        <audio controls src={msg.attachment.url} className="w-full max-w-[240px] h-10" />
                      ) : null}
                    </div>
                  )}
                  {/* Se a resposta contiver SVG, renderiza como gráfico responsivo; se for HTML, injeta direto; senão, texto puro */}
                  {textoSafe && (
                    ehSvg ? (
                      <div className="svg-chart-container" dangerouslySetInnerHTML={{ __html: prepararSvgResponsivo(textoSafe) }} />
                    ) : ehHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: textoSafe }} />
                    ) : (
                      textoSafe
                    )
                  )}
                </div>
              </div>
              );
            })}
            {carregando && (
              <div className="flex justify-start">
                <div className="bg-white/90 shadow-md border border-white/60 rounded-2xl rounded-tl-sm p-4 flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-vivid-emerald animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-vivid-emerald animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-vivid-emerald animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
          </div>
        </main>

        <div className="w-full px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)] lg:p-6 bg-gradient-to-t from-offwhite via-white/95 to-white/90 border-t border-white/40 flex flex-col items-center gap-3 shrink-0 relative z-20">
          {isOffline && (
            <div className="w-full max-w-3xl rounded-2xl border border-agriAlert-orange/30 bg-agriAlert-orange/10 px-4 py-3 text-xs font-bold text-agriAlert-orange text-center">
              O AgBoy está offline no momento. Conecte-se à internet para enviar perguntas e cruzar dados de produção.
            </div>
          )}
          {!isOffline && limites.plano !== 'Inteligente' && limites.enviosHoje >= limites.max && (
            <button
              type="button"
              onClick={() => setModalUpsellAberto(true)}
              className="w-full max-w-3xl rounded-2xl border border-agriAlert-orange/30 bg-agriAlert-orange/10 px-4 py-3 text-xs font-bold text-agriAlert-orange text-center hover:bg-agriAlert-orange/20 transition-colors"
            >
              Você atingiu o limite de {limites.max} consultas diárias do plano Essencial. Toque para conhecer o plano Inteligente e ter IA ilimitada! 🚀
            </button>
          )}
          <div className="w-full max-w-3xl flex flex-col gap-2">
            {attachment && (
              <div className="flex items-center justify-between bg-white/80 p-3 rounded-2xl shadow-sm border border-white/60 backdrop-blur-md transition-all">
                <div className="flex items-center gap-3">
                  {attachment.type === 'image' ? (
                    <img src={attachment.url} alt="Preview" className="h-12 w-12 object-cover rounded-lg shadow-sm border border-white" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-vivid-emerald/10 flex items-center justify-center text-vivid-emerald border border-vivid-emerald/20">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                  )}
                  <span className="text-sm font-semibold text-forest-dark">
                    {attachment.type === 'image' ? 'Imagem anexada' : 'Áudio anexado'}
                  </span>
                </div>
                <button type="button" onClick={() => setAttachment(null)} className="p-2 text-agriAlert-red hover:bg-agriAlert-red/10 rounded-full transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            )}
            <form onSubmit={enviarMensagem} className="w-full flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={carregando || isOffline || isRecording}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-forest-dark shadow-lg backdrop-blur-md hover:bg-white transition-colors border border-white focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 disabled:opacity-50"
              >
                <svg className="w-6 h-6 text-forest-light hover:text-vivid-emerald transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => {
                    // Após o teclado virtual abrir, rola o container do chat (não a
                    // janela) para manter a última mensagem visível acima do input.
                    setTimeout(() => {
                      const container = chatScrollRef.current;
                      if (container) {
                        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                      }
                    }, 300);
                  }}
                  disabled={carregando || isOffline || (limites.plano !== 'Inteligente' && limites.enviosHoje >= limites.max) || isRecording}
                  placeholder={isRecording ? "Gravando áudio..." : "Pergunte sobre seus lotes..."}
                  className={`w-full h-14 rounded-2xl border border-white bg-white/80 pl-5 pr-14 text-base sm:text-sm font-medium text-forest-dark shadow-lg backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-vivid-emerald/50 disabled:opacity-50 transition-colors ${isRecording ? 'animate-pulse text-vivid-emerald placeholder-vivid-emerald border-vivid-emerald/50 bg-vivid-emerald/5' : ''}`}
                />
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={carregando || isOffline || (limites.plano !== 'Inteligente' && limites.enviosHoje >= limites.max)}
                  className={`absolute right-2 flex h-10 w-10 items-center justify-center rounded-xl transition-all disabled:opacity-50 ${isRecording ? 'bg-vivid-emerald/20 text-vivid-emerald shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-transparent text-forest-light hover:text-vivid-emerald hover:bg-vivid-emerald/10'}`}
                >
                  {isRecording ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  )}
                </button>
              </div>

              <button
                type="submit"
                disabled={(!input.trim() && !attachment) || carregando || isOffline || (limites.plano !== 'Inteligente' && limites.enviosHoje >= limites.max)}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-6 w-6 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 19-9-9 19-2-8-8-2z" /></svg>
              </button>
            </form>
          </div>
        </div>
      </div>

      {modalUpsellAberto && (
        <ModalUpsell id_fazenda={id_fazenda} onFechar={() => setModalUpsellAberto(false)} />
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
    if (papelUsuario === 'dono' || papelUsuario === 'owner') {
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
