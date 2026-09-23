// Shared mini-games for a call between the two cities. Keep languages in the same order.
export const challenges = {
  en: [
    ['📸', 'Two windows, one moment', 'Each take a photo from your window. No filters. What is the first difference you notice?'],
    ['🎧', 'The 10-second song duel', 'Hum ten seconds of a song that reminds you of home. Can the other person name it?'],
    ['🍲', 'The imaginary dinner', 'You get one starter, one main, and one dessert from either home. Build your shared menu.'],
    ['🗣️', 'Lost in translation', 'Pick a word in Kriolu, French, or Portuguese. Describe it without translating it. Let them guess.'],
    ['✏️', 'Postcard in five words', 'Describe your day in exactly five words. The other person has to invent the story behind them.'],
    ['🧳', 'One-hour homecoming', 'Imagine arriving in the other city with just one free hour. Who would you see, and where would you go?'],
    ['👂', 'Guess the sound', 'Record ten seconds of a sound around you. Can the other person work out what it is?'],
  ],
  fr: [
    ['📸', 'Deux fenêtres, un instant', 'Prenez chacun une photo depuis votre fenêtre. Sans filtre. Quelle différence remarquez-vous en premier ?'],
    ['🎧', 'Le duel musical de 10 secondes', 'Fredonnez dix secondes d’une chanson qui vous rappelle chez vous. L’autre saura-t-il la reconnaître ?'],
    ['🍲', 'Le dîner imaginaire', 'Une entrée, un plat et un dessert de l’un ou l’autre pays. Composez votre menu commun.'],
    ['🗣️', 'Perdu dans la traduction', 'Choisissez un mot en créole, français ou portugais. Décrivez-le sans le traduire. À l’autre de deviner.'],
    ['✏️', 'Une carte postale en cinq mots', 'Décrivez votre journée en cinq mots exactement. L’autre doit inventer l’histoire qui se cache derrière.'],
    ['🧳', 'Une heure au pays', 'Imaginez arriver dans l’autre ville avec une seule heure de libre. Qui verriez-vous et où iriez-vous ?'],
    ['👂', 'Devinez le son', 'Enregistrez dix secondes d’un son autour de vous. L’autre saura-t-il l’identifier ?'],
  ],
  pt: [
    ['📸', 'Duas janelas, um instante', 'Tirem uma foto da vossa janela. Sem filtros. Qual é a primeira diferença que notam?'],
    ['🎧', 'O duelo musical de 10 segundos', 'Cantarole dez segundos de uma música que lhe lembra casa. A outra pessoa consegue adivinhar?'],
    ['🍲', 'O jantar imaginário', 'Uma entrada, um prato e uma sobremesa de qualquer uma das duas casas. Criem o vosso menu.'],
    ['🗣️', 'Perdido na tradução', 'Escolha uma palavra em crioulo, francês ou português. Descreva-a sem traduzir. A outra pessoa tenta adivinhar.'],
    ['✏️', 'Um postal em cinco palavras', 'Descreva o seu dia em exatamente cinco palavras. A outra pessoa inventa a história por trás delas.'],
    ['🧳', 'Uma hora em casa', 'Imagine chegar à outra cidade com apenas uma hora livre. Quem visitava e aonde ia?'],
    ['👂', 'Adivinhe o som', 'Grave dez segundos de um som à sua volta. A outra pessoa consegue descobrir o que é?'],
  ],
};
export function getChallenge(index, lang = 'en') {
  const deck = challenges[lang] || challenges.en;
  const [emoji, title, text] = deck[((index % deck.length) + deck.length) % deck.length];
  return { emoji, title, text };
}
