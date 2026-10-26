// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}

contract VestingVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Schedule {
        uint256 amount;
        uint256 startTime;
        uint256 duration;
        uint256 claimed;
        bool active;
        bool cancelled;
    }

    uint256 public constant MAX_DURATION = 10 * 365 days; // 10 years

    error ZeroAddress();
    error ZeroAmount();
    error ZeroDuration();
    error DurationTooLong();
    error ScheduleAlreadyActive();
    error NoActiveSchedule();
    error NotBeneficiary();
    error NotSender();
    error NothingToClaim();
    error NothingToCancel();
    error StartInPast();
    error InvalidAmount();
    error PriorVestingNotSettled();
    error StartTimePlusOverflow();

    event ScheduleCreated(
        address indexed sender,
        address indexed beneficiary,
        uint256 amount,
        uint256 startTime,
        uint256 duration
    );
    event Claimed(address indexed sender, address indexed beneficiary, uint256 amount);
    event Cancelled(address indexed sender, address indexed beneficiary, uint256 refundAmount);

    IERC20 public immutable usdc;
    uint8 public immutable usdcDecimals;

    mapping(address sender => mapping(address beneficiary => Schedule)) private _schedules;

    constructor(address usdcToken) {
        if (usdcToken == address(0)) revert ZeroAddress();

        usdc = IERC20(usdcToken);
        usdcDecimals = IERC20Decimals(usdcToken).decimals();
    }

    function createSchedule(address beneficiary, uint256 amount, uint256 startTime, uint256 duration) external {
        if (beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (duration == 0) revert ZeroDuration();
        if (duration > MAX_DURATION) revert DurationTooLong();

        // startTime == 0 means "start immediately at block.timestamp"
        uint256 resolvedStart = (startTime == 0) ? block.timestamp : startTime;
        if (resolvedStart < block.timestamp) revert StartInPast();

        // Explicit overflow guard (Solidity 0.8 panics on overflow in checked arithmetic, but
        // this gives a named error instead of a generic panic revert)
        unchecked {
            if (resolvedStart + duration < resolvedStart) revert StartTimePlusOverflow();
        }

        Schedule storage schedule = _schedules[msg.sender][beneficiary];
        if (schedule.active) revert ScheduleAlreadyActive();
        // Block overwrite of unsettled cancelled schedule (protects beneficiary's vested remainder)
        if (schedule.amount != schedule.claimed) revert PriorVestingNotSettled();

        schedule.amount = amount;
        schedule.startTime = resolvedStart;
        schedule.duration = duration;
        schedule.claimed = 0;
        schedule.active = true;
        schedule.cancelled = false;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit ScheduleCreated(msg.sender, beneficiary, amount, resolvedStart, duration);
    }

    /// @notice Returns the cumulative vested amount for an active (non-cancelled) schedule.
    ///         Returns 0 for cancelled schedules — use claimable() for the remaining claimable amount.
    function vestedAmount(address sender, address beneficiary) public view returns (uint256) {
        Schedule storage s = _schedules[sender][beneficiary];
        if (!s.active) return 0;
        if (block.timestamp < s.startTime) return 0;
        uint256 endTime = s.startTime + s.duration;
        if (block.timestamp >= endTime) return s.amount;
        return (s.amount * (block.timestamp - s.startTime)) / s.duration;
    }

    /// @notice Returns the amount immediately withdrawable by the beneficiary.
    ///         Works for both active schedules (linear vesting math) and cancelled schedules
    ///         (frozen vested remainder not yet claimed).
    function claimable(address sender, address beneficiary) public view returns (uint256) {
        Schedule storage s = _schedules[sender][beneficiary];
        if (!s.active && !s.cancelled) return 0;

        if (s.active) {
            // Normal active schedule: claimable = vested so far minus already claimed
            uint256 vested = vestedAmount(sender, beneficiary);
            return vested > s.claimed ? vested - s.claimed : 0;
        } else {
            // Cancelled schedule: amount was frozen to the vested portion at cancel time;
            // beneficiary can still withdraw whatever hasn't been claimed yet
            return s.amount > s.claimed ? s.amount - s.claimed : 0;
        }
    }

    function claim(address sender) external nonReentrant {
        Schedule storage schedule = _schedules[sender][msg.sender];
        if (!schedule.active) revert NoActiveSchedule();

        uint256 amountToClaim = claimable(sender, msg.sender);
        if (amountToClaim == 0) revert NothingToClaim();

        schedule.claimed += amountToClaim;
        if (schedule.claimed == schedule.amount) {
            delete _schedules[sender][msg.sender];
        }
        usdc.safeTransfer(msg.sender, amountToClaim);

        emit Claimed(sender, msg.sender, amountToClaim);
    }

    function cancel(address beneficiary) external nonReentrant {
        Schedule storage schedule = _schedules[msg.sender][beneficiary];
        if (!schedule.active) revert NoActiveSchedule();

        uint256 vested = vestedAmount(msg.sender, beneficiary);
        // Sender reclaims only the unvested portion.
        // The vested-but-unclaimed portion stays in the contract so the beneficiary can still claim it.
        uint256 unvested = schedule.amount - vested;
        if (unvested == 0) revert NothingToCancel();

        // Mark inactive so no further vesting accrues; preserve claimed so beneficiary claim still works.
        // Replace active schedule with a frozen snapshot covering only what has vested so far.
        schedule.active = false;
        schedule.cancelled = true;
        schedule.amount = vested;      // beneficiary may still claim up to `vested`
        schedule.duration = 0;        // already fully elapsed conceptually

        usdc.safeTransfer(msg.sender, unvested);

        emit Cancelled(msg.sender, beneficiary, unvested);
    }

    /// @notice After a schedule is cancelled, the beneficiary can still claim any vested-but-unclaimed
    ///         USDC via this function. The schedule becomes fully settled when claimed == amount.
    function claimAfterCancel(address sender) external nonReentrant {
        Schedule storage schedule = _schedules[sender][msg.sender];
        if (schedule.active || !schedule.cancelled) revert NoActiveSchedule();
        if (schedule.amount <= schedule.claimed) revert NothingToClaim();

        uint256 remaining = schedule.amount - schedule.claimed;

        schedule.claimed += remaining;
        // Clean up storage once fully settled.
        if (schedule.claimed == schedule.amount) {
            delete _schedules[sender][msg.sender];
        }

        usdc.safeTransfer(msg.sender, remaining);
        emit Claimed(sender, msg.sender, remaining);
    }
}
