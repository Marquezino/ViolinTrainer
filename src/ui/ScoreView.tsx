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

/** Vertical extent of the staff lines around a note, falling back to the note itself. */
function staffExtent(note: SVGGraphicsElement): { top: number; bottom: number } {
  const staff = note.closest('.abcjs-staff-wrapper')?.querySelector<SVGGraphicsElement>('.abcjs-staff')
  const box = (staff ?? note).getBBox()
  return { top: box.y, bottom: box.y + box.height }
}

/** A bar just before the next note to play, separating what was played from what is to come. */
function drawNextMarker(note: SVGGraphicsElement): void {
  const box = note.getBBox()
  const { top, bottom } = staffExtent(note)
  const marker = document.createElementNS(SVG_NS, 'rect')
  marker.setAttribute('class', 'vt-next')
  marker.setAttribute('x', String(box.x - 9))
  marker.setAttribute('y', String(top - 12))
  marker.setAttribute('width', '3')
  marker.setAttribute('height', String(bottom - top + 24))
  marker.setAttribute('rx', '1.5')
  note.parentNode?.appendChild(marker)
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
    containerRef.current?.querySelectorAll('.vt-hint, .vt-next').forEach((el) => el.remove())
    exercise.targets.forEach((target, i) => {
      // A tied note is one target drawn as several notes; all of them show its state.
      const elements = target.sourceStarts.flatMap((at) => elementsRef.current.get(at) ?? [])
      if (elements.length === 0) return
      const state = session.targets[i]
      const current = i === session.cursor && !session.finished
      // One color per note: red when it needed more than one try, else how well it was played.
      const missed = state.redAttempts > 0
      for (const el of elements) {
        el.classList.toggle('vt-current', current && !missed)
        el.classList.toggle('vt-green', state.color === 'green' && !missed)
        el.classList.toggle('vt-yellow', state.color === 'yellow' && !missed)
        el.classList.toggle('vt-missed', missed)
      }
      if (current) drawNextMarker(elements[0] as SVGGraphicsElement)
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
