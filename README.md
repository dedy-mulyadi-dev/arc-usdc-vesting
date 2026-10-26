# USDC Vesting

A USDC linear-vesting and scheduled payout app on Arc (Testnet and Mainnet). A sender creates a vesting schedule for a beneficiary by depositing USDC with a start time and duration. The beneficiary claims vested USDC linearly over time. The sender can cancel and reclaim only the unvested portion; the beneficiary can still claim any vested-but-unclaimed USDC after cancellation.

Built with [Arc Studio](https://studio.arc.io)

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion
- Web3: wagmi v2, viem, ConnectKit
- Contracts: Solidity 0.8.28, OpenZeppelin SafeERC20 + ReentrancyGuard, Foundry
- Chains: Arc Mainnet (Chain ID: 5042) and Arc Testnet (Chain ID: 5042002)
- Token: USDC (ERC-20, 6 decimals, `0x3600000000000000000000000000000000000000`)

## Deployed Contracts

| Contract     | Chain        | Address                                      |
|--------------|--------------|----------------------------------------------|
| VestingVault | Arc Testnet  | `0x75bb671393cb84e97c62f4d203124c7e34519a15` |
| VestingVault | Arc Mainnet  | `0x5F794fEc98BD7580Cb30CE36697562ca6CbcB4f3` |

Constructor argument (USDC token, both networks): `0x3600000000000000000000000000000000000000`

Testnet deploy tx: `0x09cf0849c0c137ab8ae2c4850b29ad42791f4a02d2b9e074b65583bd1a43a774`
Mainnet deploy tx: `0x6df6bb54571f992331b00a6ba36fc3ad5336eae4482c76606e5cd1116e68b7c9` (block 27882141, Oct 26 2026)

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Foundry](https://getfoundry.sh) (for contract work)

### Install

```bash
bun install
```

### Environment Variables

None required. RPC access is provided via Arc Studio's proxy when running inside Arc Studio. Outside Arc Studio, public Arc Testnet RPC (`https://rpc.testnet.arc.io`) is used automatically.

| Variable | Purpose |
|---|---|
| `RPC_PROXY_BASE_URL` | Optional — Arc Studio RPC proxy base URL |
| `RPC_PROXY_TOKEN` | Optional — Arc Studio RPC proxy token |
| `RPC_PROXY_CHAINS` | Optional — comma-separated list of chains supported by the proxy |

### Run

```bash
bun run dev
```

### Build

```bash
bun run contracts:build   # compile contracts
bun run contracts:test    # run Foundry tests (55 tests)
```

## App Features

- **Create schedule**: Approve USDC, set beneficiary address, amount, duration (in days), and start time (now or a future date). Passes `startTime = 0` to the contract when "Now" is selected, which resolves to `block.timestamp` on-chain.
- **View & Claim**: Look up any vesting schedule by sender + beneficiary address. Shows vested and claimable amounts live. Beneficiaries can claim vested USDC; senders can cancel and reclaim the unvested portion.
- **Cancelled schedules**: After a sender cancels, the app detects the cancelled state (`vestedAmount = 0` but `claimable > 0`) and automatically routes the beneficiary's claim to `claimAfterCancel`.
