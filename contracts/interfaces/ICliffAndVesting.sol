// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Interface of the Cliff&Vesting contract
/// @author PixelPlex Inc.
interface ICliffAndVesting {
    /// @notice Structure of reserve parameters
    /// @dev Used as argument in `reserve` method
    /// @param account The address for which tokens should be locked
    /// @param amount The amount of tokens to be locked
    struct ReserveParams {
        address account;
        uint256 amount;
    }

    /// @notice Structure of account's reserve info
    /// @param account The address of an account
    /// @param reservedAmount The amount of locked tokens
    /// @param claimedAmount The amount of already released tokens
    struct Reserve {
        address account;
        uint256 reservedAmount;
        uint256 claimedAmount;
    }

    /// @notice Indicates that vesting is not started yet
    /// @dev Claiming functions are only available if vesting is started
    error NotStarted();

    /// @notice Indicates that vesting is already started
    /// @dev Configuration is only available if vesting is not started
    error AlreadyStarted();

    /// @notice Indicates that some configuration parameters are invalid
    /// @dev Initial release must not be greater than 100%
    /// @dev If the number of vesting periods equals zero, then initial release must equal 100%
    /// @dev The number of vesting periods must not be greater than 120
    /// @dev Reserve account must not equal the zero address
    /// @dev Reserve amount must not equal zero
    /// @dev An account's reserve amount must not exceed (2^256-1) / 1e18
    /// @dev At least one account must have reserved tokens when vesting is started
    error InvalidConfig();

    /// @notice Emitted when tokens are reserved
    /// @param account The address of an account for which tokens are reserved
    /// @param reserveAmount The amount of reserved tokens
    /// @param accountReservedAmount Total amount of reserved tokens for this account
    event TokensReserved(address indexed account, uint256 reserveAmount, uint256 accountReservedAmount);

    /// @notice Emitted when vesting is started
    /// @param totalReservedAmount Total amount of reserved tokens
    /// @param startedAt The timestamp of vesting start
    event VestingStarted(uint256 totalReservedAmount, uint256 startedAt);

    /// @notice Emitted when tokens are claimed
    /// @param account The address of an account for which tokens are claimed
    /// @param byOwner Equals `true` if claim is triggered by an owner, `false` otherwise
    /// @param claimedAmount Total amount of claimed tokens
    /// @param transferAmount Amount of tokens transferred to the account
    event TokensClaimed(address indexed account, bool indexed byOwner, uint256 claimedAmount, uint256 transferAmount);

    /// @notice The name of this vesting (e.g "Liquidity", "Founders", "Staking" etc)
    function vestingName() external view returns (string memory);

    /// @notice The size of a period in seconds
    function periodSize() external view returns (uint256);

    /// @notice The number of periods when tokens are locked
    function cliff() external view returns (uint256);

    /// @notice The number of periods when tokens will be released
    function vesting() external view returns (uint256);

    /// @notice The part of tokens to be released immediately
    /// @dev Represented as a mantissa of atto decimal
    function initialReleaseX18() external view returns (uint256);

    /// @notice The address of tokens to be locked and distributed
    function token() external view returns (IERC20);

    /// @notice Indicates if vesting is configured and started
    function started() external view returns (bool);

    /// @notice Total number of reserved tokens
    function totalReserveAmount() external view returns (uint256);

    /// @notice The timestamp of vesting start
    /// @dev Returns `0` if vesting is not started
    function startedAt() external view returns (uint256);

    /// @notice Returns the address of accounts that participates in token distribution
    /// @param index The index of address
    /// @return account The address of an account
    function accounts(uint256 index) external view returns (address account);

    /// @notice Returns the number of accounts that participates in token distribution
    /// @return length The number of accounts
    function accountsLength() external view returns (uint256 length);

    /// @notice Returns the addresses of accounts that participates in token distribution
    /// @return _accounts The list of address of accounts
    function accountsList() external view returns (address[] memory _accounts);

    /// @notice Returns account's reserve info
    /// @param account The address of an account to which reserve info should be returned
    /// @return accountReserve_ Account's reserve info
    function accountReserve(address account) external view returns (Reserve memory accountReserve_);

    /// @notice Returns claimable amounts for an account
    /// @param account Address of account for which claimable amount should be calculated
    /// @return amount Amount of claimable tokens
    function claimableAmount(address account) external view returns (uint256 amount);

    /// @notice Saves reserve info
    /// @dev Can be called only by owner and only before vesting is started
    /// @return totalReserveAmount_ Total number of reserved tokens
    function reserve(ReserveParams[] calldata paramsList) external returns (uint256 totalReserveAmount_);

    /// @notice Starts vesting
    /// @dev Can be called only by owner and only if vesting is not started yet
    /// @return startedAt_ The timestamp of vesting start
    function start() external returns (uint256 startedAt_);

    /// @notice Function to claim released tokens
    /// @dev Can be called by any user, tokens will be released to the function caller
    /// @dev Can only be called if vesting is started
    /// @return claimedAmount Amount of claimed tokens
    function claim() external returns (uint256 claimedAmount);

    /// @notice Function to claim released tokens for multiple accounts
    /// @dev Can only be called by the owner and only if vesting is started
    /// @param accountList The list of accounts to which tokens should be claimed
    /// @return totalClaimedAmount Amount of claimed tokens
    function claimBatch(address[] calldata accountList) external returns (uint256 totalClaimedAmount);

    /// @notice Function to claim released tokens for multiple accounts
    /// @dev Can only be called by the owner and only if vesting is started
    /// @dev If 'to' is greater than or equal to the size of the account list, the function will NOT revert and will
    /// iterate to the end of this list
    /// @param from The index of the first account for which tokens should be claimed
    /// @param to The index of the last account for which tokens should be claimed
    /// @return totalClaimedAmount Amount of claimed tokens
    function claimRange(uint256 from, uint256 to) external returns (uint256 totalClaimedAmount);
}
