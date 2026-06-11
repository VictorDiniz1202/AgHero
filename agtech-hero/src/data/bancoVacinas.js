/**
 * src/data/bancoVacinas.js
 * 
 * Banco de dados de referência com as vacinas mais comuns na avicultura comercial
 * (Corte e Postura) para busca e autocompletar.
 */

export const BANCO_VACINAS = [
  {
    nome: "Marek",
    doenca: "Doença de Marek",
    idade_recomendada: 1,
    via: "injecao",
    descricao: "Prevenção contra paralisia e linfomas tumorais. Aplicada no 1º dia (geralmente incubatório)."
  },
  {
    nome: "Gumboro (IBD)",
    doenca: "Doença de Gumboro / Bursite Infecciosa",
    idade_recomendada: 7,
    via: "agua",
    descricao: "Protege o sistema imunológico contra o vírus da Bursite Infecciosa Aviária."
  },
  {
    nome: "Newcastle + Bronquite Infecciosa",
    doenca: "Pneumoencefalite e Bronquite aviária",
    idade_recomendada: 10,
    via: "spray",
    descricao: "Dupla proteção contra Newcastle (sintomas nervosos/respiratórios) e Bronquite Infecciosa."
  },
  {
    nome: "Bouba Aviária (Fowl Pox)",
    doenca: "Bouba Aviária / Caroço",
    idade_recomendada: 21,
    via: "injecao",
    descricao: "Prevenção de lesões na pele e garganta causadas por picadas de mosquitos."
  },
  {
    nome: "Coriza Infecciosa",
    doenca: "Coriza Infecciosa",
    idade_recomendada: 42,
    via: "injecao",
    descricao: "Prevenção de infecção bacteriana do trato respiratório superior (inchaço de cabeça)."
  },
  {
    nome: "Coccidiose Aviária",
    doenca: "Coccidiose",
    idade_recomendada: 1,
    via: "agua",
    descricao: "Imunização contra parasitas intestinais que afetam a absorção e causam diarreia."
  },
  {
    nome: "Encefalomielite Aviária",
    doenca: "Encefalomielite",
    idade_recomendada: 70,
    via: "agua",
    descricao: "Protege contra tremores epidêmicos em aves jovens e queda acentuada de postura em adultas."
  },
  {
    nome: "Salmonela (Tifo/Paratifo)",
    doenca: "Salmonelose",
    idade_recomendada: 35,
    via: "injecao",
    descricao: "Prevenção de infecções sistêmicas e contaminação de carcaça/ovos."
  },
  {
    nome: "Laringotraqueíte Infecciosa (LTI)",
    doenca: "Laringotraqueíte",
    idade_recomendada: 56,
    via: "injecao",
    descricao: "Prevenção contra infecção respiratória aguda grave por herpesvírus."
  },
  {
    nome: "Síndrome da Queda de Postura (EDS)",
    doenca: "Egg Drop Syndrome",
    idade_recomendada: 112,
    via: "injecao",
    descricao: "Administrada antes do início da postura para evitar ovos sem casca ou deformados."
  },
  {
    nome: "Micoplasmose (MG/MS)",
    doenca: "Doença Respiratória Crônica (DRC)",
    idade_recomendada: 49,
    via: "spray",
    descricao: "Prevenção de infecções respiratórias crônicas causadas por Mycoplasma gallisepticum/synoviae."
  },
  {
    nome: "Influenza Aviária",
    doenca: "Gripe Aviária",
    idade_recomendada: 28,
    via: "injecao",
    descricao: "Prevenção contra o vírus da Influenza em áreas com alto risco epidemiológico."
  }
];
