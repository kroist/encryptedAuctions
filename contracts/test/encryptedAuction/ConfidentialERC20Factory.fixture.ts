/* eslint-disable no-unexpected-multiline */
import { ethers } from "hardhat";

import { ConfidentialERC20Factory } from "../../types/contracts/ConfidentialERC20Factory";
import { getSigners } from "../signers";

export async function deployConfidentialERC20FactoryFixture(): Promise<ConfidentialERC20Factory> {
  const signers = await getSigners();

  const contractFactory = await ethers.getContractFactory("ConfidentialERC20Factory");
  const contract = await contractFactory.connect(signers.alice).deploy();
  await contract.waitForDeployment();

  return contract;
}
