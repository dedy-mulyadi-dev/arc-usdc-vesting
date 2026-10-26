import { useState } from 'react'
import { Search } from 'lucide-react'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import ScheduleView from './ScheduleView'
import type { NetworkConfig } from '@/networkConfig'

const glass = {
  card: { background: 'var(--surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border)' } as React.CSSProperties,
  inner: { background: 'var(--surface-muted)', border: '1px solid var(--border)' } as React.CSSProperties,
}

interface Props {
  net: NetworkConfig
  wrongChain: boolean
  onSwitchChain: () => void
}

export default function LookupSchedule({ net, wrongChain, onSwitchChain }: Props) {
  const { address } = useAccount()

  const [senderInput, setSenderInput]     = useState('')
  const [beneficiaryInput, setBenefInput] = useState('')
  const [queried, setQueried] = useState<{ sender: `0x${string}`; beneficiary: `0x${string}` } | null>(null)

  const senderValid      = isAddress(senderInput)
  const beneficiaryValid = isAddress(beneficiaryInput)
  const canLookup        = senderValid && beneficiaryValid

  function handleLookup() {
    if (!canLookup) return
    setQueried({ sender: senderInput, beneficiary: beneficiaryInput })
  }

  function fillAsSender()      { if (address) setSenderInput(address) }
  function fillAsBeneficiary() { if (address) setBenefInput(address) }

  const isSender      = queried && address?.toLowerCase() === queried.sender.toLowerCase()
  const isBeneficiary = queried && address?.toLowerCase() === queried.beneficiary.toLowerCase()

  return (
    <div className="space-y-4">
      <div className="rounded-3xl p-5 space-y-4" style={glass.card}>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-xl" style={{ background: 'rgba(18,45,69,0.08)' }}>
            <Search className="size-4" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="display text-base font-semibold" style={{ color: 'var(--ink)' }}>View a Schedule</h2>
        </div>

        {[
          { label: 'Sender Address',      value: senderInput,      set: setSenderInput,  fill: fillAsSender },
          { label: 'Beneficiary Address', value: beneficiaryInput, set: setBenefInput,   fill: fillAsBeneficiary },
        ].map(({ label, value, set, fill }) => (
          <div key={label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)' }}>
                {label}
              </label>
              {address && (
                <button className="text-xs font-semibold" style={{ color: 'var(--accent-hover)' }} onClick={fill}>
                  Use my address
                </button>
              )}
            </div>
            <div className="rounded-2xl px-4 py-3" style={glass.inner}>
              <input
                className="w-full bg-transparent text-sm outline-none mono placeholder:text-slate-400"
                style={{ color: 'var(--ink)' }}
                placeholder="0x…"
                value={value}
                onChange={e => set(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>
        ))}

        <button
          disabled={!canLookup}
          onClick={handleLookup}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          Look up schedule
        </button>
      </div>

      {queried && (
        <ScheduleView
          net={net}
          senderAddress={queried.sender}
          beneficiaryAddress={queried.beneficiary}
          canClaim={!!isBeneficiary}
          canCancel={!!isSender}
          wrongChain={wrongChain}
          onSwitchChain={onSwitchChain}
        />
      )}
    </div>
  )
}
