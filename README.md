# Encrypted Single-Price Auction

A privacy-preserving auction system built on fhEVM that enables confidential bidding and trustless bid sorting.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Protocol Description](#protocol-description)
  - [Participants](#participants)
  - [Process Stages](#process-stages)
- [Implementation](#implementation)
  - [Components](#components)
  - [Project Structure](#project-structure)
  - [Gas Consumption](#gas-consumption)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Overview

This project implements a confidential single-price auction system using the fhEVM (Fully Homomorphic Encryption Virtual Machine). It enables private bidding while maintaining trustless bid sorting through smart contracts.

## Protocol Description

### Participants

The auction system involves four key participants:

- **Auction Creator**: Initiates and configures the auction
- **Bidder**: Submits encrypted bids for the auctioned tokens
- **Privacy-Trusted Bid Sorter (PTBS)**: Processes and sorts encrypted bids
- **Auction Smart Contract (ASM)**: Manages the auction logic and token transfers

### Process Stages

#### 1. Auction Configuration

The Auction Creator:

- Creates and mints a confidential ERC-20 token
- Creates an empty ASM instance
- Configures auction parameters:
  - Token amount for sale
  - Accepted bid token
  - Floor price
  - Auction duration (start/end dates)
  - PTBS address and required stake
- Obtains PTBS signature (EIP-712) and stake approval
- Initializes ASM to start the auction

#### 2. Bidding Stage

When the auction is live, bidders can:

- Approve bid tokens for ASM
- Submit encrypted bids containing:
  - Price
  - Token amount to purchase
  - PTBS fee and gas coverage (planned for mainnet)

#### 3. Bid Calculation Stage

The PTBS:

- Fetches and decrypts bids using smart contract-allowed re-encryption
- Sorts bids by (price, bid_id):
  - Primary: prices in non-increasing order
  - Secondary: bid_id in non-decreasing order
- Submits sorted bids to the smart contract for FHE verification

**Slashing**: PTBS stake is slashed if bids aren't processed within 7 days

**TEE Enhancement**: Optional Trusted Execution Environment integration possible for enhanced privacy

#### 4. Reward Claiming Stage

After bid processing:

- Bidders can claim won tokens and receive bid token refunds
- Auction creator can withdraw payments and reclaim unsold tokens

## Implementation

### Components

1. **Smart Contracts**: fhEVM-based contracts for auction logic
2. **Bid Sorting Server**: Processes and orders encrypted bids
3. **Frontend**: Web interface for auction interaction

### Project Structure

```
├── contracts/          # Smart contract implementation
├── frontend/          # React-based web interface
└── bid-server/        # Bid processing server
```

### Gas Consumption

Function gas costs based on local hardhat testing with mocked FHE:

| Function              | Native Gas | FHE Gas   |
| --------------------- | ---------- | --------- |
| createAuction         | 708,138    | 1,010,450 |
| bid                   | 945,636    | 3,115,400 |
| First bid processing  | 268,396    | 100       |
| First bid callback    | 424,164    | 1,002,050 |
| Second bid processing | 309,880    | 294,200   |
| Second bid callback   | 409,064    | 1,002,050 |
| claim                 | 514,466    | 2,641,800 |
| claimOwner            | 528,337    | 2,243,250 |

## Development

The auction contract is fully tested on a local Hardhat node with mocked FHE functionality. To run tests:

```bash
cd contracts
pnpm test
```
