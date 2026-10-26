/**
 * Single source of truth for network configuration.
 * To add mainnet support after deploying:
 *   1. Fill VESTING_VAULT_MAINNET with your deployed contract address.
 *   2. Change DEFAULT_NETWORK to 'mainnet'.
 */

export type NetworkKey = 'testnet' | 'mainnet'

export interface NetworkConfig {
  key: NetworkKey
  label: string
  chainId: number
  rpcUrl: string
  explorerBase: string
  /** USDC ERC-20 address (same on both Arc networks) */
  usdcAddress: `0x${string}`
  /** 6 decimals on both Arc networks */
  usdcDecimals: number
  /** VestingVault contract address. Mainnet is a placeholder until you deploy. */
  vestingVaultAddress: `0x${string}`
  isTestnet: boolean
}

// ─── Testnet ─────────────────────────────────────────────────────────────────
const VESTING_VAULT_TESTNET = '0x75bb671393cb84e97c62f4d203124c7e34519a15' as const

// ─── Mainnet ─────────────────────────────────────────────────────────────────
const VESTING_VAULT_MAINNET = '0x5F794fEc98BD7580Cb30CE36697562ca6CbcB4f3' as const

const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  testnet: {
    key: 'testnet',
    label: 'Arc Testnet',
    chainId: 5042002,
    rpcUrl: 'https://rpc.testnet.arc.io',
    explorerBase: 'https://explorer.testnet.arc.io',
    usdcAddress: USDC_ADDRESS,
    usdcDecimals: 6,
    vestingVaultAddress: VESTING_VAULT_TESTNET,
    isTestnet: true,
  },
  mainnet: {
    key: 'mainnet',
    label: 'Arc',
    chainId: 5042,
    rpcUrl: 'https://rpc.mainnet.arc.io',
    explorerBase: 'https://explorer.arc.io',
    usdcAddress: USDC_ADDRESS,
    usdcDecimals: 6,
    vestingVaultAddress: VESTING_VAULT_MAINNET,
    isTestnet: false,
  },
}

/** Change this to 'mainnet' to default to mainnet after deploying. */
export const DEFAULT_NETWORK: NetworkKey = 'testnet'

export function buildTxUrl(net: NetworkConfig, txHash: string): string {
  return `${net.explorerBase}/tx/${txHash}`
}

export function buildAddressUrl(net: NetworkConfig, address: string): string {
  return `${net.explorerBase}/address/${address}`
}

/** EIP-3085 chain descriptor used for wallet_addEthereumChain */
export function chainDescriptor(net: NetworkConfig) {
  return {
    chainId: '0x' + net.chainId.toString(16),
    chainName: net.label,
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: [net.rpcUrl],
    blockExplorerUrls: [net.explorerBase],
  }
}
