// Built-in exercises, written for this project. Exercises copied from method books
// (Suzuki, I Can Read Music, ...) are copyrighted: never add them to this file.
// The tunes marked (traditional) are traditional melodies written fresh for this
// project, in A major, first position, with repeats written out.

export type SampleId =
  | 'open-strings'
  | 'a-string-fingers'
  | 'd-major-scale'
  | 'repeated-notes'
  | 'twinkle'
  | 'lightly-row'
  | 'song-of-the-wind'
  | 'go-tell-aunt-rhody'
  | 'o-come-little-children'
  | 'may-song'
  | 'long-long-ago'

export interface SampleExercise {
  id: SampleId
  abc: string
}

export const SAMPLE_EXERCISES: SampleExercise[] = [
  {
    id: 'open-strings',
    abc: `X:1
T:Open strings
M:4/4
L:1/4
K:D
G,2 D2 | A2 e2 | e2 A2 | D2 G,2 |]`,
  },
  {
    id: 'a-string-fingers',
    abc: `X:1
T:A string: fingers 0 to 3
M:4/4
L:1/4
K:D
A B c d | d c B A | A B c d | A4 |]`,
  },
  {
    id: 'd-major-scale',
    abc: `X:1
T:D major scale, one octave
M:4/4
L:1/4
K:D
D E F G | A B c d | d c B A | G F E D |]`,
  },
  {
    id: 'repeated-notes',
    abc: `X:1
T:Repeated notes (lift or change the bow between notes)
M:4/4
L:1/4
K:D
A A B B | c c d2 | d d c c | B B A2 |]`,
  },
  {
    id: 'twinkle',
    abc: `X:1
T:Twinkle, Twinkle, Little Star (traditional)
M:4/4
L:1/4
K:A
A A e e | f f e2 | d d c c | B B A2 |]`,
  },
  {
    id: 'lightly-row',
    abc: `X:1
T:Lightly Row (traditional)
M:4/4
L:1/4
K:A
e c c2 | d B B2 | A B c d | e e e2 | e c c2 | d B B2 | A c e e | c4 |
B B B B | B c d2 | c c c c | c d e2 | e c c2 | d B B2 | A c e e | A4 |]`,
  },
  {
    id: 'song-of-the-wind',
    abc: `X:1
T:Song of the Wind (traditional)
M:2/4
L:1/8
K:A
A B c d | e e e2 | f d a f | e4 | f d a f | e4 | e d d d | d c c c | c B B B | B A c e | A4 |]`,
  },
  {
    id: 'go-tell-aunt-rhody',
    abc: `X:1
T:Go Tell Aunt Rhody (traditional)
M:4/4
L:1/4
K:A
c2 c B | A2 A2 | B B d c | B2 A2 | e2 e d | c2 c2 | B A B c | A4 |]`,
  },
  {
    id: 'o-come-little-children',
    abc: `X:1
T:O Come, Little Children (traditional)
M:4/4
L:1/4
K:A
e c e c | e2 d B | d B d B | d2 c A | e c e c | e2 d B | d B d B | d2 c2 |
B B B c | d2 d2 | c c c d | e2 e2 | a f f a | g e e g | f d c B | A4 |]`,
  },
  {
    id: 'may-song',
    abc: `X:1
T:May Song (traditional)
M:4/4
L:1/4
K:A
A c e a | f2 e2 | d e f e | d c B2 | c d e c | d2 B2 | d e f d | e2 c2 |
e f g e | f2 d2 | A c e a | f2 e2 | d f e d | c B A2 |]`,
  },
  {
    id: 'long-long-ago',
    abc: `X:1
T:Long, Long Ago (traditional)
M:4/4
L:1/4
K:A
A A B c | c d e2 | f d e c | B c B2 | A A B c | c d e2 | f d e c | B B A2 |
e e f e | d c d2 | d d e d | c B c2 | A A B c | c d e2 | f d e c | B B A2 |]`,
  },
]
