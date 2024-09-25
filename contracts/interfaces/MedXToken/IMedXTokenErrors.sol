// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

/// @title Errors of the MedX token contract
/// @author PixelPlex Inc.
interface IMedXTokenErrors {
    /// @notice Indicates that provided address is taxed and can not be added to the whitelist
    /// @param account Address of the account to be whitelisted
    error InvalidWhitelistedAccount(address account);

    /// @notice Indicates that provided account can not be added to the blacklist
    /// @param account Address of the account to be blacklisted
    error InvalidBlacklistedAccount(address account);

    /// @notice Indicates that the sender or the receiver is blacklisted
    /// @param account Address of the blacklisted account
    error Blacklisted(address account);

    /// @notice Indicates that the fee receiver is zero address
    /// @dev Fee receiver can be zero address only if the fee feature is disable
    error InvalidFeeReceiver();

    /// @notice Indicates that the function was called by an account that is not the fee receiver
    /// @param account Address of the account that called the function
    error FeeReceiverUnauthorizedAccount(address account);

    /// @notice Indicates that the function was called by an account that is not the owner nor the admin
    /// @param account Address of the account that called the function
    error OwnerOrAdminUnauthorizedAccount(address account);

    /// @notice Indicates that the function was called by an account that is not a burner
    /// @param account Address of the account that called the function
    error BurnerUnauthorizedAccount(address account);
}
