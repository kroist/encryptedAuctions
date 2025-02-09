// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import { MyConfidentialERC20 } from "./MyConfidentialERC20.sol";

contract ConfidentialERC20Factory {
    uint256 public instancesCount;
    mapping(uint256 => address) public instances;

    constructor() {
        instancesCount = 0;
    }

    function create(string memory name, string memory symbol) public returns (address) {
        address token = address(new MyConfidentialERC20(name, symbol, msg.sender));
        instances[instancesCount] = token;
        instancesCount++;
        return token;
    }
}
