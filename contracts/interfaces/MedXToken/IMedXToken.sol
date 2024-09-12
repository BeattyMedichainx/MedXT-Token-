// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IMedXTokenEvents} from "./IMedXTokenEvents.sol";
import {IMedXTokenErrors} from "./IMedXTokenErrors.sol";

/// @title Interface of the MedX token contract
/// @author PixelPlex Inc.
interface IMedXToken is IMedXTokenEvents, IMedXTokenErrors {
    // #region public constants
    // solhint-disable func-name-mixedcase
    // slither-disable-start naming-convention

    /// @notice Fee percent on buy
    function BUY_FEE_PERCENT() external pure returns (uint256);

    /// @notice Fee percent on sell
    function SELL_FEE_PERCENT() external pure returns (uint256);

    // slither-disable-end naming-convention
    // solhint-enable func-name-mixedcase
    // #endregion

    /// @return weth The address of the wrapped ETH contract
    function weth() external view returns (address);

    /// @return uniV2Router The address of the Uniswap V2 router (Router02)
    function uniV2Router() external view returns (IUniswapV2Router02);

    /// @return feeEnabled Equals `true` if the fee feature is enabled, `false` otherwise
    function feeEnabled() external view returns (bool);

    /// @return admin The address of the admin
    function admin() external view returns (address);

    /// @return feeReceiver The address of the fee receiver
    function feeReceiver() external view returns (address payable);

    /// @notice Checks if an account is whitelisted, meaning the trading fee is not applicable to it
    /// @param account The address of the account to check whitelisting for
    /// @return whitelisted_ Equals `true` if the account is whitelisted, `false` otherwise
    function whitelisted(address account) external view returns (bool whitelisted_);

    /// @notice Checks if an account is blacklisted and cannot send or receive MedX tokens
    /// @param account The address of the account to check blacklisting for
    /// @return blacklisted_ Equals `true` if the account is blacklisted, `false` otherwise
    function blacklisted(address account) external view returns (bool blacklisted_);

    /// @notice Checks if an account is a taxable DEX, to which a fee should be applied
    /// @dev When tokens are sent to the DEX, it is considered a buy operation and 3% of the sent tokens will be
    /// sent to the fee receiver.
    /// @dev When tokens are received from the DEX, it is considered a sell operation and 3% of the received
    /// tokens will be swapped to ETH and sent to the fee receiver.
    /// @param account The address of the account to check if it is a taxable DEX
    /// @return applyTax_ Equals `true` if the account is a taxable DEX, `false` otherwise
    function applyTax(address account) external view returns (bool applyTax_);

    /// @notice Checks if an account is in the burners list
    /// @param account The address of the account to check if it is in the burners list
    /// @return canBurn_ Equals `true` if the account can burn tokens
    function canBurn(address account) external view returns (bool canBurn_);

    // #region ADMIN & OWNER FUNCTIONS

    /// @notice Changes the address of the admin
    /// @dev Can only be called by the owner or the admin
    /// @dev Will succeed, but will not emit any event if the current admin equals `newAdmin`
    /// @param newAdmin The address of the new admin
    /// @return changed Equals `true` if the fee receiver is updated, `false` otherwise
    function updateAdmin(address newAdmin) external returns (bool changed);

    /// @notice Enables or disables the fee feature
    /// @dev Can only be called by the owner or the admin
    /// @dev Will succeed, but will not emit any event if the current fee feature state equals `enabled`
    /// @param enabled Should equal `true` if the fee feature should be enabled, `false` otherwise
    /// @return toggled Equals `true` if the fee feature was toggled, `false` otherwise
    function toggleFee(bool enabled) external returns (bool toggled);

    /// @notice Changes the address of the fee receiver
    /// @dev Can only be called by the owner or the admin
    /// @dev Will succeed, but will not emit any event if the current fee receiver equals `newFeeReceiver`
    /// @param newFeeReceiver The address of the new fee receiver
    /// @return changed Equals `true` if the fee receiver is updated, `false` otherwise
    function updateFeeReceiver(address payable newFeeReceiver) external returns (bool changed);

    /// @notice Updates the whitelist
    /// @dev Can only be called by the owner or the admin
    /// @dev The function will not check if the same address is in both parameters. In this case, the address
    /// will be whitelisted.
    /// @param removeFromWhitelist The list of addresses to be removed from the whitelist
    /// @param addToWhitelist The list of addresses to be added to the whitelist
    function updateWhitelist(address[] calldata removeFromWhitelist, address[] calldata addToWhitelist) external;

    /// @notice Updates the blacklist
    /// @dev Can only be called by the owner or the admin
    /// @dev The function will not check if the same address is in both parameters. In this case, the address
    /// will be blacklisted.
    /// @param removeFromBlacklist The list of addresses to be removed from the blacklist
    /// @param addToBlacklist The list of addresses to be added to the blacklist
    function updateBlacklist(address[] calldata removeFromBlacklist, address[] calldata addToBlacklist) external;

    /// @notice Updates the list of taxable DEX addresses
    /// @dev Can only be called by the owner or the admin
    /// @dev The function will not check if the same address is in both parameters. In this case, the address
    /// will be added to the list.
    /// @param removeFromTaxedList The list of addresses to be removed from the list of taxable DEX addresses
    /// @param addToTaxedList The list of addresses to be added to the list of taxable DEX addresses
    function updateTaxedAddresses(address[] calldata removeFromTaxedList, address[] calldata addToTaxedList) external;

    /// @notice Updates the list of addresses, that can burn tokens
    /// @dev Can only be called by the owner or the admin
    /// @dev The function will not check if the same address is in both parameters. In this case, the address
    /// will be added to the list.
    /// @param removeFromBurnersList The list of addresses to be removed from the burners list
    /// @param addToBurnersList The list of addresses to be added to the burners list
    function updateBurnersList(address[] calldata removeFromBurnersList, address[] calldata addToBurnersList) external;

    // #endregion
}
