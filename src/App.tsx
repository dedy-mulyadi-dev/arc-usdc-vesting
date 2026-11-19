import { useState, useCallback } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { AlertTriangle, ExternalLink, Info, Lock, ShieldCheck, TrendingUp } from 'lucide-react'
import CreateSchedule from './components/CreateSchedule'
import LookupSchedule from './components/LookupSchedule'
import Logo from './components/Logo'
import { NETWORKS, DEFAULT_NETWORK, buildAddressUrl } from './networkConfig'
import type { NetworkKey } from './networkConfig'

const REPO_URL = 'https://github.com/dedy-mulyadi-dev/arc-usdc-vesting'

const tabs = ['Create', 'View & Claim'] as const
type Tab = (typeof tabs)[number]

/** Short, user-facing names for the network switcher. */
const NETWORK_NAME: Record<NetworkKey, string> = {
  testnet: 'Arc Testnet',
  mainnet: 'Arc Mainnet',
}
const NETWORK_DOT: Record<NetworkKey, string> = {
  testnet: '#e0a100',
  mainnet: '#1a8047',
}

/** Prompts the wallet to add a chain it doesn't know about yet (EIP-3085). */
function addChainToWallet(chainId: number, label: string, rpcUrl: string, explorerBase: string) {
  const provider = (window as unknown as Record<string, unknown>).ethereum as
    | { request: (args: { method: string; params: unknown[] }) => Promise<unknown> }
    | undefined
  if (!provider) return
  void provider.request({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: '0x' + chainId.toString(16),
      chainName: label,
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
      rpcUrls: [rpcUrl],
      blockExplorerUrls: [explorerBase],
    }],
  })
}

/** Lets a shared link such as `/?network=mainnet` open on the right network. */
function initialNetwork(): NetworkKey {
  try {
    const wanted = new URLSearchParams(window.location.search).get('network')
    if (wanted === 'mainnet' || wanted === 'testnet') return wanted
  } catch { /* no window.location: fall through to the default */ }
  return DEFAULT_NETWORK
}

function rememberNetwork(key: NetworkKey) {
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('network', key)
    window.history.replaceState(null, '', url)
  } catch { /* purely cosmetic: ignore */ }
}

const FEATURES = [
  {
    icon: Lock,
    title: 'Locked up front',
    body: 'The full amount moves into the contract when you create the schedule.',
  },
  {
    icon: TrendingUp,
    title: 'Released in a straight line',
    body: 'Every second a little more becomes claimable, until the end date.',
  },
  {
    icon: ShieldCheck,
    title: 'No admin, no upgrades',
    body: 'Only the payer and the recipient of a schedule can act on it. Vested USDC is never taken back.',
  },
] as const

const STEPS = [
  { title: 'Approve and deposit', body: 'Approve the exact USDC amount, then create the schedule. The funds move into the contract.' },
  { title: 'USDC vests every second', body: 'The claimable amount grows in a straight line from the start time to the end time.' },
  { title: 'Claim, or cancel the rest', body: 'The recipient claims at any time. The payer can cancel and recover only the unvested part.' },
] as const

export default function App() {
  const [tab, setTab] = useState<Tab>('Create')
  const [networkKey, setNetworkKey] = useState<NetworkKey>(initialNetwork)

  const net = NETWORKS[networkKey]
  const { chainId, isConnected, status } = useAccount()
  const { switchChain } = useSwitchChain()

  // Wrong chain = wallet connected but on a different chain than the selected network
  const wrongChain = isConnected && chainId !== net.chainId

  // wallet_switchEthereumChain — falls back to wallet_addEthereumChain if chain unknown
  const handleSwitchChain = useCallback(() => {
    switchChain(
      { chainId: net.chainId },
      { onError: () => addChainToWallet(net.chainId, net.label, net.rpcUrl, net.explorerBase) }
    )
  }, [switchChain, net])

  // When user picks a different network in the switcher, also prompt wallet switch
  function handleNetworkChange(key: NetworkKey) {
    setNetworkKey(key)
    rememberNetwork(key)
    if (isConnected) {
      const target = NETWORKS[key]
      switchChain(
        { chainId: target.chainId },
        { onError: () => addChainToWallet(target.chainId, target.label, target.rpcUrl, target.explorerBase) }
      )
    }
  }

  const contractUrl = buildAddressUrl(net, net.vestingVaultAddress)
  const shortAddr = `${net.vestingVaultAddress.slice(0, 6)}…${net.vestingVaultAddress.slice(-4)}`

  return (
    <div className="vv-page">
      {/* Header */}
      <header className="vv-header">
        <div className="vv-hwrap">
          <div className="flex items-center gap-2.5">
            <Logo size={36} className="shrink-0 drop-shadow-md" />
            <span className="display text-[17px] font-bold" style={{ color: 'var(--ink)' }}>USDC Vesting</span>
          </div>

          {/* Network switcher: stays visible on phones (wraps under the brand) */}
          <div className="vv-seg" role="group" aria-label="Network">
            {(Object.keys(NETWORKS) as NetworkKey[]).map(key => (
              <button
                key={key}
                type="button"
                aria-pressed={networkKey === key}
                onClick={() => handleNetworkChange(key)}
              >
                <i className="vv-dot" style={{ background: NETWORK_DOT[key] }} />
                {NETWORK_NAME[key]}
              </button>
            ))}
          </div>

          <ConnectKitButton.Custom>
            {({ show, truncatedAddress, ensName }) => (
              <button type="button" className="vv-connect" onClick={show}>
                {isConnected && <i className="vv-dot" style={{ background: '#3ddc84' }} />}
                {isConnected ? (ensName ?? truncatedAddress)
                  : status === 'connecting' || status === 'reconnecting' ? 'Connecting…'
                  : 'Connect wallet'}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </header>

      {/* Persistent network notice */}
      {net.isTestnet ? (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium"
          style={{ background: 'rgba(16,97,166,0.08)', borderBottom: '1px solid rgba(16,97,166,0.16)', color: '#0e4f88' }}>
          <Info className="size-3.5 shrink-0" />
          You are on Arc Testnet. No real funds are used here. Switch to Mainnet when you are ready.
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium"
          style={{ background: 'rgba(186,43,76,0.08)', borderBottom: '1px solid rgba(186,43,76,0.18)', color: 'var(--danger)' }}>
          <AlertTriangle className="size-3.5 shrink-0" />
          Unaudited. Early access. Use small amounts only.
        </div>
      )}

      {/* C10: Wrong-chain global banner */}
      {wrongChain && (
        <div className="flex items-center justify-between gap-2 px-4 py-2"
          style={{ background: 'rgba(180,130,0,0.08)', borderBottom: '1px solid rgba(180,130,0,0.25)' }}>
          <span className="text-xs font-medium" style={{ color: '#b48200' }}>
            Your wallet is on a different chain. Switch to {net.label} to send transactions.
          </span>
          <button
            onClick={handleSwitchChain}
            className="text-xs font-semibold px-3 py-1 rounded-full shrink-0"
            style={{ background: 'rgba(180,130,0,0.15)', color: '#b48200' }}
          >
            Switch
          </button>
        </div>
      )}

      <main className="vv-main">
        {/* Hero */}
        <section className="vv-hero">
          <span className="vv-eyebrow">Built on Arc &nbsp;·&nbsp; USDC</span>
          <h1 className="vv-h1">Pay people over time, <span>on-chain.</span></h1>
          <p className="vv-lead">
            Lock USDC in a public contract and release it in a straight line. The recipient claims
            what has vested; the payer can only take back what has not.
          </p>
        </section>

        {/* App */}
        <section className="vv-app space-y-4" aria-label="Vesting app">
          {/* Tab switcher */}
          <div className="flex rounded-2xl p-1 gap-1"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all"
                style={tab === t
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 6px 14px rgba(18,45,69,0.22)' }
                  : { color: 'var(--muted)' }}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Create' && (
            <CreateSchedule
              net={net}
              wrongChain={wrongChain}
              onSwitchChain={handleSwitchChain}
            />
          )}
          {tab === 'View & Claim' && (
            <LookupSchedule
              net={net}
              wrongChain={wrongChain}
              onSwitchChain={handleSwitchChain}
            />
          )}
        </section>

        {/* Why it is safe */}
        <section className="vv-feats">
          <div className="grid gap-3.5" style={{ maxWidth: 540 }}>
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="vv-feat">
                <div className="vv-ico"><Icon className="size-5" strokeWidth={2} /></div>
                <div>
                  <b className="display block text-[15px] font-semibold mb-0.5">{title}</b>
                  <p className="text-[13.5px] leading-snug" style={{ color: 'var(--muted)' }}>{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <a href={contractUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--accent-hover)' }}>
              View contract <ExternalLink className="size-3" />
            </a>
            <a href={REPO_URL} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--accent-hover)' }}>
              Source on GitHub <ExternalLink className="size-3" />
            </a>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ color: '#8a5a00', background: 'rgba(180,130,0,0.10)', border: '1px solid rgba(180,130,0,0.24)' }}>
              <AlertTriangle className="size-3" /> Unaudited · use small amounts
            </span>
          </div>
        </section>
      </main>

      {/* How it works */}
      <section className="vv-how" aria-labelledby="how-title">
        <h2 id="how-title" className="display text-[26px] font-bold mb-4">How it works</h2>
        <div className="vv-steps">
          {STEPS.map((s, i) => (
            <div key={s.title} className="vv-step">
              <div className="display flex size-[30px] items-center justify-center rounded-[10px] text-sm font-bold text-white mb-3"
                style={{ background: 'var(--accent)' }}>
                {i + 1}
              </div>
              <b className="display block text-base font-semibold mb-1">{s.title}</b>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--muted)' }}>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer — C11: explorer link uses active network */}
      <footer className="vv-footer">
        <span>
          Contract <a className="mono" href={contractUrl} target="_blank" rel="noreferrer">{shortAddr}</a> · {NETWORK_NAME[networkKey]}
        </span>
        <span>Unaudited early-access software. Test with small amounts first.</span>
      </footer>
    </div>
  )
}
