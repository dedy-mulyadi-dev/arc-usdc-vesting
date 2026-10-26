import { useState } from 'react'
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount, usePublicClient } from 'wagmi'
import { decodeErrorResult } from 'viem'
import { Loader2, ExternalLink, TrendingUp, X, CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { VESTING_VAULT_ABI, getVestingVaultAddress } from '@/vestingVault'
import { buildTxUrl } from '@/networkConfig'
import type { NetworkConfig } from '@/networkConfig'
import { Amount } from '@/onchain-money'

const glass = {
  card: { background: 'var(--surface)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)', border: '1px solid var(--border)' } as React.CSSProperties,
  inner: { background: 'var(--surface-muted)', border: '1px solid var(--border)' } as React.CSSProperties,
}

interface Props {
  net: NetworkConfig
  senderAddress: `0x${string}`
  beneficiaryAddress: `0x${string}`
  /** Connected wallet IS the beneficiary */
  canClaim: boolean
  /** Connected wallet IS the sender */
  canCancel: boolean
  wrongChain: boolean
  onSwitchChain: () => void
}

export default function ScheduleView({
  net, senderAddress, beneficiaryAddress, canClaim, canCancel, wrongChain, onSwitchChain,
}: Props) {
  const { address } = useAccount()
  const vaultAddress = getVestingVaultAddress(net.key)
  const vaultArgs = [senderAddress, beneficiaryAddress] as const

  // ── Contract reads ────────────────────────────────────────────────────────
  const { data: vestedRaw, refetch: refetchVested } = useReadContract({
    address: vaultAddress, abi: VESTING_VAULT_ABI,
    functionName: 'vestedAmount', args: vaultArgs, chainId: net.chainId,
    query: { refetchInterval: 15_000 },
  })
  const { data: claimableRaw, refetch: refetchClaimable } = useReadContract({
    address: vaultAddress, abi: VESTING_VAULT_ABI,
    functionName: 'claimable', args: vaultArgs, chainId: net.chainId,
    query: { refetchInterval: 15_000 },
  })

  const vestedBig    = (vestedRaw    ?? 0n) as bigint
  const claimableBig = (claimableRaw ?? 0n) as bigint
  const dec = net.usdcDecimals

  // ── Schedule state detection ──────────────────────────────────────────────
  // Both reads return null while loading — distinguish loading from "no data"
  const readsReady = vestedRaw !== undefined && claimableRaw !== undefined

  // Cancelled: vestedAmount() returns 0 for inactive schedules, but claimable() returns the
  // frozen vested remainder. So: vested=0 AND claimable>0 → cancelled.
  const isCancelled = readsReady && vestedBig === 0n && claimableBig > 0n
  // Active: something is vested (or will be — before start vested=0 but claimable=0 too,
  // which would fall into "no schedule". Detect active by checking if there are funds at all.
  const isActive = readsReady && !isCancelled && (vestedBig > 0n || claimableBig > 0n)
  // ── Display values ────────────────────────────────────────────────────────
  // B6: for cancelled schedules, "Frozen vested amount" = claimable() (amount - claimed),
  // NOT vestedAmount() which returns 0. For active schedules, show the running vestedAmount.
  const frozenOrVestedBig = isCancelled ? claimableBig : vestedBig
  const frozenOrVestedFmt = readsReady
    ? Amount.fromRaw(frozenOrVestedBig, dec).toFixed(6)
    : '…'
  const claimFmt = readsReady
    ? Amount.fromRaw(claimableBig, dec).toFixed(6)
    : '…'

  // ── Cancel simulation state ───────────────────────────────────────────────
  type CancelSimState =
    | null                   // not yet run
    | 'ok'                   // sim passed → wallet opened
    | 'nothing-to-cancel'    // NothingToCancel → fully vested, disable button
    | 'no-active-schedule'   // NoActiveSchedule → bad address pair, disable button
    | 'error'                // RPC/network/unknown → keep button enabled for retry
  const [cancelSimState, setCancelSimState] = useState<CancelSimState>(null)
  const [cancelSimPending, setCancelSimPending] = useState(false)
  const publicClient = usePublicClient({ chainId: net.chainId })

  // ── Transactions ──────────────────────────────────────────────────────────
  const { writeContract: doClaim, data: claimHash, isPending: claimPending } = useWriteContract()
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash })

  const { writeContract: doClaimAfterCancel, data: cacHash, isPending: cacPending } = useWriteContract()
  const { isLoading: cacConfirming, isSuccess: cacSuccess } = useWaitForTransactionReceipt({ hash: cacHash })

  const { writeContract: doCancel, data: cancelHash, isPending: cancelPending } = useWriteContract()
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash })

  function handleClaim() {
    if (wrongChain) { onSwitchChain(); return }
    if (isCancelled) {
      doClaimAfterCancel({
        address: vaultAddress, abi: VESTING_VAULT_ABI,
        functionName: 'claimAfterCancel', args: [senderAddress], chainId: net.chainId,
      }, {
        onSuccess: () => { toast.success('Claimed vested USDC!'); void refetchVested(); void refetchClaimable() },
        onError: (e) => toast.error(e.message.slice(0, 80)),
      })
    } else {
      doClaim({
        address: vaultAddress, abi: VESTING_VAULT_ABI,
        functionName: 'claim', args: [senderAddress], chainId: net.chainId,
      }, {
        onSuccess: () => { toast.success('Claimed vested USDC!'); void refetchVested(); void refetchClaimable() },
        onError: (e) => toast.error(e.message.slice(0, 80)),
      })
    }
  }

  async function handleCancel() {
    if (wrongChain) { onSwitchChain(); return }
    if (!publicClient || !address) return

    // ── Simulate with the sender's account, correct chain, exact args ────────
    setCancelSimPending(true)
    try {
      await publicClient.simulateContract({
        address: vaultAddress,
        abi: VESTING_VAULT_ABI,
        functionName: 'cancel',
        args: [beneficiaryAddress],   // the beneficiary arg exactly as the real tx
        account: senderAddress,        // cancel() uses msg.sender; must be the sender
        chain: publicClient.chain,     // active network
      })
      // ── Simulation succeeded — open wallet ──────────────────────────────
      setCancelSimState('ok')
      setCancelSimPending(false)
      doCancel({
        address: vaultAddress, abi: VESTING_VAULT_ABI,
        functionName: 'cancel', args: [beneficiaryAddress], chainId: net.chainId,
      }, {
        onSuccess: () => {
          toast.success('Schedule cancelled — unvested USDC refunded.')
          void refetchVested()
          void refetchClaimable()
        },
        onError: (e) => toast.error(e.message.slice(0, 80)),
      })
    } catch (err: unknown) {
      setCancelSimPending(false)
      // ── Decode the revert reason from the ABI ──────────────────────────
      // ContractFunctionRevertedError carries a `data` field with the selector.
      let errorName: string | null = null
      if (err && typeof err === 'object') {
        const revertData = (err as Record<string, unknown>).data
        if (typeof revertData === 'string' && revertData.startsWith('0x') && revertData.length >= 10) {
          try {
            const decoded = decodeErrorResult({ abi: VESTING_VAULT_ABI, data: revertData as `0x${string}` })
            errorName = decoded.errorName
          } catch { /* unknown selector — fall through */ }
        }
        // viem also nests under .cause for some error shapes
        if (!errorName) {
          const cause = (err as Record<string, unknown>).cause
          if (cause && typeof cause === 'object') {
            const causeData = (cause as Record<string, unknown>).data
            if (typeof causeData === 'string' && causeData.startsWith('0x') && causeData.length >= 10) {
              try {
                const decoded = decodeErrorResult({ abi: VESTING_VAULT_ABI, data: causeData as `0x${string}` })
                errorName = decoded.errorName
              } catch { /* unknown */ }
            }
          }
        }
      }
      if (errorName === 'NothingToCancel') {
        setCancelSimState('nothing-to-cancel')
      } else if (errorName === 'NoActiveSchedule') {
        setCancelSimState('no-active-schedule')
      } else {
        // RPC error, network timeout, wrong chain, unknown revert — let user retry
        setCancelSimState('error')
      }
    }
  }

  const claimTxUrl  = claimHash  ? buildTxUrl(net, claimHash)  : null
  const cacTxUrl    = cacHash    ? buildTxUrl(net, cacHash)    : null
  const cancelTxUrl = cancelHash ? buildTxUrl(net, cancelHash) : null
  const latestTxUrl = claimTxUrl || cacTxUrl || cancelTxUrl

  const isClaimBusy = claimPending || claimConfirming || cacPending || cacConfirming
  const noClaimable = claimableBig === 0n

  // ── Status badge ──────────────────────────────────────────────────────────
  type ScheduleStatus = 'loading' | 'active' | 'cancelled' | 'none'
  const status: ScheduleStatus = !readsReady
    ? 'loading'
    : isCancelled ? 'cancelled'
    : isActive ? 'active'
    : 'none'

  const statusBadge: Record<ScheduleStatus, { label: string; icon: React.ReactNode; style: React.CSSProperties }> = {
    loading:   { label: 'Loading…',      icon: <Loader2 className="size-3 animate-spin" />,     style: { background: 'rgba(18,45,69,0.06)', color: 'var(--muted)' } },
    active:    { label: 'Active',        icon: <CheckCircle2 className="size-3" />,              style: { background: 'rgba(26,128,71,0.10)', color: 'var(--success)' } },
    cancelled: { label: 'Cancelled',     icon: <XCircle className="size-3" />,                  style: { background: 'rgba(186,43,76,0.10)', color: 'var(--danger)' } },
    none:      { label: 'No schedule',   icon: <HelpCircle className="size-3" />,                style: { background: 'rgba(18,45,69,0.06)', color: 'var(--muted)' } },
  }
  const badge = statusBadge[status]

  // ── "No schedule" early return ────────────────────────────────────────────
  if (status === 'none') {
    return (
      <div className="rounded-3xl p-5 space-y-3" style={glass.card}>
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-xl" style={{ background: 'rgba(18,45,69,0.06)' }}>
            <HelpCircle className="size-4" style={{ color: 'var(--muted)' }} />
          </div>
          <h3 className="display text-base font-semibold" style={{ color: 'var(--ink)' }}>No schedule found</h3>
        </div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          No active or cancelled vesting schedule exists for this sender / beneficiary pair on {net.label}.
        </p>
        {address && (
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Make sure both addresses are correct and the sender has already created a schedule.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-3xl p-5 space-y-4" style={glass.card}>
      {/* Title + status badge */}
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-xl"
          style={{ background: isCancelled ? 'rgba(186,43,76,0.08)' : 'rgba(26,128,71,0.10)' }}>
          <TrendingUp className="size-4" style={{ color: isCancelled ? 'var(--danger)' : 'var(--success)' }} />
        </div>
        <h3 className="display text-base font-semibold" style={{ color: 'var(--ink)' }}>Vesting Schedule</h3>
        <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ml-auto"
          style={badge.style}>
          {badge.icon}{badge.label}
        </span>
      </div>

      {/* Addresses */}
      <div className="space-y-1.5">
        {[
          { label: 'Sender', addr: senderAddress },
          { label: 'Beneficiary', addr: beneficiaryAddress },
        ].map(({ label, addr }) => (
          <div key={label} className="flex items-center justify-between rounded-xl px-3 py-2" style={glass.inner}>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
            <span className="mono text-xs" style={{ color: 'var(--ink-2)' }}>
              {addr.slice(0, 6)}…{addr.slice(-4)}
            </span>
          </div>
        ))}
      </div>

      {/* Amounts — B6 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl p-3 space-y-1" style={glass.inner}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {isCancelled ? 'Frozen vested amount' : 'Vested so far'}
          </span>
          <div className="display text-xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {frozenOrVestedFmt}
          </div>
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
        </div>
        <div className="rounded-2xl p-3 space-y-1"
          style={{ ...glass.inner, border: claimableBig > 0n ? '1px solid rgba(26,128,71,0.3)' : undefined }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Claimable now</span>
          <div className="display text-xl font-bold tabular-nums"
            style={{ color: claimableBig > 0n ? 'var(--success)' : 'var(--ink)' }}>
            {claimFmt}
          </div>
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
        </div>
      </div>

      {/* Cancelled notice */}
      {isCancelled && (
        <p className="text-xs rounded-xl px-3 py-2"
          style={{ background: 'rgba(186,43,76,0.06)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.12)' }}>
          This schedule was cancelled. The frozen vested amount above is still claimable.
        </p>
      )}

      {/* Wrong-chain inline banner */}
      {wrongChain && (
        <div className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{ background: 'rgba(180,130,0,0.08)', border: '1px solid rgba(180,130,0,0.25)' }}>
          <span className="text-xs" style={{ color: '#b48200' }}>Switch to {net.label} to transact</span>
          <button onClick={onSwitchChain} className="text-xs font-semibold px-2 py-1 rounded-lg"
            style={{ background: 'rgba(180,130,0,0.15)', color: '#b48200' }}>Switch</button>
        </div>
      )}

      {/* Claim button — shown to beneficiary */}
      {canClaim && (
        <button
          disabled={isClaimBusy || noClaimable || claimSuccess || cacSuccess || wrongChain}
          onClick={handleClaim}
          className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--success)' }}
        >
          {isClaimBusy
            ? <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {claimConfirming || cacConfirming ? 'Confirming…' : 'Confirm in wallet…'}
              </span>
            : (claimSuccess || cacSuccess) ? 'Claimed!'
            : noClaimable ? 'Nothing to claim yet'
            : 'Claim USDC'}
        </button>
      )}

      {/* Cancel — shown when active AND connected wallet is the sender */}
      {canCancel && isActive && !cancelSuccess && !isCancelled && (
        <>
          {/* Inline note for terminal simulation outcomes */}
          {cancelSimState === 'nothing-to-cancel' && (
            <p className="text-xs text-center rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(18,45,69,0.04)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              Nothing left to cancel. The schedule is fully vested; the beneficiary can claim.
            </p>
          )}
          {cancelSimState === 'no-active-schedule' && (
            <p className="text-xs text-center rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(18,45,69,0.04)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              No active schedule for this sender and beneficiary.
            </p>
          )}
          {cancelSimState === 'error' && (
            <p className="text-xs text-center rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(180,130,0,0.06)', color: '#b48200', border: '1px solid rgba(180,130,0,0.20)' }}>
              Could not verify this cancellation right now. Check your network and try again.
            </p>
          )}
          {/* Button: hidden only on terminal revert states; stays visible (enabled) on error */}
          {cancelSimState !== 'nothing-to-cancel' && cancelSimState !== 'no-active-schedule' && (
            <button
              disabled={cancelPending || cancelConfirming || cancelSimPending || wrongChain}
              onClick={() => void handleCancel()}
              className="w-full rounded-2xl py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
              style={{ color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.25)', background: 'rgba(186,43,76,0.04)' }}
            >
              {cancelSimPending
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Checking…</span>
                : cancelPending
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Confirm in wallet…</span>
                : cancelConfirming
                ? <span className="flex items-center justify-center gap-2"><Loader2 className="size-4 animate-spin" />Cancelling…</span>
                : <span className="flex items-center justify-center gap-1.5"><X className="size-3.5" />Cancel schedule</span>}
            </button>
          )}
        </>
      )}

      {/* Explorer link — uses active network's explorer */}
      {latestTxUrl && (
        <a href={latestTxUrl} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs font-medium"
          style={{ color: 'var(--accent-hover)' }}>
          View transaction <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  )
}
