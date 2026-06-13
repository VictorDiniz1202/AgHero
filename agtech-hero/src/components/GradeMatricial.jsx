import React, { useState, useEffect, useCallback } from 'react';
import { obterLotesAtivos, atualizarRegistroParcial } from '../firebase/services';
import { useConectividade } from '../hooks/useConectividade';

const formatarDataStr = (data) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
};

// Componente Memoizado para cada linha do lote
const LinhaLote = React.memo(({ lote, dataStr, idFazenda }) => {
  // Estado armazena o valor atual no input e o último valor que foi enviado à API
  const [valores, setValores] = useState({
    mortalidade: { current: '', lastSent: 0 },
    racao: { current: '', lastSent: 0 },
    agua: { current: '', lastSent: 0 },
    ovos: { current: '', lastSent: 0 }
  });
  const [status, setStatus] = useState({
    mortalidade: 'idle',
    racao: 'idle',
    agua: 'idle',
    ovos: 'idle'
  });

  const getStatusClass = (campo) => {
    switch (status[campo]) {
      case 'saving': return 'border-agriAlert-orange animate-pulse bg-agriAlert-orange/5';
      case 'saved': return 'border-vivid-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)] bg-vivid-emerald/5 transition-all duration-300';
      case 'error': return 'border-agriAlert-red bg-agriAlert-red/5';
      default: return 'border-white/60 focus:border-vivid-emerald bg-white/60 focus:bg-white';
    }
  };

  const handleChange = (campo, val) => {
    setValores(prev => ({
      ...prev,
      [campo]: { ...prev[campo], current: val }
    }));
  };

  const handleBlur = async (campo, dbKey) => {
    const valAtual = parseFloat(valores[campo].current);
    if (isNaN(valAtual)) return;

    const delta = valAtual - valores[campo].lastSent;
    if (delta !== 0) {
      setStatus(prev => ({ ...prev, [campo]: 'saving' }));
      try {
        await atualizarRegistroParcial(idFazenda, lote.id, dataStr, { [dbKey]: delta });
        setValores(prev => ({
          ...prev,
          [campo]: { ...prev[campo], lastSent: valAtual }
        }));
        setStatus(prev => ({ ...prev, [campo]: 'saved' }));
        setTimeout(() => setStatus(prev => ({ ...prev, [campo]: 'idle' })), 2000);
      } catch (err) {
        console.error(`Erro ao atualizar ${campo} do lote ${lote.id}:`, err);
        setStatus(prev => ({ ...prev, [campo]: 'error' }));
      }
    }
  };

  const handleKeyDown = (e, index) => {
      // Suporte para navegação pelas setas
      const currentTd = e.target.closest('td');
      if (!currentTd) return;
      const tr = currentTd.closest('tr');
      const table = tr.closest('table');
      const rowIdx = Array.from(table.rows).indexOf(tr);
      const colIdx = Array.from(tr.cells).indexOf(currentTd);

      if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          const nextRow = table.rows[rowIdx + 1];
          if (nextRow) {
              const input = nextRow.cells[colIdx]?.querySelector('input:not([disabled])');
              if (input) input.focus();
          }
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevRow = table.rows[rowIdx - 1];
          if (prevRow) {
              const input = prevRow.cells[colIdx]?.querySelector('input:not([disabled])');
              if (input) input.focus();
          }
      } else if (e.key === 'ArrowRight') {
          if (e.target.selectionStart === e.target.value.length) {
            e.preventDefault();
            const nextTd = tr.cells[colIdx + 1];
            if (nextTd) {
               const input = nextTd.querySelector('input:not([disabled])');
               if (input) input.focus();
            }
          }
      } else if (e.key === 'ArrowLeft') {
          if (e.target.selectionStart === 0) {
            e.preventDefault();
            const prevTd = tr.cells[colIdx - 1];
            if (prevTd) {
               const input = prevTd.querySelector('input:not([disabled])');
               if (input) input.focus();
            }
          }
      }
  };

  return (
    <tr className="hover:bg-white/40 transition-colors border-b border-forest-light/10">
      <td className="p-3 text-sm font-bold text-forest-dark whitespace-nowrap">
        {lote.identificacao || `Lote ${lote.id.substring(0,4)}`}
        <div className="text-[10px] text-forest-light font-semibold font-sans">{lote.linhagem}</div>
      </td>
      <td className="p-2">
        <input 
          type="number" 
          value={valores.mortalidade.current} 
          onChange={(e) => handleChange('mortalidade', e.target.value)}
          onBlur={() => handleBlur('mortalidade', 'mortalidade_qtd')}
          onKeyDown={(e) => handleKeyDown(e, 1)}
          placeholder="Ex: 5"
          className={`w-full border rounded-lg p-2 text-sm text-center text-forest-dark outline-none ${getStatusClass('mortalidade')}`}
        />
      </td>
      <td className="p-2">
        <input 
          type="number" 
          value={valores.racao.current} 
          onChange={(e) => handleChange('racao', e.target.value)}
          onBlur={() => handleBlur('racao', 'racao_kg')}
          onKeyDown={(e) => handleKeyDown(e, 2)}
          placeholder="kg"
          className={`w-full border rounded-lg p-2 text-sm text-center text-forest-dark outline-none ${getStatusClass('racao')}`}
        />
      </td>
      <td className="p-2">
        <input 
          type="number" 
          value={valores.agua.current} 
          onChange={(e) => handleChange('agua', e.target.value)}
          onBlur={() => handleBlur('agua', 'agua_litros')}
          onKeyDown={(e) => handleKeyDown(e, 3)}
          placeholder="L"
          className={`w-full border rounded-lg p-2 text-sm text-center text-forest-dark outline-none ${getStatusClass('agua')}`}
        />
      </td>
      <td className="p-2">
        <input 
          type="number" 
          disabled={lote.aptidao === 'corte'}
          value={valores.ovos.current} 
          onChange={(e) => handleChange('ovos', e.target.value)}
          onBlur={() => handleBlur('ovos', 'producao_ovos_qtd')}
          onKeyDown={(e) => handleKeyDown(e, 4)}
          placeholder={lote.aptidao === 'corte' ? '-' : 'qtd'}
          className={`w-full border rounded-lg p-2 text-sm text-center text-forest-dark outline-none disabled:bg-forest-light/10 disabled:cursor-not-allowed ${getStatusClass('ovos')}`}
        />
      </td>
    </tr>
  );
});

export default function GradeMatricial({ id_fazenda, papelUsuario }) {
  const [lotes, setLotes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const dataStr = formatarDataStr(new Date());

  useEffect(() => {
    if (!id_fazenda) return;
    obterLotesAtivos(id_fazenda).then(res => {
      setLotes(res);
      setCarregando(false);
    });
  }, [id_fazenda]);

  useEffect(() => {
    const handleCtrlS = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener('keydown', handleCtrlS);
    return () => window.removeEventListener('keydown', handleCtrlS);
  }, []);

  if (carregando) {
    return (
      <div className="p-6 h-full flex flex-col justify-center items-center">
         <div className="w-8 h-8 rounded-full border-2 border-vivid-emerald border-t-transparent animate-spin"></div>
         <p className="text-sm font-bold mt-4 text-forest-light">Carregando lotes...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col max-w-7xl mx-auto">
      <div className="mb-6 reveal">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-forest-dark">Gestão em Lote</h1>
        <p className="text-sm font-medium text-forest-light">Lance o manejo diário de múltiplos lotes rapidamente.</p>
      </div>

      <div className="flex-1 overflow-hidden glass-panel rounded-2xl border border-white/60 shadow-sm flex flex-col bg-white/40">
        <div className="p-4 border-b border-forest-light/10 flex items-center justify-between bg-white/30 backdrop-blur-md">
           <div className="flex items-center gap-2">
             <span className="w-2.5 h-2.5 rounded-full bg-vivid-emerald animate-pulse"></span>
             <span className="text-sm font-bold text-forest-dark">Dia: {dataStr}</span>
           </div>
           <p className="text-xs font-semibold text-forest-light bg-white/50 px-3 py-1.5 rounded-lg border border-white/80">Salva automaticamente ao sair do campo</p>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="sticky top-0 bg-offwhite/90 backdrop-blur-md z-10 shadow-sm">
              <tr>
                <th className="p-3 text-xs font-bold text-forest-light uppercase tracking-wider">Identificação</th>
                <th className="p-3 text-xs font-bold text-forest-light uppercase tracking-wider text-center w-[15%]">Mortalidade</th>
                <th className="p-3 text-xs font-bold text-forest-light uppercase tracking-wider text-center w-[15%]">Ração</th>
                <th className="p-3 text-xs font-bold text-forest-light uppercase tracking-wider text-center w-[15%]">Água</th>
                <th className="p-3 text-xs font-bold text-forest-light uppercase tracking-wider text-center w-[15%]">Ovos</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map(lote => (
                <LinhaLote key={lote.id} lote={lote} dataStr={dataStr} idFazenda={id_fazenda} />
              ))}
              {lotes.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-sm font-semibold text-forest-light">
                    Nenhum lote ativo encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
