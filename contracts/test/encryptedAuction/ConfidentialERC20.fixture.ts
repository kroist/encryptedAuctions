/* eslint-disable no-unexpected-multiline */
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { AddressLike } from "ethers";
import { FhevmInstance } from "fhevmjs/node";
import { ethers } from "hardhat";

import { MyConfidentialERC20 } from "../../types";
import { ConfidentialERC20Factory } from "../../types/contracts/ConfidentialERC20Factory";
import { getSigners } from "../signers";

export type ConfidentialERC20Fixture = {
  contract: MyConfidentialERC20;
  address: string;
  mintHelper: (to: AddressLike, amount: bigint) => Promise<void>;
  approveHelper: (
    signer: HardhatEthersSigner,
    fhevm: FhevmInstance,
    spender: AddressLike,
    amount: bigint,
  ) => Promise<void>;
};

export async function deployConfidentialERC20Fixture(
  factory: ConfidentialERC20Factory,
  name: string,
  symbol: string,
): Promise<ConfidentialERC20Fixture> {
  const signers = await getSigners();

  // const contractFactory = await ethers.getContractFactory("MyConfidentialERC20");
  // const contract = await contractFactory.connect(signers.alice).deploy(name, symbol);
  // await contract.waitForDeployment();
  const instancesCount = await factory.instancesCount();
  const tx = await factory.connect(signers.alice).create(name, symbol);
  await tx.wait();
  const address = await factory.instances(instancesCount);
  const ethersFactory = await ethers.getContractFactory("MyConfidentialERC20");
  const contract = ethersFactory.attach(address) as MyConfidentialERC20;

  return {
    contract,
    address,
    mintHelper: async (to: AddressLike, amount: bigint) => {
      const tx = await contract.connect(signers.alice).mint(to, amount);
      await tx.wait();
    },
    approveHelper: async (signer: HardhatEthersSigner, fhevm: FhevmInstance, spender: AddressLike, amount: bigint) => {
      const inputAlice = fhevm.createEncryptedInput(await contract.getAddress(), signer.address);
      inputAlice.add64(amount);
      const encryptedAllowanceAmount = await inputAlice.encrypt();
      const tx = await contract
        .connect(signer)
        ["approve(address,bytes32,bytes)"](
          spender,
          encryptedAllowanceAmount.handles[0],
          encryptedAllowanceAmount.inputProof,
        );
      await tx.wait();
    },
  };
}
