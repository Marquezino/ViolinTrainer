import { SOLFEGE_NOTE_NAMES } from '../../music/pitch'
import type { Formatters, Messages } from './types'

const count = (n: number, one: string, other: string, f: Formatters) =>
  `${f.number(n)} ${f.plural(n) === 'one' ? one : other}`
const at = (offset: number, f: Formatters) => `no caractere ${f.number(offset)}`
/** Tempo de prática como m:ss, arredondado para baixo. */
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const STREAK_NAMES = { easy: 'sequência de dias tocando', practice: 'sequência de metas' } as const

export const ptBR: Messages = {
  appName: 'Violin Trainer',
  noteNames: SOLFEGE_NOTE_NAMES,
  languageLabel: 'Idioma',
  untitled: 'Sem título',
  startupFailed: 'O Violin Trainer não conseguiu abrir. Recarregue a página.',

  picker: {
    back: '← Configurações',
    ownAbcHeading: 'Seu próprio ABC',
    starterTitle: 'Meu exercício',
    abcLabel: 'Notação ABC',
    previewLabel: 'Prévia da partitura',
    practiceThis: 'Praticar este',
  },

  practice: {
    back: '← Voltar',
    backToPath: '← Trilha',
    backToPathButton: 'Voltar para a trilha',
    goalReached: 'Meta de hoje alcançada! 🎉 Continue se quiser.',
    today: (ms, goal, f) => `Hoje: ${clock(ms)} de ${f.number(goal)} min`,
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

  tuning: {
    heading: 'Afine o violino',
    intro: 'Toque cada corda solta. Gire a cravelha ou o microafinador até a agulha ficar verde. A corda que você está tocando fica destacada.',
    stringsLabel: 'Cordas soltas',
    listen: 'Começar a ouvir',
    prompt: 'Toque uma corda solta',
    skip: 'Pular',
    ready: 'Pronto',
    dontShowAgain: 'Não mostrar antes de praticar',
  },

  leaderboard: {
    heading: 'Esta semana',
    open: '🏆 Esta semana',
    back: '← Voltar',
    empty: 'Adicione um jogador nas Configurações para começar o placar da semana.',
    subtitle: 'Ordenado pelos dias em que a meta foi alcançada, de segunda a domingo.',
    placeLabel: (place, f) => `Posição ${f.number(place)}`,
    goalDays: (days, f) => `${count(days, 'dia de meta', 'dias de meta', f)}`,
    runs: (runs, f) => `${count(runs, 'execução completa', 'execuções completas', f)}`,
  },

  profiles: {
    heading: 'Quem vai praticar?',
    addFirst: 'Adicionar o primeiro jogador',
    settings: '⚙ Configurações',
    avatars: {
      violin: 'violino',
      note: 'nota musical',
      clef: 'partitura',
      star: 'estrela',
      sun: 'sol',
      moon: 'lua',
      bird: 'passarinho',
      cat: 'gato',
      dog: 'cachorro',
      flower: 'flor',
      tree: 'árvore',
      heart: 'coração',
    },
  },

  path: {
    back: '← Jogadores',
    todayTime: (ms, goal, f) => `${clock(ms)} de ${f.number(goal)} min`,
    goalRingLabel: (ms, goal, f) => `Prática de hoje: ${clock(ms)} de ${count(goal, 'minuto', 'minutos', f)}`,
    weekLabel: (days, f) => `Meta alcançada em ${count(days, 'dia', 'dias', f)} nesta semana`,
    locked: 'Bloqueado',
    next: 'Próximo',
    empty: 'Ainda não há exercícios. Peça a um adulto para adicionar alguns nas configurações.',
    brokenExercise: 'Este exercício não pode ser tocado: a música tem um erro de escrita.',
  },

  streaks: {
    names: STREAK_NAMES,
    label: (streak, days, f) =>
      `${streak === 'easy' ? 'Sequência de dias tocando' : 'Sequência de metas'}: ${count(days, 'dia', 'dias', f)}`,
  },

  notes: {
    balanceLabel: (n, f) => `${count(n, 'nota', 'notas', f)} para consertar sequências`,
    broke: (streak) => `Sua ${STREAK_NAMES[streak]} quebrou ontem.`,
    repairOffer: (restores, icon, cost, f) => `Consertar para ${f.number(restores)} ${icon} por ${f.number(cost)} ♪`,
    missing: (n, f) => `Faltam ${count(n, 'nota', 'notas', f)}.`,
    confirm: (cost, f) => `Gastar ${f.number(cost)} ♪ para consertar ontem? Não dá para desfazer.`,
    confirmYes: 'Sim, consertar',
    cancel: 'Cancelar',
    errors: {
      noOffer: 'Este conserto não está mais disponível.',
      notAffordable: 'Não há notas suficientes para este conserto.',
      other: 'Não foi possível salvar o conserto. Tente de novo.',
    },
  },

  celebrations: {
    goalReached: 'Você alcançou a meta de hoje! 🎉',
    streakMilestone: (streak, days, f) => `${count(days, 'dia', 'dias', f)} de ${STREAK_NAMES[streak]}! 🔥`,
    newBestStars: (stars, f) => `Novo recorde: ${count(stars, 'estrela', 'estrelas', f)}!`,
    dismiss: 'Fechar',
  },

  settings: {
    heading: 'Configurações',
    back: '← Jogadores',
    playersHeading: 'Jogadores',
    newPlayerName: 'Nome do novo jogador',
    avatar: 'Figura',
    addPlayer: 'Adicionar jogador',
    nameRequired: 'Digite um nome primeiro.',
    name: 'Nome',
    goal: 'Meta diária (minutos)',
    greenCents: 'Verde (cents)',
    yellowCents: 'Amarelo (cents)',
    skipTuning: 'Pular a tela de afinação',
    save: 'Salvar',
    saved: 'Salvo.',
    deletePlayer: 'Excluir jogador',
    deleteConfirm: (name) => `Excluir ${name}? O jogador some da lista; as execuções continuam nos dados e nos backups.`,
    deleteYes: 'Sim, excluir',
    cancel: 'Cancelar',
    a4Heading: 'Referência de afinação',
    a4Label: 'Lá4 (Hz)',
    a4Problem: (min, max, f) => `O Lá4 precisa ficar entre ${f.number(min)} e ${f.number(max)} Hz.`,
    otherHeading: 'Outros',
    tryAbc: 'Experimentar seu próprio ABC',
  },

  backup: {
    heading: 'Backup',
    export: 'Exportar backup',
    import: 'Importar backup',
    reminderLabel: 'Lembrete de backup',
    lastBackupNever: 'Último backup: nunca',
    lastBackupDaysAgo: (days, f) => `Último backup: há ${count(days, 'dia', 'dias', f)}`,
    reminderDismiss: 'Agora não',
    problems: {
      notJson: 'Não foi possível ler este arquivo: ele não é um backup ou está danificado.',
      notABackup: 'Este arquivo não é um backup do Violin Trainer.',
      newerVersion: 'Este backup vem de uma versão mais nova do app. Atualize o app e depois importe.',
    },
    confirm: (profiles, attempts, f) =>
      `Este backup tem ${count(profiles, 'jogador', 'jogadores', f)} e ${count(attempts, 'execução', 'execuções', f)}. Importar substitui todos os dados deste navegador; antes, uma cópia dos dados atuais é baixada.`,
    replace: 'Substituir meus dados',
    cancel: 'Cancelar',
    restored: 'Backup restaurado.',
    failed: 'Não foi possível restaurar o backup. Seus dados não foram alterados.',
  },

  storage: {
    notSaved:
      'Esta janela não consegue salvar o progresso (navegação anônima?). Dá para praticar, mas nada fica guardado depois de fechar.',
    persistence: {
      granted: 'Este navegador guarda os dados.',
      denied: 'Este navegador pode apagar os dados: instale o app ou exporte backups com frequência.',
      unsupported: 'Este navegador pode apagar os dados: exporte backups com frequência.',
    },
  },

  microphoneErrors: {
    denied:
      'O acesso ao microfone está bloqueado. Clique no ícone do microfone na barra de endereços, permita o acesso e aperte Começar de novo.',
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
    'lightly-row': 'Remar, remar (tradicional)',
    'song-of-the-wind': 'Canção do vento (tradicional)',
    'go-tell-aunt-rhody': 'Vá contar à tia Rhody (tradicional)',
    'o-come-little-children': 'Vinde, meninos (tradicional)',
    'may-song': 'Canção de maio (tradicional)',
    'long-long-ago': 'Há muito tempo (tradicional)',
  },
  unitTitles: {
    'first-steps': 'Primeiros passos',
    'traditional-tunes': 'Melodias tradicionais',
  },
}
