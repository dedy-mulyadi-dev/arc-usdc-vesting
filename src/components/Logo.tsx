import { useId } from 'react'

interface Props {
  size?: number
  className?: string
}

/**
 * USDC Vesting mark: a "V" whose right arm is the rising release line,
 * ending in a bright node (the moment funds are fully vested).
 * Original artwork. Keep in sync with /public/favicon.svg.
 */
export default function Logo({ size = 36, className }: Props) {
  const uid = useId().replace(/:/g, '')
  const bg = `lg-bg-${uid}`
  const glow = `lg-glow-${uid}`
  const ramp = `lg-ramp-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="USDC Vesting"
    >
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12395c" />
          <stop offset="1" stopColor="#06131f" />
        </linearGradient>
        <radialGradient id={glow} cx="0.78" cy="0.18" r="0.75">
          <stop offset="0" stopColor="#5fc8ff" stopOpacity="0.42" />
          <stop offset="1" stopColor="#5fc8ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ramp} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1a7fd6" />
          <stop offset="1" stopColor="#7beaff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="17" fill={`url(#${bg})`} />
      <rect width="64" height="64" rx="17" fill={`url(#${glow})`} />
      <rect x="0.6" y="0.6" width="62.8" height="62.8" rx="16.4" fill="none" stroke="#fff" strokeOpacity="0.14" strokeWidth="1.2" />
      <line x1="15" y1="19" x2="29.5" y2="47" stroke="#cfe9ff" strokeOpacity="0.92" strokeWidth="8.5" strokeLinecap="round" />
      <line x1="29.5" y1="47" x2="49" y2="17" stroke={`url(#${ramp})`} strokeWidth="8.5" strokeLinecap="round" />
      <circle cx="49.5" cy="15.5" r="5.2" fill="#071a2b" stroke="#8ff0ff" strokeWidth="2.8" />
    </svg>
  )
}
