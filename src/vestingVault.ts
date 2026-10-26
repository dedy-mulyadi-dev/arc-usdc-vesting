import artifact from '../contracts/out/VestingVault.sol/VestingVault.json'
import { NETWORKS } from '@/networkConfig'
import type { NetworkKey } from '@/networkConfig'

export const VESTING_VAULT_ABI = artifact.abi

/** Returns the VestingVault contract address for the given network key. */
export function getVestingVaultAddress(network: NetworkKey): `0x${string}` {
  return NETWORKS[network].vestingVaultAddress
}

/** Legacy export used by existing components before network-aware wiring.
 *  Still points at testnet — components should prefer getVestingVaultAddress(). */
export const VESTING_VAULT = {
  address: NETWORKS.testnet.vestingVaultAddress,
  abi: VESTING_VAULT_ABI,
} as const
