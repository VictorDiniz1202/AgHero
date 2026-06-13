import React, { useState, useRef, useEffect } from 'react';
import { useConectividade } from '../hooks/useConectividade';

export default function HubSincronizacao() {
  const { isOffline, forcarSincronizacao, sincronizando, filaOfflineCount = 0 } = useConectividade();
  const [aberto, setAberto] = useState(false);
  const dropdownRef = useRef(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickFora = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]" ref={dropdownRef}>
      {/* Pílula de Status (Trigger) */}
      <button 
        onClick={() => setAberto(!aberto)}
        className={`px-4 py-1.5 rounded-full backdrop-blur-md border text-[10px] font-bold flex items-center gap-3 shadow-sm transition-all duration-300 hover:scale-105 cursor-pointer ${
          isOffline 
            ? 'bg-agriAlert-orange/20 border-agriAlert-orange/40 text-agriAlert-orange' 
            : 'bg-vivid-emerald/10 border-vivid-emerald/30 text-vivid-emerald'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {isOffline ? (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-agriAlert-orange"></span>
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vivid-emerald opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-vivid-emerald"></span>
              </>
            )}
          </span>
          {isOffline ? 'Modo Offline Ativo' : 'Sincronizado'}
        </div>
        
        {sincronizando && (
          <span className="ml-1 px-1.5 py-0.5 bg-vivid-emerald/20 rounded-md flex items-center">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </span>
        )}

        {/* Indicador numérico se houver fila offline */}
        {filaOfflineCount > 0 && (
           <span className="ml-1 flex items-center justify-center bg-agriAlert-orange text-white rounded-full w-4 h-4 text-[9px]">
             {filaOfflineCount}
           </span>
        )}
        
        <svg className={`w-3 h-3 transition-transform ${aberto ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu Glassmorphism */}
      {aberto && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl p-4 animate-slide-down">
          <h3 className="text-xs font-bold text-forest-dark uppercase tracking-wider mb-3">Hub de Sincronização</h3>
          
          <div className="space-y-4">
            {/* Status da Fila */}
            <div className="bg-offwhite border border-forest-light/10 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-forest-dark">Fila de Upload Local</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${filaOfflineCount > 0 ? 'bg-agriAlert-orange/20 text-agriAlert-orange' : 'bg-vivid-emerald/10 text-vivid-emerald'}`}>
                  {filaOfflineCount} pendentes
                </span>
              </div>
              <p className="text-[10px] text-forest-light">
                {filaOfflineCount > 0 
                  ? 'Estes dados estão salvos no seu aparelho e serão enviados para a nuvem assim que a internet estabilizar.' 
                  : 'Nenhuma pendência no cache local do Firestore.'}
              </p>
            </div>

            {/* Ações */}
            <div className="flex flex-col gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  forcarSincronizacao();
                  setAberto(false);
                }}
                disabled={isOffline || sincronizando || filaOfflineCount === 0}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-vivid-emerald text-white shadow-sm hover:bg-vivid-lime"
              >
                <svg className={`w-4 h-4 ${sincronizando ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {sincronizando ? 'Sincronizando...' : 'Forçar Sincronização Agora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
