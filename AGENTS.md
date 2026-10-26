# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

USDC linear-vesting and scheduled payout app on Arc Testnet. A sender creates a vesting schedule for a beneficiary by depositing USDC with a start time and duration. The beneficiary claims vested USDC linearly over time. The sender can cancel and reclaim only the unvested portion; the beneficiary can still claim any vested-but-unclaimed USDC after cancellation.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## Deployed Contracts

| Contract     | Chain        | Address                                    | Constructor arg (USDC)                     |
|--------------|--------------|--------------------------------------------|--------------------------------------------|
| VestingVault | Arc Testnet  | 0x75bb671393cb84e97c62f4d203124c7e34519a15 | 0x3600000000000000000000000000000000000000 |
| VestingVault | Arc Mainnet  | 0x5F794fEc98BD7580Cb30CE36697562ca6CbcB4f3 | 0x3600000000000000000000000000000000000000 |

Testnet deploy tx: 0x09cf0849c0c137ab8ae2c4850b29ad42791f4a02d2b9e074b65583bd1a43a774
Mainnet deploy tx: 0x6df6bb54571f992331b00a6ba36fc3ad5336eae4482c76606e5cd1116e68b7c9 (block 27882141, Oct 26 2026)

## Key Decisions

- `startTime = 0` in `createSchedule` resolves to `block.timestamp` on-chain; the UI always passes `0n` when "Now" is selected.
- After a sender calls `cancel`, `vestedAmount()` returns 0 (schedule inactive); `claimable()` returns the frozen vested remainder. The UI calls `claimAfterCancel` when `vestedAmount == 0 && claimable > 0`.
- `MAX_DURATION = 10 * 365 days`. Overflow guard uses `unchecked` block with explicit named revert.
- No owner, no admin, no upgrade. The deployer wallet has no special powers after deploy.

## To Run

```bash
bun install
bun run dev
```
