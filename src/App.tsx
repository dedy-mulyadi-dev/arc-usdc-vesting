import { useState, useCallback } from 'react'
import { ConnectKitButton } from 'connectkit'
import { TokenUSDC } from '@web3icons/react'
import { useAccount, useSwitchChain } from 'wagmi'
import { AlertTriangle } from 'lucide-react'
import CreateSchedule from './components/CreateSchedule'
import LookupSchedule from './components/LookupSchedule'
import { NETWORKS, DEFAULT_NETWORK, buildAddressUrl } from './networkConfig'
import type { NetworkKey } from './networkConfig'

const tabs = ['Create', 'View & Claim'] as const
type Tab = (typeof tabs)[number]

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

export default function App() {
  const [tab, setTab] = useState<Tab>('Create')
  const [networkKey, setNetworkKey] = useState<NetworkKey>(DEFAULT_NETWORK)

  const net = NETWORKS[networkKey]
  const { chainId, isConnected } = useAccount()
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
    if (isConnected) {
      const target = NETWORKS[key]
      switchChain(
        { chainId: target.chainId },
        { onError: () => addChainToWallet(target.chainId, target.label, target.rpcUrl, target.explorerBase) }
      )
    }
  }

  const contractUrl = buildAddressUrl(net, net.vestingVaultAddress)

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)', backgroundAttachment: 'fixed' }}>
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <TokenUSDC variant="branded" size={22} />
          <span className="display text-sm font-semibold" style={{ color: 'var(--ink)' }}>USDC Vesting</span>

          {/* Network switcher (C9 / C10) */}
          <div className="flex rounded-full overflow-hidden ml-1"
            style={{ border: '1px solid var(--border)', background: 'var(--surface-muted)' }}>
            {(Object.keys(NETWORKS) as NetworkKey[]).map(key => (
              <button
                key={key}
                onClick={() => handleNetworkChange(key)}
                className="px-2.5 py-1 text-xs font-semibold transition-colors"
                style={networkKey === key
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { color: 'var(--muted)' }}
              >
                {NETWORKS[key].label}
              </button>
            ))}
          </div>
        </div>
        <ConnectKitButton />
      </header>

      {/* C12: Mainnet persistent notice */}
      {!net.isTestnet && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium"
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

      <main className="mx-auto max-w-md px-4 py-6 space-y-4">
        {/* Tab switcher */}
        <div className="flex rounded-2xl p-1 gap-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all"
              style={tab === t
                ? { background: 'var(--accent)', color: '#fff' }
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

        {/* Footer — C11: explorer link uses active network */}
        <p className="text-center text-xs pb-4" style={{ color: 'var(--subtle)' }}>
          Contract:{' '}
          <a
            href={contractUrl}
            target="_blank" rel="noreferrer"
            className="underline underline-offset-2"
            style={{ color: 'var(--accent-hover)' }}
          >
            {net.vestingVaultAddress.slice(0, 6)}…{net.vestingVaultAddress.slice(-4)}
          </a>{' '}
          · {net.label}
        </p>
      </main>
    </div>
  )
}
