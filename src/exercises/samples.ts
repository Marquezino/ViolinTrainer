// Built-in exercises, written for this project. Exercises copied from method books
// (Suzuki, I Can Read Music, ...) are copyrighted: never add them to this file.

export interface SampleExercise {
  id: string
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
]
