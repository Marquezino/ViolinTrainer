import { SOLFEGE_NOTE_NAMES } from '../../music/pitch'
import type { Formatters, Messages } from './types'

const plural = new Intl.PluralRules('pt-BR')
const count = (n: number, one: string, other: string, f: Formatters) =>
  `${f.number(n)} ${plural.select(n) === 'one' ? one : other}`
const at = (offset: number, f: Formatters) => `no caractere ${f.number(offset)}`

export const ptBR: Messages = {
  appName: 'Violin Trainer',
  noteNames: SOLFEGE_NOTE_NAMES,
  languageLabel: 'Idioma',
  untitled: 'Sem título',

  picker: {
    exercisesHeading: 'Exercícios',
    ownAbcHeading: 'Seu próprio ABC',
    starterTitle: 'Meu exercício',
    abcLabel: 'Notação ABC',
    previewLabel: 'Prévia da partitura',
    practiceThis: 'Praticar este',
  },

  practice: {
    back: '← Exercícios',
    startPrompt: 'Quando você apertar Começar, fique em silêncio por dois segundos enquanto o app escuta a sala.',
    start: 'Começar',
    tryAgain: 'Tentar de novo',
    playAgain: 'Tocar de novo',
    roomCheck: 'Fique em silêncio… estou escutando a sala.',
    heardPlaying:
      'Ouvi alguém tocando enquanto eu escutava a sala. Fique em silêncio até eu terminar e depois comece a tocar.',
    tooNoisy: (db, f) =>
      `A sala está barulhenta demais para avaliar bem as notas (${f.number(db)} dB). Feche as janelas ou se afaste do barulho e tente de novo.`,
    noisyRoomHint: 'A sala está um pouco barulhenta: toque com um som bem cheio para que cada nota seja ouvida.',
    audioProcessingHint: (processing) =>
      `O navegador deixou o processamento de áudio ligado (${processing.join(', ')}). As notas podem ser avaliadas com menos precisão. Tente outro navegador ou outro microfone.`,
    wrongNote: (note) => `Você tocou ${note}. Tente de novo.`,
    outOfTune: 'Nota certa, mas desafinada. Ajuste e toque de novo.',
    summary: (points, maxPoints, f) =>
      `${f.number(points)} de ${count(maxPoints, 'ponto', 'pontos', f)}. As notas verdes estavam afinadas, as amarelas um pouco desafinadas, e as vermelhas precisaram de mais de uma tentativa.`,
    starsLabel: (stars, maxStars, f) => `${f.number(stars)} de ${count(maxStars, 'estrela', 'estrelas', f)}`,
  },

  needle: {
    prompt: 'Toque a nota destacada',
    playing: (note) => `Você está tocando ${note}`,
    cents: (cents, direction, f) => `${count(cents, 'cent', 'cents', f)} ${direction === 'sharp' ? 'acima' : 'abaixo'}`,
    inTune: 'Afinado',
    flatLabel: 'abaixo',
    sharpLabel: 'acima',
  },

  microphoneErrors: {
    denied:
      'O acesso ao microfone está bloqueado. Clique no ícone do microfone na barra de endereço, permita o acesso e aperte Começar de novo.',
    notFound: 'Nenhum microfone foi encontrado. Conecte um e aperte Começar de novo.',
    unsupported: 'Este navegador não consegue analisar o som do microfone. Use uma versão atual do Chrome ou do Firefox.',
    other: 'Não foi possível ligar o microfone.',
  },

  voiceProcessing: {
    autoGainControl: 'volume automático',
    noiseSuppression: 'supressão de ruído',
    echoCancellation: 'cancelamento de eco',
  },

  abcProblems: {
    noTune: () => 'Nenhuma música encontrada. Um exercício precisa de uma linha X: e de uma linha K:.',
    multipleTunes: () => 'Escreva só uma música por exercício.',
    abcSyntax: (p, f) => {
      if (p.line === null) return `O ABC tem um erro de escrita: ${p.detail}`
      const column = p.column === null ? '' : `, coluna ${f.number(p.column)}`
      return `O ABC tem um erro de escrita na linha ${f.number(p.line)}${column}: ${p.detail}`
    },
    multipleVoices: () => 'Só dá para usar uma linha de melodia (uma pauta, uma voz).',
    repeats: (p, f) =>
      `Sinais de repetição e casas de 1ª e 2ª vez ainda não são aceitos; escreva a música inteira, copiando os trechos que se repetem (${at(p.at, f)}).`,
    chord: (p, f) => `Acordes e cordas duplas ainda não são aceitos (${at(p.at, f)}).`,
    graceNotes: (p, f) => `Apojaturas ainda não são aceitas (${at(p.at, f)}).`,
    tieDifferentPitch: (p, f) =>
      `Uma ligadura de prolongamento precisa unir duas notas iguais; use ( ) para uma ligadura de expressão (${at(p.at, f)}).`,
    unknownPitch: (p, f) => `Não foi possível descobrir qual é a nota ${at(p.at, f)}.`,
    belowViolin: (p, f) =>
      `${f.note(p.midi)} está abaixo da nota mais grave do violino (${f.note(p.lowestMidi)}) (${at(p.at, f)}).`,
    tooHigh: (p, f) =>
      `${f.note(p.midi)} é aguda demais para ser reconhecida; a nota mais aguda aceita é ${f.note(p.highestMidi)} (${at(p.at, f)}).`,
    fingerFive: (p, f) => `O dedo 5 não existe no violino (${at(p.at, f)}).`,
    fingerImpossible: (p, f) =>
      `${f.note(p.midi)} não pode ser tocada com o dedo ${p.finger} na primeira posição (${at(p.at, f)}).`,
    outsideFirstPosition: (p, f) =>
      `${f.note(p.midi)} está fora da primeira posição; não aparece dica para ela (${at(p.at, f)}).`,
    noNotes: () => 'O exercício não tem notas.',
  },

  toleranceProblems: {
    greenNotPositive: 'A tolerância verde precisa ser maior que 0 cents.',
    yellowBelowGreen: 'A tolerância amarela não pode ser menor que a verde.',
    yellowTooWide: 'A tolerância amarela precisa ficar abaixo de 50 cents (meio semitom).',
  },

  sampleTitles: {
    'open-strings': 'Cordas soltas',
    'a-string-fingers': 'Corda Lá: dedos 0 a 3',
    'd-major-scale': 'Escala de Ré maior, uma oitava',
    'repeated-notes': 'Notas repetidas (levante ou troque o arco entre as notas)',
    twinkle: 'Brilha, brilha, estrelinha (tradicional)',
  },
}
