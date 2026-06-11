/**
 * src/data/DiretrizesZootecnicas.js
 * 
 * Base de conhecimento estática sobre linhagens, metas de consumo, peso 
 * e produção para o motor de alertas e comparativos da IA.
 */

export const DIRETRIZES_ZOOTECNICAS = {
  "Cobb 500": {
    aptidao: "corte",
    metas_semanais: {
      1: { peso_g: 195, cons_racao_acumulado_g: 172, mortalidade_max_perc: 1.0 },
      2: { peso_g: 505, cons_racao_acumulado_g: 575, mortalidade_max_perc: 1.5 },
      3: { peso_g: 978, cons_racao_acumulado_g: 1293, mortalidade_max_perc: 2.0 },
      4: { peso_g: 1585, cons_racao_acumulado_g: 2360, mortalidade_max_perc: 2.5 },
      5: { peso_g: 2273, cons_racao_acumulado_g: 3770, mortalidade_max_perc: 3.0 },
      6: { peso_g: 2985, cons_racao_acumulado_g: 5468, mortalidade_max_perc: 3.5 },
      7: { peso_g: 3672, cons_racao_acumulado_g: 7390, mortalidade_max_perc: 4.0 },
    },
    temp_conforto_celsius: { min: 20, max: 28 },
    consumo_agua_vs_racao: 1.8 // Aves bebem ~1.8x o que comem
  },
  "Ross 308": {
    aptidao: "corte",
    metas_semanais: {
      1: { peso_g: 189, cons_racao_acumulado_g: 167, mortalidade_max_perc: 1.0 },
      2: { peso_g: 494, cons_racao_acumulado_g: 561, mortalidade_max_perc: 1.5 },
      3: { peso_g: 968, cons_racao_acumulado_g: 1276, mortalidade_max_perc: 2.0 },
      4: { peso_g: 1588, cons_racao_acumulado_g: 2362, mortalidade_max_perc: 2.5 },
      5: { peso_g: 2283, cons_racao_acumulado_g: 3781, mortalidade_max_perc: 3.0 },
      6: { peso_g: 3004, cons_racao_acumulado_g: 5493, mortalidade_max_perc: 3.5 },
      7: { peso_g: 3703, cons_racao_acumulado_g: 7421, mortalidade_max_perc: 4.0 },
    },
    temp_conforto_celsius: { min: 20, max: 28 },
    consumo_agua_vs_racao: 1.8
  },
  "Lohmann": {
    aptidao: "postura",
    metas_semanais: {
      // Fase de Cria e Recria
      1: { peso_g: 72, cons_racao_acumulado_g: 90, mortalidade_max_perc: 0.5 },
      4: { peso_g: 290, cons_racao_acumulado_g: 650, mortalidade_max_perc: 1.0 },
      10: { peso_g: 930, cons_racao_acumulado_g: 3400, mortalidade_max_perc: 2.0 },
      18: { peso_g: 1500, cons_racao_acumulado_g: 7500, mortalidade_max_perc: 3.0 },
      // Fase de Produção (ex: pico e declínio)
      30: { peso_g: 1950, prod_ovos_perc: 95.0, cons_racao_diario_g: 110 },
      50: { peso_g: 2000, prod_ovos_perc: 88.0, cons_racao_diario_g: 114 },
    },
    temp_conforto_celsius: { min: 18, max: 24 },
    consumo_agua_vs_racao: 2.0 // Galinhas de postura consomem proporcionalmente mais água
  }
};
