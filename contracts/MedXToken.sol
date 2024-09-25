// SPDX-License-Identifier: MIT
pragma solidity =0.8.24;

import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ERC20, ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IUniswapV2Factory} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import {IMedXToken} from "./interfaces/MedXToken/IMedXToken.sol";
import {UnsafeMath} from "./libraries/UnsafeMath.sol";

/// @title MedX ERC20 Token
/// @author PixelPlex Inc.
contract MedXToken is IMedXToken, ERC20Burnable, Ownable2Step, ReentrancyGuard {
    using UnsafeMath for uint256;

    /// @inheritdoc IMedXToken
    uint256 public constant BUY_FEE_PERCENT = 3;

    /// @inheritdoc IMedXToken
    uint256 public constant SELL_FEE_PERCENT = 3;

    /// @inheritdoc IMedXToken
    address public immutable weth;

    /// @inheritdoc IMedXToken
    address public immutable wethUniV2Pair;

    /// @inheritdoc IMedXToken
    IUniswapV2Router02 public immutable uniV2Router;

    /// @inheritdoc IMedXToken
    bool public feeEnabled;

    /// @inheritdoc IMedXToken
    address public admin;

    /// @inheritdoc IMedXToken
    address payable public feeReceiver;

    /// @inheritdoc IMedXToken
    mapping(address => bool) public whitelisted;

    /// @inheritdoc IMedXToken
    mapping(address => bool) public blacklisted;

    /// @inheritdoc IMedXToken
    mapping(address => bool) public applyTax;

    /// @inheritdoc IMedXToken
    mapping(address => bool) public canBurn;

    constructor(
        address _owner,
        address payable _feeReceiver,
        IUniswapV2Router02 _uniV2Router,
        address usdt
    ) ERC20("MedXT", "$MedXT") Ownable(_owner) {
        address admin_ = msg.sender;
        _mint(admin_, 25e9 * 1e18);
        _setAdmin(admin_);
        _setFeeReceiver(_feeReceiver);
        _toggleFee(true);
        uniV2Router = _uniV2Router;
        weth = _uniV2Router.WETH();
        IUniswapV2Factory factory = IUniswapV2Factory(_uniV2Router.factory());
        address self = address(this);
        address _wethUniV2Pair = factory.createPair(self, weth);
        wethUniV2Pair = _wethUniV2Pair;
        address usdtUniV2Pair = factory.createPair(self, usdt);
        _updateTaxedList(_wethUniV2Pair, true);
        _updateTaxedList(usdtUniV2Pair, true);
        _approve(self, address(_uniV2Router), type(uint256).max);
    }

    // #region PUBLIC OVERRIDES

    /// @inheritdoc ERC20Burnable
    function burn(uint256 value) public override(ERC20Burnable) onlyBurner {
        super.burn(value);
    }

    /// @inheritdoc ERC20Burnable
    function burnFrom(address account, uint256 value) public override(ERC20Burnable) onlyBurner {
        super.burnFrom(account, value);
    }

    // #endregion

    // #region ADMIN & OWNER FUNCTIONS

    /// @inheritdoc IMedXToken
    function updateAdmin(address newAdmin) external onlyOwnerOrAdmin returns (bool changed) {
        return _setAdmin(newAdmin);
    }

    /// @inheritdoc IMedXToken
    function toggleFee(bool enable) external onlyOwnerOrAdmin returns (bool toggled) {
        return _toggleFee(enable);
    }

    /// @inheritdoc IMedXToken
    function updateFeeReceiver(address payable newFeeReceiver) external onlyOwnerOrAdmin returns (bool changed) {
        return _setFeeReceiver(newFeeReceiver);
    }

    /// @inheritdoc IMedXToken
    function updateWhitelist(
        address[] calldata removeFromWhitelist,
        address[] calldata addToWhitelist
    ) external onlyOwnerOrAdmin {
        uint256 removeListLength = removeFromWhitelist.length;
        for (uint256 i = 0; i < removeListLength; i++) _updateWhitelist(removeFromWhitelist[i], false);
        uint256 addListLength = addToWhitelist.length;
        for (uint256 i = 0; i < addListLength; i++) _updateWhitelist(addToWhitelist[i], true);
    }

    /// @inheritdoc IMedXToken
    function updateBlacklist(
        address[] calldata removeFromBlacklist,
        address[] calldata addToBlacklist
    ) external onlyOwnerOrAdmin {
        uint256 removeListLength = removeFromBlacklist.length;
        for (uint256 i = 0; i < removeListLength; i++) _updateBlacklist(removeFromBlacklist[i], false);
        uint256 addListLength = addToBlacklist.length;
        for (uint256 i = 0; i < addListLength; i++) _updateBlacklist(addToBlacklist[i], true);
    }

    /// @inheritdoc IMedXToken
    function updateTaxedAddresses(
        address[] calldata removeFromTaxedList,
        address[] calldata addToTaxedList
    ) external onlyOwnerOrAdmin {
        uint256 removeListLength = removeFromTaxedList.length;
        for (uint256 i = 0; i < removeListLength; i++) _updateTaxedList(removeFromTaxedList[i], false);
        uint256 addListLength = addToTaxedList.length;
        for (uint256 i = 0; i < addListLength; i++) _updateTaxedList(addToTaxedList[i], true);
    }

    /// @inheritdoc IMedXToken
    function updateBurnersList(
        address[] calldata removeFromBurnersList,
        address[] calldata addToBurnersList
    ) external onlyOwnerOrAdmin {
        uint256 removeListLength = removeFromBurnersList.length;
        for (uint256 i = 0; i < removeListLength; i++) _updateBurnersList(removeFromBurnersList[i], false);
        uint256 addListLength = addToBurnersList.length;
        for (uint256 i = 0; i < addListLength; i++) _updateBurnersList(addToBurnersList[i], true);
    }

    // #endregion

    // #region PRIVATE OVERRIDES

    function _update(address from, address to, uint256 value) internal override(ERC20) {
        if (blacklisted[from]) revert Blacklisted(from);
        if (blacklisted[to]) revert Blacklisted(to);
        if (!feeEnabled || whitelisted[from] || whitelisted[to] || from == address(this)) {
            return super._update(from, to, value);
        }
        if (applyTax[to]) _updateWithSellFee(from, to, value);
        else if (applyTax[from]) _updateWithBuyFee(from, to, value);
        else super._update(from, to, value);
    }

    // emit Approval event on transferFrom and burnFrom operations
    function _approve(address owner, address spender, uint256 value, bool) internal virtual override(ERC20) {
        super._approve(owner, spender, value, true);
    }

    // #endregion

    function _collectFee(address transferFrom, address transferTo, address feeFrom, uint256 feeValue) private {
        address _feeReceiver = feeReceiver;
        super._update(feeFrom, _feeReceiver, feeValue);
        emit FeeTokenCollected(transferFrom, transferTo, _feeReceiver, feeValue);
    }

    function _updateWithSellFee(address from, address to, uint256 value) private {
        uint256 fee = (value * SELL_FEE_PERCENT) / 100;
        value = value.unsafeSub(fee);
        _collectFee(from, to, from, fee);
        super._update(from, to, value);
    }

    // has nonReentrant modifier
    // slither-disable-next-line reentrancy-no-eth
    function _updateWithBuyFee(address from, address to, uint256 value) private nonReentrant {
        uint256 tokenFee = (value * BUY_FEE_PERCENT) / 100;
        value = value.unsafeSub(tokenFee);
        address self = address(this);
        super._update(from, self, tokenFee);
        (bool swapSucceed, uint256 ethFee) = _trySwapFeeToEth(tokenFee);
        if (swapSucceed) emit FeeEthCollected(from, to, feeReceiver, tokenFee, ethFee);
        else _collectFee(from, to, self, tokenFee);
        super._update(from, to, value);
    }

    function _trySwapFeeToEth(uint256 value) private returns (bool success, uint256 amountOut) {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = weth;
        try uniV2Router.swapExactTokensForETH(value, 1e-6 ether, path, feeReceiver, block.timestamp) returns (
            uint256[] memory amounts
        ) {
            return (true, amounts[1]);
        } catch (bytes memory reason) {
            // event is emitted if call reverted, so reentrancy is not possible here
            // slither-disable-next-line reentrancy-events
            emit FeeSwapFailed(value, reason);
            return (false, 0);
        }
    }

    function _toggleFee(bool enabled) private returns (bool toggled) {
        if (feeEnabled == enabled) return false;
        if (enabled && feeReceiver == address(0)) revert InvalidFeeReceiver();
        feeEnabled = enabled;
        emit FeeToggled(enabled);
        return true;
    }

    function _setFeeReceiver(address payable newFeeReceiver) private returns (bool changed) {
        address prevFeeReceiver = feeReceiver;
        if (prevFeeReceiver == newFeeReceiver) return false;
        if (newFeeReceiver == address(0) && feeEnabled) revert InvalidFeeReceiver();
        emit FeeReceiverUpdated(prevFeeReceiver, newFeeReceiver);
        feeReceiver = newFeeReceiver;
        return true;
    }

    function _updateWhitelist(address account, bool whitelist) private {
        if (whitelisted[account] == whitelist) return;
        if (applyTax[account]) revert InvalidWhitelistedAccount(account);
        whitelisted[account] = whitelist;
        emit WhitelistUpdated(account, whitelist);
    }

    function _updateBlacklist(address account, bool blacklist) private {
        if (blacklisted[account] == blacklist) return;
        if (account == address(this) || account == wethUniV2Pair) revert InvalidBlacklistedAccount(account);
        blacklisted[account] = blacklist;
        emit BlacklistUpdated(account, blacklist);
    }

    function _updateTaxedList(address account, bool taxed) private {
        if (applyTax[account] == taxed) return;
        if (taxed) _updateWhitelist(account, false);
        applyTax[account] = taxed;
        emit TaxedListUpdated(account, taxed);
    }

    function _updateBurnersList(address account, bool _canBurn) private {
        if (canBurn[account] == _canBurn) return;
        canBurn[account] = _canBurn;
        emit BurnersListUpdated(account, _canBurn);
    }

    function _setAdmin(address newAdmin) private returns (bool changed) {
        address prevAdmin = admin;
        if (prevAdmin == newAdmin) return false;
        emit AdminUpdated(prevAdmin, newAdmin);
        admin = newAdmin;
        return true;
    }

    modifier onlyOwnerOrAdmin() {
        address caller = msg.sender;
        if (caller != owner() && caller != admin) revert OwnerOrAdminUnauthorizedAccount(caller);
        _;
    }

    modifier onlyBurner() {
        address caller = msg.sender;
        if (!canBurn[caller]) revert BurnerUnauthorizedAccount(caller);
        _;
    }
}
