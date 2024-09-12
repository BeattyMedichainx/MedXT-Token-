// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ICliffAndVesting} from "./interfaces/ICliffAndVesting.sol";
import {UnsafeMath} from "./libraries/UnsafeMath.sol";

/// @title Cliff&Vesting contract
/// @author PixelPlex Inc.
contract CliffAndVesting is ICliffAndVesting, Ownable2Step {
    using UnsafeMath for uint256;
    using SafeERC20 for IERC20;

    /// @dev used to prevent overflow in claim method
    uint256 private constant MAX_RESERVE_AMOUNT = type(uint256).max / 1e18;

    bytes32 private immutable vestingId;
    /// @inheritdoc ICliffAndVesting
    function vestingName() external view returns (string memory _vestingName) {
        bytes32 _vestingId = vestingId;
        _vestingName = string(new bytes(uint256(_vestingId >> 0xf8)));
        assembly {
            mstore(add(_vestingName, 31), _vestingId)
        }
    }

    /// @inheritdoc ICliffAndVesting
    uint256 public immutable periodSize;

    /// @inheritdoc ICliffAndVesting
    uint256 public immutable cliff;

    /// @inheritdoc ICliffAndVesting
    uint256 public immutable vesting;

    /// @inheritdoc ICliffAndVesting
    uint256 public immutable initialReleaseX18;

    /// @inheritdoc ICliffAndVesting
    IERC20 public immutable token;

    /// @inheritdoc ICliffAndVesting
    bool public started;

    /// @inheritdoc ICliffAndVesting
    uint256 public totalReserveAmount;

    /// @inheritdoc ICliffAndVesting
    uint256 public startedAt;

    /// @inheritdoc ICliffAndVesting
    address[] public accounts;
    /// @inheritdoc ICliffAndVesting
    function accountsLength() external view returns (uint256 length) {
        return accounts.length;
    }
    /// @inheritdoc ICliffAndVesting
    function accountsList() external view returns (address[] memory _accounts) {
        return accounts;
    }

    mapping(address => Reserve) private _accountReserve;
    /// @inheritdoc ICliffAndVesting
    function accountReserve(address account) external view returns (Reserve memory) {
        return _accountReserve[account];
    }

    /// @inheritdoc ICliffAndVesting
    function claimableAmount(address account) public view returns (uint256 amount) {
        (uint256 passedPeriods, uint256 totalPeriods) = _calculatePassedPeriods();
        (, amount) = _claimableAmount(account, passedPeriods, totalPeriods);
    }

    constructor(
        bytes32 _vestingId,
        uint256 _periodSize,
        uint256 _cliff,
        uint256 _vesting,
        uint256 _initialReleaseX18,
        IERC20 _token
    ) Ownable(msg.sender) {
        if (uint256(_vestingId >> 0xf8) >= 32) revert InvalidConfig();
        if (_periodSize == 0 || _periodSize > 31104000) revert InvalidConfig(); // period size should be lte 12*30 days
        if (_initialReleaseX18 > 1e18) revert InvalidConfig();
        if (_vesting == 0 && _initialReleaseX18 != 1e18) revert InvalidConfig();
        if (_vesting > 120) revert InvalidConfig(); // to prevent overflow in claim method
        vestingId = _vestingId;
        periodSize = _periodSize;
        cliff = _cliff;
        vesting = _vesting;
        initialReleaseX18 = _initialReleaseX18;
        token = _token;
    }

    // This method can be called in batches any number of times before the vesting starts
    // slither-disable-start costly-loop
    /// @inheritdoc ICliffAndVesting
    function reserve(
        ReserveParams[] calldata paramsList
    ) external onlyOwner onlyNotStarted returns (uint256 totalReserveAmount_) {
        uint256 paramsListLength = paramsList.length;
        for (uint256 i = 0; i < paramsListLength; i++) {
            ReserveParams calldata params = paramsList[i];
            if (params.account == address(0) || params.amount == 0) revert InvalidConfig();
            Reserve storage _reserve = _accountReserve[params.account];
            if (_reserve.account == address(0)) {
                _reserve.account = params.account;
                accounts.push(params.account);
            }
            uint256 reservedAmount = _reserve.reservedAmount + params.amount;
            if (reservedAmount > MAX_RESERVE_AMOUNT) revert InvalidConfig();
            _reserve.reservedAmount = reservedAmount;
            totalReserveAmount += params.amount;
            emit TokensReserved(params.account, params.amount, reservedAmount);
        }
        return totalReserveAmount;
    }
    // slither-disable-end costly-loop

    /// @inheritdoc ICliffAndVesting
    function start() external onlyOwner onlyNotStarted returns (uint256 startedAt_) {
        if (accounts.length == 0) revert InvalidConfig();
        uint256 _totalReserveAmount = totalReserveAmount;
        started = true;
        startedAt = startedAt_ = block.timestamp;
        emit VestingStarted(_totalReserveAmount, startedAt_);
        token.safeTransferFrom(msg.sender, address(this), _totalReserveAmount);
    }

    /// @inheritdoc ICliffAndVesting
    function claim() external onlyStarted returns (uint256 claimedAmount) {
        (uint256 passedPeriods, uint256 totalPeriods) = _calculatePassedPeriods();
        return _claim(msg.sender, passedPeriods, totalPeriods, false);
    }

    /// @inheritdoc ICliffAndVesting
    function claimBatch(
        address[] calldata accountList
    ) external onlyOwner onlyStarted returns (uint256 totalClaimedAmount) {
        (uint256 passedPeriods, uint256 totalPeriods) = _calculatePassedPeriods();
        uint256 batchSize = accountList.length;
        for (uint256 i = 0; i < batchSize; i++) {
            totalClaimedAmount += _claim(accountList[i], passedPeriods, totalPeriods, true);
        }
    }

    /// @inheritdoc ICliffAndVesting
    function claimRange(uint256 from, uint256 to) external onlyOwner onlyStarted returns (uint256 totalClaimedAmount) {
        (uint256 passedPeriods, uint256 totalPeriods) = _calculatePassedPeriods();
        uint256 accountsCount = accounts.length;
        if (to > accountsCount) to = accountsCount;
        for (uint256 i = from; i < to; i++) {
            totalClaimedAmount += _claim(accounts[i], passedPeriods, totalPeriods, true);
        }
    }

    function _claim(
        address account,
        uint256 passedPeriods,
        uint256 totalPeriods,
        bool byOwner
    ) private returns (uint256 claimedAmount) {
        (uint256 claimAmount, uint256 transferAmount) = _claimableAmount(account, passedPeriods, totalPeriods);
        _accountReserve[account].claimedAmount = claimAmount;
        emit TokensClaimed(account, byOwner, claimAmount, transferAmount);
        token.safeTransfer(account, transferAmount);
        return transferAmount;
    }

    function _calculatePassedPeriods() private view returns (uint256 passedPeriods, uint256 totalPeriods) {
        totalPeriods = vesting;
        passedPeriods = (block.timestamp - startedAt).unsafeDiv(periodSize);
        if (passedPeriods <= cliff) passedPeriods = 0;
        else passedPeriods = passedPeriods.unsafeSub(cliff);
        if (passedPeriods > totalPeriods) passedPeriods = totalPeriods;
    }

    function _claimableAmount(
        address account,
        uint256 passedPeriods,
        uint256 totalPeriods
    ) private view returns (uint256 claimAmount, uint256 transferAmount) {
        Reserve storage _reserve = _accountReserve[account];
        uint256 reservedAmount = _reserve.reservedAmount;
        uint256 initialReleaseAmount = reservedAmount.unsafeMul(initialReleaseX18) / 1e18;
        uint256 vestingAmount = reservedAmount.unsafeSub(initialReleaseAmount);
        uint256 vestingClaimAmount = totalPeriods != 0
            ? vestingAmount.unsafeMul(passedPeriods).unsafeDiv(totalPeriods)
            : 0;
        claimAmount = initialReleaseAmount.unsafeAdd(vestingClaimAmount);
        uint256 claimedAmount = _reserve.claimedAmount;
        transferAmount = claimAmount <= claimedAmount ? 0 : claimAmount.unsafeSub(claimedAmount);
    }

    modifier onlyStarted() {
        if (!started) revert NotStarted();
        _;
    }

    modifier onlyNotStarted() {
        if (started) revert AlreadyStarted();
        _;
    }
}
