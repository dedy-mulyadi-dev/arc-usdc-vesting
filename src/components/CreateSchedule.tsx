import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { erc20Abi, isAddress, zeroAddress } from 'viem'
import { Loader2, Plus, ExternalLink, AlertTriangle, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { VESTING_VAULT_ABI, getVestingVaultAddress } from '@/vestingVault'
import { buildTxUrl } from '@/networkConfig'
import type { NetworkConfig } from '@/networkConfig'
import { Amount } from '@/onchain-money'

const glass = {
  card: { background: 'var(--surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border)' } as React.CSSProperties,
  inner: { background: 'var(--surface-muted)', border: '1px solid var(--border)' } as React.CSSProperties,
}

const UNIT_TO_SECS = { minutes: 60, hours: 3600, days: 86400 } as const

interface Props {
  net: NetworkConfig
  wrongChain: boolean
  onSwitchChain: () => void
}

export default function CreateSchedule({ net, wrongChain, onSwitchChain }: Props) {
  const { address, isConnected } = useAccount()

  // ── Form state — NEVER cleared by approve or wallet changes ─────────────
  const [beneficiary, setBeneficiary] = useState('')
  const [amount, setAmount] = useState('')
  const [durationValue, setDurationValue] = useState('')
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days'>('days')
  const [startNow, setStartNow] = useState(true)
  const [startDate, setStartDate] = useState('')

  // ── Confirmation panel ───────────────────────────────────────────────────
  const [confirming, setConfirming] = useState(false)
  const [selfConfirmed, setSelfConfirmed] = useState(false)

  // ── Derived values ────────────────────────────────────────────────────────
  const beneficiaryValid = isAddress(beneficiary) && beneficiary !== zeroAddress
  const beneficiaryInvalid = beneficiary.length > 0 && !beneficiaryValid

  const isSelf = !!address && beneficiaryValid &&
    address.toLowerCase() === beneficiary.toLowerCase()

  const parsedAmount = (() => {
    try {
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) return null
      const raw = BigInt(Math.round(parseFloat(amount) * 10 ** net.usdcDecimals))
      return { raw, display: amount }
    } catch { return null }
  })()

  const durationSecs = durationValue
    ? BigInt(Math.round(parseFloat(durationValue) * UNIT_TO_SECS[durationUnit]))
    : null
  const resolvedStart: bigint | null = startNow
    ? 0n
    : startDate ? BigInt(Math.floor(new Date(startDate).getTime() / 1000)) : null

  const durationLabel = durationValue ? `${durationValue} ${durationUnit}` : '—'
  const startLabel = startNow
    ? 'Immediately (block.timestamp)'
    : startDate ? new Date(startDate).toLocaleString() : '—'

  const formValid = isConnected && !wrongChain && beneficiaryValid && !!parsedAmount &&
    !!durationSecs && durationSecs > 0n && resolvedStart !== null

  // ── USDC balance ──────────────────────────────────────────────────────────
  const { data: usdcBalance } = useReadContract({
    address: net.usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
    chainId: net.chainId,
    query: { enabled: !!address && !wrongChain },
  })
  const formattedBalance = usdcBalance != null
    ? Amount.fromRaw(usdcBalance, net.usdcDecimals).toFixed(2)
    : null

  // ── Live onchain allowance ────────────────────────────────────────────────
  const vaultAddress = getVestingVaultAddress(net.key)
  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: net.usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [address!, vaultAddress],
    chainId: net.chainId,
    query: { enabled: !!address && !wrongChain, refetchInterval: 4_000 },
  })
  const allowance = (allowanceRaw ?? 0n)
  const approveSuccess = parsedAmount != null && allowance >= parsedAmount.raw

  // ── Step 1: approve exact amount ──────────────────────────────────────────
  const { writeContract: approve, data: approveTxHash, isPending: approvePending } = useWriteContract()
  const { isLoading: approveConfirming } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    query: { enabled: !!approveTxHash },
  })

  // ── Step 2: createSchedule ────────────────────────────────────────────────
  const { writeContract: create, data: createTxHash, isPending: createPending, reset: resetCreate } = useWriteContract()
  const { isLoading: createConfirming, isSuccess: createSuccess } = useWaitForTransactionReceipt({ hash: createTxHash })

  const canConfirmCreate = approveSuccess && formValid && (!isSelf || selfConfirmed)

  function handleApprove() {
    if (!parsedAmount) return
    if (wrongChain) { onSwitchChain(); return }
    // Approve EXACT amount only — never unlimited
    approve({
      address: net.usdcAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [vaultAddress, parsedAmount.raw],
      chainId: net.chainId,
    }, {
      onSuccess: () => void refetchAllowance(),
      onError: (e) => toast.error(e.message.slice(0, 80)),
    })
  }

  function handleCreate() {
    if (!parsedAmount || durationSecs === null || resolvedStart === null) return
    if (wrongChain) { onSwitchChain(); return }
    create({
      address: vaultAddress,
      abi: VESTING_VAULT_ABI,
      functionName: 'createSchedule',
      // startTime = 0n → contract resolves to block.timestamp
      args: [beneficiary as `0x${string}`, parsedAmount.raw, resolvedStart, durationSecs],
      chainId: net.chainId,
    }, {
      onSuccess: () => {
        toast.success('Vesting schedule created!')
        void refetchAllowance()
        // Reset to step 1 and clear form after short delay so user sees success
        setTimeout(() => {
          resetCreate()
          setConfirming(false)
          setSelfConfirmed(false)
          setBeneficiary('')
          setAmount('')
          setDurationValue('')
          setDurationUnit('days')
          setStartNow(true)
          setStartDate('')
        }, 2500)
      },
      onError: (e) => toast.error(e.message.slice(0, 80)),
    })
  }

  const txUrl = createTxHash ? buildTxUrl(net, createTxHash) : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-3xl p-5 space-y-4" style={glass.card}>
      {/* Header */}
      <div className="flex items-center gap-2">
        {confirming && (
          <button
            onClick={() => { setConfirming(false); setSelfConfirmed(false) }}
            className="p-1 rounded-lg hover:opacity-70 transition-opacity"
            aria-label="Back to form"
          >
            <ChevronLeft className="size-4" style={{ color: 'var(--muted)' }} />
          </button>
        )}
        <div className="flex size-7 items-center justify-center rounded-xl" style={{ background: 'rgba(18,45,69,0.08)' }}>
          <Plus className="size-4" style={{ color: 'var(--accent)' }} />
        </div>
        <h2 className="display text-base font-semibold" style={{ color: 'var(--ink)' }}>
          {confirming ? 'Confirm Schedule' : 'Create Vesting Schedule'}
        </h2>
      </div>

      {/* Wrong-chain banner */}
      {wrongChain && (
        <div className="flex items-center justify-between rounded-2xl px-3 py-2.5"
          style={{ background: 'rgba(180,130,0,0.08)', border: '1px solid rgba(180,130,0,0.25)' }}>
          <span className="text-xs" style={{ color: '#b48200' }}>
            Switch to {net.label} to continue
          </span>
          <button
            onClick={onSwitchChain}
            className="text-xs font-semibold px-2 py-1 rounded-lg"
            style={{ background: 'rgba(180,130,0,0.15)', color: '#b48200' }}
          >
            Switch
          </button>
        </div>
      )}

      {/* ── CONFIRMATION PANEL ── */}
      {confirming ? (
        <div className="space-y-4">
          {/* Self-beneficiary warning + required checkbox */}
          {isSelf && (
            <div className="rounded-2xl px-3 py-3 space-y-2"
              style={{ background: 'rgba(180,130,0,0.08)', border: '1px solid rgba(180,130,0,0.25)' }}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" style={{ color: '#b48200' }} />
                <p className="text-xs leading-relaxed font-medium" style={{ color: '#b48200' }}>
                  You are vesting to your own address. You will be both sender and beneficiary.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selfConfirmed}
                  onChange={e => setSelfConfirmed(e.target.checked)}
                  className="rounded"
                />
                <span className="text-xs" style={{ color: '#b48200' }}>
                  I understand and want to proceed
                </span>
              </label>
            </div>
          )}

          {/* Summary rows — full addresses, monospace, selectable */}
          <div className="space-y-1.5">
            {[
              { label: 'Sender (you)', value: address ?? '—', mono: true },
              { label: 'Beneficiary', value: beneficiary, mono: true },
              { label: 'Amount', value: `${amount} USDC` },
              { label: 'Duration', value: durationLabel },
              { label: 'Start', value: startLabel },
              { label: 'Network', value: net.label },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex items-start justify-between gap-3 rounded-xl px-3 py-2" style={glass.inner}>
                <span className="text-xs shrink-0 pt-0.5" style={{ color: 'var(--muted)' }}>{label}</span>
                <span
                  className={`text-xs text-right break-all select-all leading-relaxed ${mono ? 'mono' : 'font-medium'}`}
                  style={{ color: 'var(--ink)' }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Step 1: Approve — also blocked until self-vesting checkbox is ticked */}
          {!approveSuccess && (
            <button
              disabled={!formValid || approvePending || approveConfirming || wrongChain || (isSelf && !selfConfirmed)}
              onClick={handleApprove}
              className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
            >
              {!isConnected ? 'Connect wallet'
                : wrongChain ? `Switch to ${net.label}`
                : approvePending
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirm in wallet…</span>
                  : approveConfirming
                  ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Approving…</span>
                  : `1 of 2 — Approve ${amount} USDC`}
            </button>
          )}

          {/* Step 2: Confirm & Create */}
          {approveSuccess && (
            <button
              disabled={!canConfirmCreate || createPending || createConfirming || createSuccess}
              onClick={handleCreate}
              className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: 'var(--accent)' }}
            >
              {createPending
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirm in wallet…</span>
                : createConfirming
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirming…</span>
                : createSuccess
                ? 'Schedule created!'
                : '2 of 2 — Confirm & Create'}
            </button>
          )}

          {txUrl && createSuccess && (
            <a href={txUrl} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-medium"
              style={{ color: 'var(--accent-hover)' }}>
              View transaction <ExternalLink className="size-3" />
            </a>
          )}
        </div>

      ) : (
        /* ── FORM ── */
        <div className="space-y-4">
          {/* Sender display (A5) */}
          {address && (
            <div className="rounded-xl px-3 py-2 flex items-center justify-between" style={glass.inner}>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Sender (you)</span>
              <span className="mono text-xs select-all" style={{ color: 'var(--ink-2)' }}>{address}</span>
            </div>
          )}

          {/* Beneficiary */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)' }}>
              Beneficiary Address
            </label>
            <div className="rounded-2xl px-4 py-3" style={{
              ...glass.inner,
              border: beneficiaryInvalid ? '1px solid rgba(186,43,76,0.4)' : (glass.inner).border,
            }}>
              <input
                className="w-full bg-transparent text-sm outline-none mono placeholder:text-slate-400"
                style={{ color: 'var(--ink)' }}
                placeholder="0x..."
                value={beneficiary}
                onChange={e => setBeneficiary(e.target.value)}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            {beneficiaryInvalid && (
              <p className="text-xs flex items-center gap-1" style={{ color: 'var(--danger)' }}>
                <AlertTriangle className="size-3" /> Invalid or zero address
              </p>
            )}
            {isSelf && !beneficiaryInvalid && (
              <p className="text-xs flex items-center gap-1" style={{ color: '#b48200' }}>
                <AlertTriangle className="size-3" /> This is your own wallet address
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)' }}>
                Amount (USDC)
              </label>
              {formattedBalance && (
                <button
                  className="text-xs font-semibold"
                  style={{ color: 'var(--accent-hover)' }}
                  onClick={() => setAmount(formattedBalance)}
                >
                  Balance: {formattedBalance} · Max
                </button>
              )}
            </div>
            <div className="rounded-2xl px-4 py-3" style={glass.inner}>
              <input
                inputMode="decimal"
                className="display w-full bg-transparent text-2xl font-bold tabular-nums outline-none placeholder:text-slate-300"
                style={{ color: 'var(--ink)' }}
                placeholder="0.00"
                value={amount}
                onChange={e => {
                  const v = e.target.value.replace(/[^0-9.]/g, '')
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                }}
              />
              <span className="text-xs mt-1 block" style={{ color: 'var(--subtle)' }}>
                USDC on {net.label}
              </span>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)' }}>
              Duration
            </label>
            <div className="flex gap-2">
              <div className="flex-1 rounded-2xl px-4 py-3" style={glass.inner}>
                <input
                  inputMode="decimal"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                  style={{ color: 'var(--ink)' }}
                  placeholder={durationUnit === 'days' ? '365' : durationUnit === 'hours' ? '8760' : '525600'}
                  value={durationValue}
                  onChange={e => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setDurationValue(v)
                  }}
                />
              </div>
              <div className="flex rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {(['minutes', 'hours', 'days'] as const).map(unit => (
                  <button
                    key={unit}
                    onClick={() => setDurationUnit(unit)}
                    className="px-3 py-2 text-xs font-semibold transition-colors"
                    style={durationUnit === unit
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { background: 'var(--surface-muted)', color: 'var(--muted)' }}
                  >
                    {unit.charAt(0).toUpperCase() + unit.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {durationValue && durationSecs !== null && (
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                = {Number(durationSecs).toLocaleString()} seconds
              </p>
            )}
          </div>

          {/* Start Time */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold tracking-wide uppercase" style={{ color: 'var(--muted)' }}>
              Start Time
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setStartNow(true)}
                className="flex-1 rounded-2xl py-2.5 text-sm font-semibold transition-all"
                style={startNow
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
              >
                Now
              </button>
              <button
                onClick={() => setStartNow(false)}
                className="flex-1 rounded-2xl py-2.5 text-sm font-semibold transition-all"
                style={!startNow
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
              >
                Custom date
              </button>
            </div>
            {!startNow && (
              <div className="rounded-2xl px-4 py-3" style={glass.inner}>
                <input
                  type="datetime-local"
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: 'var(--ink)' }}
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Review button → opens confirmation panel */}
          <button
            disabled={!formValid || beneficiaryInvalid}
            onClick={() => setConfirming(true)}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            {!isConnected ? 'Connect wallet'
              : wrongChain ? `Switch to ${net.label}`
              : 'Review Schedule →'}
          </button>
        </div>
      )}
    </div>
  )
}
