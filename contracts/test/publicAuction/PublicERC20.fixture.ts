import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { AddressLike } from "ethers";
import { ethers } from "hardhat";

import { PublicERC20 } from "../../types";
import { getSigners } from "../signers";

export type PublicERC20Fixture = {
  contract: PublicERC20;
  address: string;
  mintHelper: (to: AddressLike, amount: bigint) => Promise<void>;
  approveHelper: (signer: HardhatEthersSigner, spender: AddressLike, amount: bigint) => Promise<void>;
};

export async function deployPublicERC20Fixture(name: string, symbol: string): Promise<PublicERC20Fixture> {
  const signers = await getSigners();

  const contractFactory = await ethers.getContractFactory("PublicERC20");
  const contract = await contractFactory.connect(signers.alice).deploy(name, symbol);
  await contract.waitForDeployment();

  return {
    contract,
    address: await contract.getAddress(),
    mintHelper: async (to: AddressLike, amount: bigint) => {
      const tx = await contract.connect(signers.alice).mint(to, amount);
      await tx.wait();
    },
    approveHelper: async (signer: HardhatEthersSigner, spender: AddressLike, amount: bigint) => {
      const tx = await contract.connect(signer).approve(spender, amount);
      await tx.wait();
    },
  };
}
