import { useId, useState } from 'react'

interface Props {
  /** Amount typed by the user, in USDC. */
  amount: number | null
  /** Duration in seconds, as it will be sent to the contract. */
  durationSecs: bigint | null
  startNow: boolean
  /** Raw datetime-local value when startNow is false. */
  startDate: string
}

const fmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: n < 1 ? 4 : 2 })

/**
 * Visual preview of the linear release. UI only: it is computed from the form
 * values and never reads the chain, so it cannot disagree with the contract's
 * math (amount * elapsed / duration).
 */
export default function ReleasePreview({ amount, durationSecs, startNow, startDate }: Props) {
  const uid = useId().replace(/:/g, '')
  // Captured once on mount: the end date is only an estimate (the contract uses block time).
  const [mountedAt] = useState(() => Date.now())
  if (amount == null || amount <= 0 || durationSecs == null || durationSecs <= 0n) return null

  const secs = Number(durationSecs)
  if (!Number.isFinite(secs) || secs <= 0) return null

  // Pick a readable unit.
  let unit: 'day' | 'hour' | 'minute'
  let span: number
  if (secs >= 2 * 86400) { unit = 'day'; span = secs / 86400 }
  else if (secs >= 2 * 3600) { unit = 'hour'; span = secs / 3600 }
  else { unit = 'minute'; span = secs / 60 }
  const rate = amount / span
  const unitLabel = unit.charAt(0).toUpperCase() + unit.slice(1)

  const startMs = startNow ? mountedAt : startDate ? new Date(startDate).getTime() : NaN
  const endLabel = Number.isFinite(startMs)
    ? new Date(startMs + secs * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const area = `rp-area-${uid}`
  const line = `rp-line-${uid}`

  return (
    <div
      className="rounded-2xl px-4 pt-3.5 pb-3"
      style={{ background: 'linear-gradient(180deg,#f3f8fd,#eef4fa)', border: '1px solid rgba(16,97,166,0.14)' }}
      aria-label="Release preview"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="display text-[15px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
          {fmt(rate)} USDC / {unit}
        </span>
        {endLabel && (
          <span className="text-xs text-right" style={{ color: 'var(--muted)' }}>
            Fully vested ≈ {endLabel}
          </span>
        )}
      </div>

      <svg viewBox="0 0 300 78" preserveAspectRatio="none" className="block w-full mt-1" style={{ height: 78 }} aria-hidden="true">
        <defs>
          <linearGradient id={area} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a9be0" stopOpacity="0.30" />
            <stop offset="1" stopColor="#1a9be0" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={line} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1061a6" />
            <stop offset="1" stopColor="#2aa6e6" />
          </linearGradient>
        </defs>
        <line x1="0" y1="70" x2="300" y2="70" stroke="#1061a6" strokeOpacity="0.18" strokeWidth="1" />
        <polygon points="0,70 300,10 300,70" fill={`url(#${area})`} />
        <line x1="0" y1="70" x2="300" y2="10" stroke={`url(#${line})`} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>

      <div className="flex justify-between text-[11px] mt-0.5" style={{ color: 'var(--subtle)' }}>
        <span>{unitLabel} 0 · 0 USDC</span>
        <span>{unitLabel} {fmt(span)} · {fmt(amount)} USDC</span>
      </div>
    </div>
  )
}
