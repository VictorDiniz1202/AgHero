import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { importarDadosLote, adicionarLote, obterLotesAtivos } from '../firebase/services';

export default function ImportadorDados({ id_fazenda }) {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [dataPreview, setDataPreview] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Import/Preview
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Mapeamento: campo_sistema -> cabecalho_planilha
  const [mapping, setMapping] = useState({
    data_str: '',
    agua_litros: '',
    racao_kg: '',
    mortalidade_qtd: '',
    temp_max: '',
    temp_min: '',
    peso_medio: '',
    despesa: '',
    receita: '',
    desc_transacao: ''
  });

  // Opções de destino
  const [destino, setDestino] = useState('novo'); // 'novo' ou id_lote
  const [lotesAtivos, setLotesAtivos] = useState([]);
  const [novoLoteLinhagem, setNovoLoteLinhagem] = useState('Cobb 500');
  const [novoLoteQtd, setNovoLoteQtd] = useState(10000);

  // Campos do sistema disponíveis para mapeamento
  const systemFields = [
    { key: 'data_str', label: 'Data do Registro (Obrigatório)', required: true },
    { key: 'mortalidade_qtd', label: 'Mortalidade (Aves)', required: false },
    { key: 'racao_kg', label: 'Ração Consumida (kg)', required: false },
    { key: 'agua_litros', label: 'Água Consumida (L)', required: false },
    { key: 'peso_medio', label: 'Peso Médio (g)', required: false },
    { key: 'temp_max', label: 'Temperatura Máxima (°C)', required: false },
    { key: 'temp_min', label: 'Temperatura Mínima (°C)', required: false },
    { key: 'despesa', label: 'Despesa Financeira (R$)', required: false },
    { key: 'receita', label: 'Receita Financeira (R$)', required: false },
    { key: 'desc_transacao', label: 'Descrição da Transação', required: false },
  ];

  // Carrega lotes ativos caso escolha adicionar a lote existente
  React.useEffect(() => {
    if (id_fazenda && step === 2) {
      obterLotesAtivos(id_fazenda).then(setLotesAtivos);
    }
  }, [id_fazenda, step]);

  const onFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    processFile(selectedFile);
  };

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Converte para JSON, primeira linha como cabeçalho
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (jsonData.length > 0) {
        setHeaders(jsonData[0]);
        // Ignora o cabeçalho e pega os dados brutos
        setRawRows(jsonData.slice(1).filter(r => r.length > 0));
        setStep(2);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingChange = (sysKey, headerVal) => {
    setMapping(prev => ({ ...prev, [sysKey]: headerVal }));
  };

  const previewData = () => {
    // Monta o preview baseado no mapeamento
    const mapped = rawRows.map(row => {
      let obj = {};
      Object.keys(mapping).forEach(sysKey => {
        const headerName = mapping[sysKey];
        if (headerName) {
          const colIndex = headers.indexOf(headerName);
          if (colIndex !== -1) {
            obj[sysKey] = row[colIndex];
          }
        }
      });
      return obj;
    });
    setDataPreview(mapped.slice(0, 5)); // Mostra os 5 primeiros
    setStep(3);
  };

  const parseDateToYYYYMMDD = (val) => {
    if (!val) return null;
    // Tenta entender a data (se for número do excel, converte)
    if (typeof val === 'number') {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    // String DD/MM/YYYY ou afins
    const str = String(val);
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        // Assume DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return str; // tenta devolver do jeito que veio
  };

  const formatarParaBanco = () => {
    const registros = [];
    const transacoes = [];

    rawRows.forEach(row => {
      const getVal = (sysKey) => {
        const h = mapping[sysKey];
        if (!h) return null;
        const idx = headers.indexOf(h);
        return idx !== -1 ? row[idx] : null;
      };

      const rawData = getVal('data_str');
      const dataFormatada = parseDateToYYYYMMDD(rawData);
      
      if (!dataFormatada) return; // Se não tem data, pula

      // Monta Registro
      const agua = parseFloat(getVal('agua_litros'));
      const racao = parseFloat(getVal('racao_kg'));
      const mort = parseInt(getVal('mortalidade_qtd'), 10);
      const tMax = parseFloat(getVal('temp_max'));
      const tMin = parseFloat(getVal('temp_min'));

      if (agua || racao || mort || tMax || tMin) {
        registros.push({
          data_str: dataFormatada,
          agua_litros: isNaN(agua) ? 0 : agua,
          racao_kg: isNaN(racao) ? 0 : racao,
          mortalidade_qtd: isNaN(mort) ? 0 : mort,
          temp_max: isNaN(tMax) ? null : tMax,
          temp_min: isNaN(tMin) ? null : tMin,
          observacoes: 'Importado via planilha'
        });
      }

      // Monta Transação Financeira
      const despesa = parseFloat(getVal('despesa'));
      const receita = parseFloat(getVal('receita'));
      const desc = getVal('desc_transacao') || 'Importação Lote';

      if (!isNaN(despesa) && despesa > 0) {
        transacoes.push({
          tipo: 'despesa',
          valor: despesa,
          descricao: desc,
          data_str: dataFormatada
        });
      }
      if (!isNaN(receita) && receita > 0) {
        transacoes.push({
          tipo: 'receita',
          valor: receita,
          descricao: desc,
          data_str: dataFormatada
        });
      }
    });

    return { registros, transacoes };
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const { registros, transacoes } = formatarParaBanco();
      
      let targetLoteId = destino;

      // Se for lote novo, cria o lote primeiro
      if (destino === 'novo') {
        const novoLote = await adicionarLote(id_fazenda, {
          linhagem: novoLoteLinhagem,
          quantidade_inicial: Number(novoLoteQtd),
          data_alojamento: new Date() // idealmente seria a menor data do CSV
        });
        targetLoteId = novoLote.id;
      }

      await importarDadosLote(id_fazenda, targetLoteId, registros, transacoes);
      setSuccess(true);
    } catch (err) {
      alert("Erro ao importar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center">
        <div className="glass-panel p-10 flex flex-col items-center max-w-lg text-center">
          <div className="w-20 h-20 bg-vivid-emerald/20 text-vivid-emerald rounded-full flex items-center justify-center text-4xl mb-6">✅</div>
          <h2 className="text-2xl font-bold text-forest-dark mb-4">Importação Concluída!</h2>
          <p className="text-forest-light mb-8">Sua planilha foi processada com sucesso. Os registros diários e transações financeiras já estão contabilizados no sistema.</p>
          <button onClick={() => { setStep(1); setSuccess(false); setFile(null); }} className="px-6 py-3 bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white rounded-xl font-bold shadow-md hover:scale-105 transition-transform">
            Importar Nova Planilha
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-offwhite min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <header>
          <h1 className="text-2xl font-bold text-forest-dark flex items-center gap-2">
            📊 Importador de Planilhas
          </h1>
          <p className="text-forest-light mt-1">Integre seu histórico do Excel ou CSV diretamente para a inteligência do AgTech Hero.</p>
        </header>

        {/* STEP 1: Upload */}
        {step === 1 && (
          <div className="glass-panel border border-white/60 p-10 rounded-3xl flex flex-col items-center justify-center text-center shadow-sm">
            <div className="w-24 h-24 mb-6 rounded-full bg-vivid-emerald/10 text-vivid-emerald flex items-center justify-center text-4xl">
              📂
            </div>
            <h3 className="text-xl font-bold text-forest-dark mb-2">Selecione seu Arquivo</h3>
            <p className="text-forest-light text-sm max-w-md mb-8">Arraste ou selecione uma planilha nos formatos .xlsx, .xls ou .csv.</p>
            
            <label className="cursor-pointer relative overflow-hidden px-8 py-3 bg-white text-forest-dark font-bold text-sm border-2 border-forest/10 rounded-xl hover:border-vivid-emerald hover:text-vivid-emerald transition-colors shadow-sm">
              Buscar no Computador
              <input type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>
        )}

        {/* STEP 2: Mapeamento */}
        {step === 2 && (
          <div className="glass-panel border border-white/60 p-6 lg:p-8 rounded-3xl shadow-sm space-y-8 animate-fade-in">
            <div className="flex items-center justify-between border-b border-forest/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-forest-dark">Mapeamento de Colunas</h3>
                <p className="text-sm text-forest-light mt-1">Conecte as colunas da sua planilha ({file?.name}) aos campos do sistema.</p>
              </div>
              <button onClick={() => setStep(1)} className="text-sm text-vivid-emerald hover:underline font-medium">Trocar Arquivo</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {systemFields.map(sys => (
                <div key={sys.key} className="flex flex-col bg-white/50 p-4 rounded-xl border border-white/80 shadow-sm">
                  <label className="text-sm font-bold text-forest-dark mb-2 flex justify-between">
                    {sys.label} {sys.required && <span className="text-agriAlert-red text-xs">*</span>}
                  </label>
                  <select
                    className="p-2.5 rounded-lg border border-forest/20 text-sm focus:ring-2 focus:ring-vivid-emerald/50 outline-none bg-white"
                    value={mapping[sys.key]}
                    onChange={(e) => handleMappingChange(sys.key, e.target.value)}
                  >
                    <option value="">-- Ignorar este campo --</option>
                    {headers.map((h, i) => <option key={i} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="bg-white/60 p-6 rounded-2xl border border-vivid-emerald/20 shadow-sm">
              <h4 className="text-md font-bold text-forest-dark mb-4">Onde deseja salvar estes dados?</h4>
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="destino" value="novo" checked={destino === 'novo'} onChange={() => setDestino('novo')} className="w-4 h-4 text-vivid-emerald focus:ring-vivid-emerald" />
                  <span className="font-medium text-forest-dark">Criar Novo Lote</span>
                </label>
                {destino === 'novo' && (
                  <div className="ml-7 flex gap-4 mt-2">
                    <input type="text" placeholder="Linhagem (ex: Cobb 500)" value={novoLoteLinhagem} onChange={e=>setNovoLoteLinhagem(e.target.value)} className="border border-forest/20 p-2 text-sm rounded-lg flex-1" />
                    <input type="number" placeholder="Qtd. Aves" value={novoLoteQtd} onChange={e=>setNovoLoteQtd(e.target.value)} className="border border-forest/20 p-2 text-sm rounded-lg w-32" />
                  </div>
                )}
                
                <label className="flex items-center gap-3 cursor-pointer mt-2">
                  <input type="radio" name="destino" value="existente" checked={destino !== 'novo'} onChange={() => setDestino(lotesAtivos[0]?.id || '')} className="w-4 h-4 text-vivid-emerald focus:ring-vivid-emerald" />
                  <span className="font-medium text-forest-dark">Adicionar a Lote Ativo Existente</span>
                </label>
                {destino !== 'novo' && (
                  <select value={destino} onChange={(e) => setDestino(e.target.value)} className="ml-7 border border-forest/20 p-2 text-sm rounded-lg mt-2 max-w-sm">
                    {lotesAtivos.map(l => <option key={l.id} value={l.id}>{l.linhagem} ({new Date(l.data_alojamento?.toDate()).toLocaleDateString()})</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                disabled={!mapping.data_str}
                onClick={previewData} 
                className="px-6 py-3 bg-forest-dark text-white rounded-xl font-bold hover:bg-forest transition-colors disabled:opacity-50"
              >
                Continuar para Revisão ➔
              </button>
            </div>
            {!mapping.data_str && <p className="text-xs text-agriAlert-red text-right -mt-4">Obrigatório mapear o campo "Data do Registro".</p>}
          </div>
        )}

        {/* STEP 3: Preview e Import */}
        {step === 3 && (
          <div className="glass-panel border border-white/60 p-6 lg:p-8 rounded-3xl shadow-sm space-y-6 animate-fade-in">
            <h3 className="text-xl font-bold text-forest-dark mb-2">Revisão Final</h3>
            <p className="text-sm text-forest-light mb-6">Confira uma amostra dos dados formatados antes de salvar no sistema.</p>
            
            <div className="overflow-x-auto rounded-xl border border-forest/10 shadow-inner bg-white/50">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-forest-light/10 text-forest-dark">
                  <tr>
                    <th className="p-3 font-bold">Data Mapeada</th>
                    <th className="p-3 font-bold">Mortalidade</th>
                    <th className="p-3 font-bold">Ração (kg)</th>
                    <th className="p-3 font-bold">Despesa (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest/5 text-forest-dark">
                  {dataPreview.map((row, i) => (
                    <tr key={i} className="hover:bg-white/40">
                      <td className="p-3 font-medium">{parseDateToYYYYMMDD(row.data_str) || 'Data Inválida'}</td>
                      <td className="p-3">{row.mortalidade_qtd || '-'}</td>
                      <td className="p-3">{row.racao_kg || '-'}</td>
                      <td className="p-3">{row.despesa || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex items-center justify-between pt-6 border-t border-forest/10">
              <button onClick={() => setStep(2)} className="px-5 py-2.5 text-forest-light hover:text-forest-dark font-medium">Voltar ao Mapeamento</button>
              <button onClick={handleImport} disabled={loading} className="px-8 py-3 bg-gradient-to-r from-vivid-emerald to-vivid-lime text-white rounded-xl font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-2 disabled:opacity-50">
                {loading ? 'Importando...' : `Confirmar Importação (${rawRows.length} linhas)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
