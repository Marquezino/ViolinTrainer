import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'

/** A field label with an optional help tip; the label points at the control with the id it is given. */
export function Field(props: { label: string; help?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <span className="field-label">
        <label htmlFor={id}>{props.label}</label>
        {props.help && <HelpTip label={props.label} text={props.help} />}
      </span>
      {props.children(id)}
    </div>
  )
}

/** Space kept between the hint and the edge of the screen, in px. */
const EDGE = 8

/**
 * A round "?" next to a field label. The hint shows on hover and on keyboard focus, and a tap or
 * click keeps it open (tablets have no hover). Escape or a tap outside closes it. The hint is
 * also the button's description, so screen readers read it with the button.
 */
export function HelpTip({ label, text }: { label: string; text: string }) {
  const { t } = useI18n()
  const id = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  // Opened by a tap or click: stays open when the pointer leaves.
  const [pinned, setPinned] = useState(false)
  const [shift, setShift] = useState(0)

  const close = () => {
    setOpen(false)
    setPinned(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  // Keeps the hint inside the screen: it is centred on the button, then moved in from an edge.
  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!open || !tip) {
      setShift(0)
      return
    }
    // Measured unshifted: the shift was reset to 0 when the hint last closed.
    const rect = tip.getBoundingClientRect()
    const width = document.documentElement.clientWidth
    let move = 0
    if (rect.right > width - EDGE) move = width - EDGE - rect.right
    if (rect.left + move < EDGE) move = EDGE - rect.left
    setShift(move)
  }, [open])

  return (
    <span
      className="help-tip"
      ref={rootRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false)
      }}
    >
      <button
        type="button"
        className="help-tip-button"
        aria-label={t.help.label(label)}
        aria-describedby={id}
        aria-expanded={open}
        onFocus={() => setOpen(true)}
        onBlur={close}
        onClick={() => {
          if (pinned) close()
          else {
            setOpen(true)
            setPinned(true)
          }
        }}
      >
        <span className="help-tip-circle" aria-hidden="true">
          ?
        </span>
      </button>
      <span
        id={id}
        ref={tipRef}
        role="tooltip"
        className="help-tip-text"
        hidden={!open}
        style={{ '--shift': `${shift}px` } as CSSProperties}
      >
        {text}
      </span>
    </span>
  )
}
