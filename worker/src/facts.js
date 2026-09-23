export const SUPPORTED_LANGS = ['en', 'fr', 'pt'];

// Keep translations in the same order so switching language preserves the facts.
// Sources checked 2026-09-23:
// https://en.wikipedia.org/wiki/Mindelo
// https://www.visit-caboverde.com/en/islands/sao-vicente-island (TLS certificate expired at last check)
// https://www.lausanne-tourisme.ch/en/geography/
// https://www.lausanne-tourisme.ch/en/olympic-capital/
// https://en.wikipedia.org/wiki/Lausanne_Metro
export const FACTS_BY_LANG = {
  en: {
    common: ['Mindelo faces the Atlantic; Lausanne lies beside Lake Geneva.'],
    mindelo: [
      'Mindelo is on the island of São Vicente in Cabo Verde.',
      'Cesária Évora was one of the musicians who began their careers in Mindelo.',
      'Laginha is a beach in Mindelo.',
    ],
    lausanne: [
      'Lausanne was named Olympic Capital in 1994.',
      'Lausanne’s m2 is an automatic metro.',
      'Lausanne is home to the headquarters of the International Olympic Committee.',
    ],
  },
  fr: {
    common: ['Mindelo donne sur l’Atlantique ; Lausanne se situe au bord du Léman.'],
    mindelo: [
      'Mindelo se trouve sur l’île de São Vicente, au Cabo Verde.',
      'Cesária Évora fait partie des artistes ayant commencé leur carrière à Mindelo.',
      'Laginha est une plage de Mindelo.',
    ],
    lausanne: [
      'Lausanne a été nommée Capitale olympique en 1994.',
      'Le m2 de Lausanne est un métro automatique.',
      'Lausanne accueille le siège du Comité international olympique.',
    ],
  },
  pt: {
    common: ['Mindelo está junto ao Atlântico; Lausanne fica à beira do Lago Léman.'],
    mindelo: [
      'Mindelo fica na ilha de São Vicente, em Cabo Verde.',
      'Cesária Évora foi uma das artistas que começaram a carreira em Mindelo.',
      'Laginha é uma praia de Mindelo.',
    ],
    lausanne: [
      'Lausanne foi nomeada Capital Olímpica em 1994.',
      'O m2 de Lausanne é um metro automático.',
      'Lausanne acolhe a sede do Comité Olímpico Internacional.',
    ],
  },
};
