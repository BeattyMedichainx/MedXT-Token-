// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract UniV2PairMock {
    address public tokenA;
    address public tokenB;

    constructor(address _tokenA, address _tokenB) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }
}
