// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {UniV2PairMock} from "./UniV2PairMock.sol";

contract UniV2FactoryMock {
    mapping(address => mapping(address => address)) private pairs;

    function getPair(address token0, address token1) external view returns (address pair) {
        (address tokenA, address tokenB) = _sortTokens(token0, token1);
        return pairs[tokenA][tokenB];
    }

    function createPair(address token0, address token1) external returns (address pair) {
        (address tokenA, address tokenB) = _sortTokens(token0, token1);
        pair = pairs[tokenA][tokenB];
        return pair == address(0) ? pairs[tokenA][tokenB] = address(new UniV2PairMock(tokenA, tokenB)) : pair;
    }

    function _sortTokens(address token0, address token1) public pure returns (address tokenA, address tokenB) {
        return token0 < token1 ? (token0, token1) : (token1, token0);
    }
}
