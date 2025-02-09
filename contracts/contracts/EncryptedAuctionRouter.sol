// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Clones.sol";
import { EncryptedAuction } from "./EncryptedAuction.sol";

import { console } from "hardhat/console.sol";

contract EncryptedAuctionRouter {
    address public encryptedAuctionImplementation;
    uint256 public auctionCount;
    mapping(uint256 => address) public auctions;
    constructor() {
        encryptedAuctionImplementation = address(new EncryptedAuction());
        auctionCount = 0;
    }

    function newEncryptedAuction(bytes32 salt) public returns (address) {
        address auction = Clones.cloneDeterministic(encryptedAuctionImplementation, salt);
        EncryptedAuction(auction).initialize(msg.sender);
        auctions[auctionCount] = auction;
        auctionCount++;
        return auction;
    }

    function newAuctionAddress(bytes32 salt) public view returns (address) {
        return Clones.predictDeterministicAddress(encryptedAuctionImplementation, salt);
    }
}
