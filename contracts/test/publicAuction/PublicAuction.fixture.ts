import { ethers } from "hardhat";

import type { PublicAuction } from "../../types";
import { getSigners } from "../signers";

export async function deployPublicAuctionFixture(): Promise<PublicAuction> {
  const signers = await getSigners();

  const contractFactory = await ethers.getContractFactory("PublicAuction");
  const contract = await contractFactory.connect(signers.alice).deploy(); // City of Zama's battle
  await contract.waitForDeployment();

  return contract;
}
