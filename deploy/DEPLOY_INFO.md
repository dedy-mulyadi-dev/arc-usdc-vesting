# VestingVault — Mainnet Deployment Information Pack

Generated from the Forge build artefact. Every value here is read directly from
`contracts/out/VestingVault.sol/VestingVault.json` or from `foundry.toml`.
Do not edit these values; re-run the generation script if you rebuild.

---

## 1. Source file

| Item | Value |
|---|---|
| File | `contracts/VestingVault.sol` |
| SPDX-License-Identifier | `MIT` |
| Pragma | `pragma solidity ^0.8.20;` |

### Import lines (exact, as written in VestingVault.sol)

```solidity
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
```

### OpenZeppelin Contracts version

| Item | Value |
|---|---|
| Package | `@openzeppelin/contracts` |
| Version | **5.6.1** |
| Source | `node_modules/@openzeppelin/contracts/package.json` |

---

## 2. Compiler settings (must match exactly for bytecode reproducibility)

| Setting | Value |
|---|---|
| Solidity version | **0.8.28+commit.7893614a** |
| Optimizer enabled | **true** |
| Optimizer runs | **200** |
| EVM version | **cancun** |
| viaIR | **false** |
| bytecodeHash | **ipfs** (default; set in `foundry.toml` metadata) |
| cbor_metadata | not explicitly set (defaults to `true`) |

---

## 3. foundry.toml (full content)

```toml
[profile.default]
src = "contracts"
test = "contracts/test"
script = "contracts/script"
out = "contracts/out"
libs = ["lib"]
cache_path = "contracts/cache"
solc_version = "0.8.28"
auto_detect_solc = false
evm_version = "cancun"
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
ethereum = "https://ethereum-rpc.publicnode.com"
sepolia = "https://ethereum-sepolia-rpc.publicnode.com"
base = "https://base-rpc.publicnode.com"
base_sepolia = "https://base-sepolia-rpc.publicnode.com"
arbitrum = "https://arbitrum-one-rpc.publicnode.com"
polygon = "https://polygon-bor-rpc.publicnode.com"
optimism = "https://optimism-rpc.publicnode.com"
```

---

## 4. remappings.txt (full content)

```
forge-std/=lib/forge-std/src/
@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/
```

---

## 5. Constructor

### Signature

```solidity
constructor(address usdcToken)
```

The constructor takes one argument: the USDC ERC-20 token address.

### Arc Mainnet USDC address

```
0x3600000000000000000000000000000000000000
```

### ABI-encoded constructor argument (append to creation bytecode)

```
0000000000000000000000003600000000000000000000000000000000000000
```

(64 hex characters, no `0x` prefix — this is what you append to the creation bytecode
in Remix's "Deploy" panel under "Deploy with constructor arguments".)

---

## 6. Bytecode verification

### keccak256 of deployed (runtime) bytecode

```
0x09b2da3a85689896cb847e1bf86a0a97072e615f956323e24a6b821ea6fafc27
```

Runtime bytecode length: **2905 bytes**

After you deploy, call `eth_getCode` on the deployed address, strip the `0x` prefix,
keccak256-hash the result, and compare to the hash above. They must match exactly.

```bash
# Using cast (Foundry):
cast keccak $(cast code <DEPLOYED_ADDRESS> --rpc-url https://rpc.mainnet.arc.io)
```

### Testnet reference deployment

The identical bytecode is already live on Arc Testnet at:

```
0x75bb671393cb84e97c62f4d203124c7e34519a15
```

You can verify the testnet bytecode hash now:

```bash
cast keccak $(cast code 0x75bb671393cb84e97c62f4d203124c7e34519a15 --rpc-url https://rpc.testnet.arc.io)
# Expected: 0x09b2da3a85689896cb847e1bf86a0a97072e615f956323e24a6b821ea6fafc27
```

---

## 7. Files in this deploy/ folder

| File | Purpose |
|---|---|
| `DEPLOY_INFO.md` | This document |
| `VestingVault.flat.sol` | Single-file flattened source (use in Remix or for Etherscan verification) |
| `standard-json-input.json` | Solidity Standard JSON input (use for programmatic / explorer verification) |

---

## 8. Explorer verification (Arc Mainnet)

Arc Mainnet explorer: **https://explorer.arc.io**

After deployment, verify at:
`https://explorer.arc.io/address/<YOUR_DEPLOYED_ADDRESS>#code`

Use either:
- **Flattened source** (`VestingVault.flat.sol`) with the compiler settings in section 2, or
- **Standard JSON input** (`standard-json-input.json`) — upload directly to the explorer.

Constructor argument for the verification form (ABI-encoded, no `0x`):
```
0000000000000000000000003600000000000000000000000000000000000000
```
