import { useEffect, useRef } from 'react'
import abcjs from 'abcjs'
import type { TuneObject } from 'abcjs'
import { fingeringLabel } from '../music/fingering'
import type { WaitSessionState } from '../practice/wait-session'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** abcjs sets `abselem` on rendered note items; its type definitions leave it out. */
interface RenderedItem {
  el_type: string
  startChar: number
  abselem?: { elemset: SVGElement[] }
}

/** Maps each note's ABC character offset to the SVG elements abcjs drew for it. */
function collectNoteElements(tune: TuneObject): Map<number, SVGElement[]> {
  const map = new Map<number, SVGElement[]>()
  for (const line of tune.lines) {
    for (const staff of line.staff ?? []) {
      for (const voice of staff.voices ?? []) {
        for (const item of voice as unknown as RenderedItem[]) {
          if (item.el_type === 'note' && item.abselem) map.set(item.startChar, item.abselem.elemset)
        }
      }
    }
  }
  return map
}

export function ScoreView({ session }: { session: WaitSessionState }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const elementsRef = useRef(new Map<number, SVGElement[]>())
  const { exercise } = session

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const [tune] = abcjs.renderAbc(container, exercise.abc, { add_classes: true, responsive: 'resize' })
    elementsRef.current = tune ? collectNoteElements(tune) : new Map()
  }, [exercise.abc])

  useEffect(() => {
    containerRef.current?.querySelectorAll('.vt-hint').forEach((el) => el.remove())
    exercise.targets.forEach((target, i) => {
      const elements = elementsRef.current.get(target.sourceStart)
      if (!elements || elements.length === 0) return
      const state = session.targets[i]
      const current = i === session.cursor && !session.finished
      for (const el of elements) {
        el.classList.toggle('vt-current', current)
        el.classList.toggle('vt-green', state.color === 'green')
        el.classList.toggle('vt-yellow', state.color === 'yellow')
        el.classList.toggle('vt-missed', state.redAttempts > 0)
      }
      if (state.hintVisible && target.fingering && !session.finished) {
        const group = elements[0] as SVGGraphicsElement
        const box = group.getBBox()
        const text = document.createElementNS(SVG_NS, 'text')
        text.setAttribute('class', 'vt-hint')
        text.setAttribute('x', String(box.x + box.width / 2))
        text.setAttribute('y', String(box.y - 8))
        text.setAttribute('text-anchor', 'middle')
        text.textContent = fingeringLabel(target.fingering)
        group.parentNode?.appendChild(text)
      }
    })
  }, [session, exercise])

  return <div className="score" ref={containerRef} />
}
