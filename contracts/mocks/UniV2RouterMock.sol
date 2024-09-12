// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {UniV2FactoryMock} from "./UniV2FactoryMock.sol";

contract UniV2RouterMock {
    UniV2FactoryMock public immutable factory;
    IERC20 public immutable WETH;

    constructor(UniV2FactoryMock _factory, IERC20 _weth) {
        factory = _factory;
        WETH = _weth;
    }
}
