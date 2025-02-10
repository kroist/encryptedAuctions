// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/config/ZamaFHEVMConfig.sol";
import "fhevm-contracts/contracts/token/ERC20/extensions/ConfidentialERC20Mintable.sol";

/// @notice This contract implements an encrypted ERC20-like token with confidential balances using Zama's FHE library.
/// @dev It supports typical ERC20 functionality such as transferring tokens, minting, and setting allowances,
/// @dev but uses encrypted data types.
contract PublicMintConfidentialERC20 is SepoliaZamaFHEVMConfig, ConfidentialERC20Mintable {
    /// @notice Constructor to initialize the token's name and symbol, and set up the owner
    /// @param name_ The name of the token
    /// @param symbol_ The symbol of the token
    constructor(string memory name_, string memory symbol_) ConfidentialERC20Mintable(name_, symbol_, address(this)) {}

    function mint(address to, uint64 amount) public override {
        _unsafeMint(to, amount);
        /// @dev Since _totalSupply is not encrypted and we ensure there is no underflow/overflow of encrypted balances
        /// during transfers, making _totalSupply invariant during transfers, we know _totalSupply is greater than
        /// all individual balances. Hence, the next line forbids any overflow to happen in the _unsafeMint above.
        _totalSupply = _totalSupply + amount;
        emit Mint(to, amount);
    }
}
