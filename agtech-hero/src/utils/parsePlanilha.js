import * as XLSX from 'xlsx';

/**
 * Lê um arquivo XLSX ou CSV e retorna as linhas brutas e cabeçalhos.
 * @param {File} file Arquivo recebido por upload ou drag and drop
 * @returns {Promise<{headers: string[], rawRows: any[]}>}
 */
export function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converte para JSON, primeira linha como cabeçalho
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length > 0) {
          const headers = jsonData[0];
          // Ignora o cabeçalho e pega os dados brutos
          const rawRows = jsonData.slice(1).filter(r => r.length > 0);
          resolve({ headers, rawRows });
        } else {
          resolve({ headers: [], rawRows: [] });
        }
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Formata os dados brutos de uma planilha para um texto sumarizado (contexto para IA).
 */
export function formatarResumoParaIA(headers, rawRows) {
  if (rawRows.length === 0) return "A planilha está vazia.";
  
  // Limita a 50 linhas para não explodir o token limit
  const linhasLimitadas = rawRows.slice(0, 50);
  
  let resumo = `Planilha recebida com ${rawRows.length} linhas e as colunas: ${headers.join(", ")}.\n`;
  resumo += `Amostra dos dados:\n`;
  
  linhasLimitadas.forEach(row => {
    const valores = headers.map((h, i) => `${h}: ${row[i] || '-'}`);
    resumo += `- ${valores.join(' | ')}\n`;
  });

  if (rawRows.length > 50) {
    resumo += `... (e mais ${rawRows.length - 50} linhas omitidas).`;
  }
  
  return resumo;
}
