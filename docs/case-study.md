# Case study: USDC Vesting on Arc

**Problem.** Paying someone over time (a contributor, a freelancer, a grant recipient) usually means trust: either the payer sends everything up front and hopes for the work, or the recipient waits for each payment and hopes it arrives. Spreadsheets and manual transfers do not enforce anything.

**Solution.** A small, public smart contract on Arc. The payer locks USDC once. The amount is released in a straight line from a start time to an end time. The recipient claims whatever has vested at any moment. If the arrangement ends early, the payer can cancel and recover only the part that has not vested yet.

**Key design decisions**
- Linear release, computed on-chain: `vested = total * (min(now, end) - start) / (end - start)`.
- No owner, no admin, no upgrade path. Only the two parties of a schedule can act on it.
- The app approves the exact amount, never an unlimited allowance.
- After a cancel, the vested part stays claimable (`claimAfterCancel`), so the recipient is never cheated.
- One schedule per sender and recipient pair, which keeps the accounting simple and auditable.

**What I built**
- The Solidity contract (OpenZeppelin `SafeERC20` and `ReentrancyGuard`), with Foundry unit and fuzz tests.
- A React, wagmi and viem web app: create schedules with a live release preview, look up any schedule, claim, and cancel; a network switcher for Arc Testnet and Mainnet.
- Mainnet deployment and explorer source verification.

**Results**
- Deployed and verified on Arc Mainnet and Testnet.
- The full flow (create, claim, cancel, claim after cancel) was tested on Mainnet with real USDC; amounts matched the formula exactly and every split summed to the original deposit.
- A bug found during that testing (a success message shown for a transaction that reverted on-chain) was fixed to wait for the real receipt status.

**Honest limits.** The contract is unaudited and meant for small amounts. It does not generate yield, and a pair can hold only one open schedule at a time.

**Links**
- Live app: https://arc-usdc-vesting.vercel.app
- Source: https://github.com/dedy-mulyadi-dev/arc-usdc-vesting
- Mainnet contract: https://explorer.arc.io/address/0x5F794fEc98BD7580Cb30CE36697562ca6CbcB4f3?tab=contract
