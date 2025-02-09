import { ethers } from "hardhat";

import { getSigners } from "../signers";

export async function deployEncryptedAuctionRouterFixture() {
  const signers = await getSigners();

  const contractFactory = await ethers.getContractFactory("EncryptedAuctionRouter");
  const contract = await contractFactory.connect(signers.alice).deploy(); // City of Zama's battle
  await contract.waitForDeployment();

  return contract;
}
