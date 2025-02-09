import { ethers } from "hardhat";

import { EncryptedAuctionRouter, EncryptedAuction__factory } from "../../types";
import { PublicERC20Fixture } from "../publicAuction/PublicERC20.fixture";
import { Signers, getSigners } from "../signers";
import { ConfidentialERC20Fixture } from "./ConfidentialERC20.fixture";

export async function deployEncryptedAuctionFixture(router: EncryptedAuctionRouter) {
  const signers = await getSigners();

  const auctionsCount = await router.auctionCount();
  const tx = router.connect(signers.alice).newEncryptedAuction(ethers.randomBytes(32));
  (await tx).wait();
  const address = await router.auctions(auctionsCount);
  const contract = EncryptedAuction__factory.connect(address, signers.alice);

  return {
    contract,
    createFixtureAuction: async (
      auctionableToken: ConfidentialERC20Fixture,
      bidToken: ConfidentialERC20Fixture,
      initialTokenAmount: bigint,
      floorPrice: bigint,
      signers: Signers,
      startTime: bigint,
      endTime: bigint,
      stakeToken: PublicERC20Fixture,
      stakeAmount: bigint,
    ) => {
      const domain = {
        name: "EncryptedAuction",
        version: "1",
        chainId: 31337,
        verifyingContract: address,
      };
      return contract.createAuction(
        auctionableToken.address,
        initialTokenAmount,
        bidToken.address,
        signers.jane.address,
        floorPrice,
        startTime,
        endTime,
        stakeToken.address,
        stakeAmount,
        await signers.jane.signTypedData(
          domain,
          {
            AuctionData: [
              { name: "token", type: "address" },
              { name: "tokenAmount", type: "uint64" },
              { name: "bidToken", type: "address" },
              { name: "bidSequencer", type: "address" },
              { name: "floorPrice", type: "uint64" },
              { name: "startTime", type: "uint256" },
              { name: "endTime", type: "uint256" },
              { name: "stakeToken", type: "address" },
              { name: "stakeAmount", type: "uint256" },
            ],
          },
          {
            token: auctionableToken.address,
            tokenAmount: initialTokenAmount,
            bidToken: bidToken.address,
            bidSequencer: signers.jane.address,
            floorPrice: floorPrice,
            startTime: startTime,
            endTime: endTime,
            stakeToken: stakeToken.address,
            stakeAmount: stakeAmount,
          },
        ),
      );
    },
  };
}
