// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Events of MedX token contract
/// @author PixelPlex Inc.
interface IMedXTokenEvents {
    /// @notice Emitted when the admin address is updated
    /// @param previousAdmin The address of previous admin
    /// @param newAdmin The address of the new admin
    event AdminUpdated(address indexed previousAdmin, address indexed newAdmin);

    // #region FEE EVENTS

    /// @notice Emitted when the fee feature is toggled
    /// @param enabled `true` if fee is enabled, `false` otherwise
    event FeeToggled(bool indexed enabled);

    /// @notice Emitted when the fee receiver is updated
    /// @param prevFeeReceiver Address of previous fee receiver
    /// @param newFeeReceiver Address of the new fee receiver
    event FeeReceiverUpdated(address indexed prevFeeReceiver, address indexed newFeeReceiver);

    /// @notice Emitted when fee is collected in MedX tokens
    /// @dev Whenever the user sells MedX tokens the contract charges the fee and sends it to the fee receiver
    /// @param transferFrom Address of the account that sent tokens
    /// @param transferTo Address of the account that received tokens
    /// @param feeReceiver Address of the account that received the fee (current fee receiver)
    /// @param feeValue Amount of tokens that were charged as a fee
    event FeeTokenCollected(
        address indexed transferFrom,
        address indexed transferTo,
        address indexed feeReceiver,
        uint256 feeValue
    );

    /// @notice Emitted when swapping MedX tokens to ETH is failed
    /// @dev Whenever the user buys MedX tokens the contract tries to swap the fee to ETH using UniswapV2
    /// @param amountIn Amount of tokens that were charged as a fee
    /// @param reason Reason of the swap's failure
    event FeeSwapFailed(uint256 amountIn, bytes reason);

    /// @notice Emitted when fee is collected in ETH
    /// @dev Whenever the user buys MedX tokens the contract swaps fee to ETH using UniswapV2.
    /// @dev Swapped ETH is sent to the fee receiver.
    /// @param transferFrom Address of the account that sent tokens
    /// @param transferTo Address of the account that received tokens
    /// @param feeReceiver Address of the account that received the fee (current fee receiver)
    /// @param tokenFeeValue Amount of tokens that were charged as a fee
    /// @param ethFeeValue Amount of ETH received from the swap
    event FeeEthCollected(
        address indexed transferFrom,
        address indexed transferTo,
        address indexed feeReceiver,
        uint256 tokenFeeValue,
        uint256 ethFeeValue
    );

    // #endregion

    /// @notice Emitted when an address is added to or removed from the whitelist
    /// @param account Address of the account that was added to or removed from the whitelist
    /// @param whitelisted `true` if account is added to whitelist, `false` if it was removed
    event WhitelistUpdated(address indexed account, bool indexed whitelisted);

    /// @notice Emitted when an address is added to or removed from the blacklist
    /// @param account Address of the account, that was added to or removed from the blacklist
    /// @param blacklisted `true` if account is added to blacklist, `false` if it was removed
    event BlacklistUpdated(address indexed account, bool indexed blacklisted);

    /// @notice Emitted when an address is added to or removed from the tax list
    /// @param account Address of the account, that was added to or removed from the tax list
    /// @param taxed `true` if account is added to tax list, `false` if it was removed
    event TaxedListUpdated(address indexed account, bool indexed taxed);

    /// @notice Emitted when an address is added to or removed from the burners list
    /// @param account Address of the account, that was added to or removed from the burners list
    /// @param canBurn `true` if account is added to the burners list, `false` if it was removed
    event BurnersListUpdated(address indexed account, bool indexed canBurn);
}
