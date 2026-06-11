/**
 * src/utils/climaPreditivo.js
 * 
 * Serviço que consome APIs gratuitas para obter a previsão do tempo dos
 * próximos 3 dias e cruzar com as zonas de conforto térmico da ave.
 * 
 * APIs utilizadas:
 * - geojs.io: para obter latitude/longitude do produtor via IP.
 * - open-meteo: para a previsão climática sem chave de API.
 */

import { DIRETRIZES_ZOOTECNICAS } from "../data/DiretrizesZootecnicas";

/**
 * Calcula o ITU (Índice de Temperatura e Umidade) usando a fórmula
 * consagrada na avicultura brasileira.
 * @param {number} tempMax - Temperatura de bulbo seco (°C)
 * @param {number} umidadeRelativa - Umidade relativa do ar (%)
 * @returns {number|null}
 */
export function calcularITU(tempMax, umidadeRelativa) {
  if (tempMax == null || umidadeRelativa == null || umidadeRelativa <= 0) return null;
  const itu = 0.8 * tempMax + (umidadeRelativa * (tempMax - 14.3) / 100) + 46.3;
  return Number(itu.toFixed(2));
}

/**
 * Obtém a zona de conforto com base na idade da ave e linhagem.
 * Aves jovens (0-14 dias) precisam de muito mais calor do que aves adultas.
 */
function obterConfortoTermico(linhagem, idadeDias) {
  const padrao = DIRETRIZES_ZOOTECNICAS[linhagem]?.temp_conforto_celsius || { min: 20, max: 28 };
  
  if (idadeDias <= 7) return { min: 30, max: 34 };
  if (idadeDias <= 14) return { min: 27, max: 30 };
  if (idadeDias <= 21) return { min: 24, max: 27 };
  
  return padrao;
}

/**
 * Obtém a previsão do tempo dos próximos 3 dias e gera alertas zootécnicos.
 * @param {string} linhagem - A linhagem do lote (ex: 'Cobb 500')
 * @param {number} idadeDias - A idade do lote em dias
 * @param {number} latCustom - Latitude (opcional, da fazenda)
 * @param {number} lonCustom - Longitude (opcional, da fazenda)
 * @returns {Promise<Object>}
 */
export async function obterPrevisaoClimatica(linhagem, idadeDias, latCustom, lonCustom) {
  try {
    let lat = latCustom;
    let lon = lonCustom;
    let cidade = "Sua Fazenda";

    // 1. Obter localização (IP) se não houver coordenadas salvas
    if (!lat || !lon) {
      const geoRes = await fetch("https://get.geojs.io/v1/ip/geo.json");
      if (!geoRes.ok) throw new Error("Falha ao obter localização geoip");
      const geoData = await geoRes.json();
      lat = geoData.latitude;
      lon = geoData.longitude;
      cidade = geoData.city || "Sua Região";
    }

    // 2. Obter Previsão OpenMeteo (Próximos 3 dias) com Umidade
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean&timezone=auto&forecast_days=3`;
    const meteoRes = await fetch(url);
    if (!meteoRes.ok) throw new Error("Falha ao obter dados meteorológicos");
    const meteoData = await meteoRes.json();

    const dias = meteoData.daily.time;
    const maxs = meteoData.daily.temperature_2m_max;
    const mins = meteoData.daily.temperature_2m_min;
    const hums = meteoData.daily.relative_humidity_2m_mean || [];

    // 3. Cruzamento Zootécnico
    const conforto = obterConfortoTermico(linhagem, idadeDias);

    const previsoes = dias.map((diaStr, i) => {
      const max = maxs[i];
      const min = mins[i];
      const hum = hums[i] || 60; // fallback para 60% se faltar dados
      const ituPredito = calcularITU(max, hum);
      
      let alerta = null;
      let severidade = 'normal'; // 'normal', 'alerta', 'critico'

      // Análise de calor excessivo (priorizando o ITU se a ave for mais velha)
      if (idadeDias > 14 && ituPredito) {
        if (ituPredito >= 84) {
          alerta = `ITU Crítico (${ituPredito}): Risco extremo de mortalidade por calor! Máxima de ${max}°C com umidade alta. Ligue nebulizadores e exaustores no máximo.`;
          severidade = 'critico';
        } else if (ituPredito >= 78) {
          alerta = `ITU em Alerta (${ituPredito}): Risco de estresse térmico. Verifique vazão dos bebedouros e ventilação.`;
          severidade = 'alerta';
        }
      }

      // Fallback para as regras clássicas de temperatura se o ITU não acionou alerta
      if (!alerta) {
        if (max >= conforto.max + 5) {
          alerta = `Risco Extremo de Calor: Máxima de ${max}°C (Ideal máx: ${conforto.max}°C). Ligue ventilação e nebulizadores!`;
          severidade = 'critico';
        } else if (max > conforto.max + 2) {
          alerta = `Atenção: Calor acima da zona de conforto (${max}°C). Observe estresse nas aves.`;
          severidade = 'alerta';
        }
      }

      // Análise de frio excessivo (se não houver calor extremo no mesmo dia)
      if (!alerta) {
        if (min <= conforto.min - 5) {
          alerta = `Risco de Hipotermia: Mínima de ${min}°C na madrugada (Ideal mín: ${conforto.min}°C). Amontoamento mortal possível!`;
          severidade = 'critico';
        } else if (min < conforto.min - 2) {
          alerta = `Atenção: Madrugada fria (${min}°C). Verifique as campânulas/cortinas.`;
          severidade = 'alerta';
        }
      }

      // Converte "YYYY-MM-DD" para exibição curta "DD/MM"
      const [ano, mes, dia] = diaStr.split("-");
      const dataCurta = `${dia}/${mes}`;

      return {
        data_str: diaStr,
        data_curta: dataCurta,
        temp_max: max,
        temp_min: min,
        umidade_media: hum,
        itu: ituPredito,
        alerta,
        severidade
      };
    });

    return { 
      cidade, 
      conforto_atual: conforto,
      previsoes 
    };

  } catch (erro) {
    console.error("[ClimaPreditivo] Erro na API de clima:", erro);
    return null;
  }
}
