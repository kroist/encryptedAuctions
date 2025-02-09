import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { latest } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";
import { expect } from "chai";
import { FhevmInstance } from "fhevmjs/node";
import { network } from "hardhat";

import type { EncryptedAuction, EncryptedAuctionRouter } from "../../types";
import { ConfidentialERC20Factory } from "../../types/contracts/ConfidentialERC20Factory";
import { awaitAllDecryptionResults } from "../asyncDecrypt";
import { createInstance } from "../instance";
import { PublicERC20Fixture, deployPublicERC20Fixture } from "../publicAuction/PublicERC20.fixture";
import { reencryptEuint64 } from "../reencrypt";
import { Signers, getSigners, initSigners } from "../signers";
import { debug } from "../utils";
import { ConfidentialERC20Fixture, deployConfidentialERC20Fixture } from "./ConfidentialERC20.fixture";
import { deployConfidentialERC20FactoryFixture } from "./ConfidentialERC20Factory.fixture";
import { deployEncryptedAuctionFixture } from "./EncryptedAuction.fixture";
import { deployEncryptedAuctionRouterFixture } from "./EncryptedAuctionRouter.fixture";

// Test constants
const INITIAL_TOKEN_AMOUNT = 100n;
const FLOOR_PRICE = 50n;
// One hour from now
const START_TIME = 3600n;
// Two hours from now
const END_TIME = 7200n;
// After end time
const POST_END_TIME = END_TIME + 60n; // 1 minute after end
const BID_AMOUNT = 10n;
const BID_PRICE = 60n;
const INITIAL_BID_TOKEN_BALANCE = 10_000n;

// Bid processing constants
const HIGH_PRICE = 100n;
const MID_PRICE = 90n;
const LOW_PRICE = 80n;
const HIGH_AMOUNT = 40n;
const MID_AMOUNT = 30n;
const LOW_AMOUNT = 50n;

const STAKE_AMOUNT = 1000n;

describe("EncryptedAuction", function () {
  let startTime: bigint;
  let endTime: bigint;
  // Helper function to setup tokens and approvals
  async function setupTokensAndApprovals(
    token: ConfidentialERC20Fixture,
    amount: bigint,
    encryptedAuction: EncryptedAuction,
    signer: HardhatEthersSigner,
    fhevm: FhevmInstance,
  ) {
    await token.mintHelper(signer.address, amount);
    await token.approveHelper(signer, fhevm, encryptedAuction.getAddress(), amount);
  }

  // Helper function to create auction
  async function createTestAuction(
    encryptedAuction: EncryptedAuction,
    auctionableToken: ConfidentialERC20Fixture,
    bidToken: ConfidentialERC20Fixture,
    signers: Signers,
  ) {
    startTime = BigInt(Math.floor(await latest())) + START_TIME;
    endTime = BigInt(Math.floor(await latest())) + END_TIME;
    return fixtureAuction.createFixtureAuction(
      auctionableToken,
      bidToken,
      INITIAL_TOKEN_AMOUNT,
      FLOOR_PRICE,
      signers,
      startTime,
      endTime,
      stakeToken,
      STAKE_AMOUNT,
    );
  }

  let encryptedAuction: EncryptedAuction;
  let signers: Signers;
  let auctionableToken: ConfidentialERC20Fixture;
  let bidToken: ConfidentialERC20Fixture;
  let fhevm: FhevmInstance;
  let fixtureAuction: Awaited<ReturnType<typeof deployEncryptedAuctionFixture>>;
  let stakeToken: PublicERC20Fixture;
  let router: EncryptedAuctionRouter;
  let tokenFactory: ConfidentialERC20Factory;

  before(async function () {
    await initSigners();
    signers = await getSigners();
    router = await deployEncryptedAuctionRouterFixture();
    tokenFactory = await deployConfidentialERC20FactoryFixture();
  });

  beforeEach(async function () {
    fixtureAuction = await deployEncryptedAuctionFixture(router);
    encryptedAuction = fixtureAuction.contract;
    auctionableToken = await deployConfidentialERC20Fixture(tokenFactory, "AuctionableToken", "AT");
    bidToken = await deployConfidentialERC20Fixture(tokenFactory, "BidToken", "BT");
    stakeToken = await deployPublicERC20Fixture("StakeToken", "ST");
    fhevm = await createInstance();
  });

  describe("Auction Creation", function () {
    beforeEach(async function () {
      await setupTokensAndApprovals(auctionableToken, INITIAL_TOKEN_AMOUNT, encryptedAuction, signers.alice, fhevm);
      await stakeToken.mintHelper(signers.jane.address, STAKE_AMOUNT);
      await stakeToken.approveHelper(signers.jane, encryptedAuction.getAddress(), STAKE_AMOUNT);
    });

    it("should initialize auction with correct parameters and emit event", async function () {
      const tx = await createTestAuction(encryptedAuction, auctionableToken, bidToken, signers);
      await tx.wait();

      // Verify event emission
      const auctionEvent = await encryptedAuction.queryFilter(encryptedAuction.filters.AuctionCreated());
      expect(auctionEvent.length).to.equal(1);

      // Verify auction data
      const auction = await encryptedAuction.auctionData();

      expect(auction.token).to.equal(auctionableToken.address);
      expect(auction.tokenAmount).to.equal(INITIAL_TOKEN_AMOUNT);
      expect(auction.bidToken).to.equal(bidToken.address);
      expect(auction.bidSequencer).to.equal(signers.jane.address);
      expect(auction.floorPrice).to.equal(FLOOR_PRICE);
      expect(auction.startTime).to.equal(startTime);
      expect(auction.endTime).to.equal(endTime);
      expect(auction.bidIndex).to.equal(1);
      expect(auction.processedBidIndex).to.equal(1);
      if (network.name === "hardhat") {
        expect(await debug.decrypt128(auction.slidingSum)).to.equal(0n);
      }
      expect(auction.lastProcessedBidId).to.equal(0);
      if (network.name === "hardhat") {
        expect(await debug.decrypt64(auction.finalPrice)).to.equal(0n);
      }
      expect(auction.creator).to.equal(signers.alice.address);
    });
  });

  // Helper function to setup a bidder with tokens and approvals
  async function placeBid(signer: HardhatEthersSigner, price: bigint, amount: bigint) {
    const input = fhevm.createEncryptedInput(await encryptedAuction.getAddress(), signer.address);
    input.add64(price);
    input.add64(amount);
    const encryptedPlaceBid = await input.encrypt();

    const bid = encryptedAuction
      .connect(signer)
      .placeBid(encryptedPlaceBid.handles[0], encryptedPlaceBid.handles[1], encryptedPlaceBid.inputProof);
    return bid;
  }

  async function validateBid(
    signer: HardhatEthersSigner,
    price: bigint,
    amount: bigint,
    wonAmount: bigint,
    bidBalanceAfter: bigint,
  ) {
    const bidId = await encryptedAuction.bidId(signer.address);

    expect(bidId).to.not.equal(0n);
    const bid = await encryptedAuction.bids(bidId);
    expect(await reencryptEuint64(signer, fhevm, bid.price, await encryptedAuction.getAddress())).to.equal(price);
    expect(await reencryptEuint64(signer, fhevm, bid.amount, await encryptedAuction.getAddress())).to.equal(amount);
    expect(await reencryptEuint64(signer, fhevm, bid.wonAmount, await encryptedAuction.getAddress())).to.equal(
      wonAmount,
    );
    const bidTokenBalance = await bidToken.contract.balanceOf(signer.address);
    expect(await reencryptEuint64(signer, fhevm, bidTokenBalance, bidToken.address)).to.equal(bidBalanceAfter);
  }

  describe("Bid Placement", function () {
    beforeEach(async function () {
      await setupTokensAndApprovals(auctionableToken, INITIAL_TOKEN_AMOUNT, encryptedAuction, signers.alice, fhevm);
      await stakeToken.mintHelper(signers.jane.address, STAKE_AMOUNT);
      await stakeToken.approveHelper(signers.jane, encryptedAuction.getAddress(), STAKE_AMOUNT);
      const tx = await createTestAuction(encryptedAuction, auctionableToken, bidToken, signers);
      await tx.wait();
      await setupTokensAndApprovals(bidToken, INITIAL_BID_TOKEN_BALANCE, encryptedAuction, signers.bob, fhevm);
      await setupTokensAndApprovals(bidToken, INITIAL_BID_TOKEN_BALANCE, encryptedAuction, signers.carol, fhevm);
      await setupTokensAndApprovals(bidToken, INITIAL_BID_TOKEN_BALANCE, encryptedAuction, signers.dave, fhevm);
    });

    it("should allow valid bid placement and update state correctly", async function () {
      await time.increase(START_TIME);

      const tx = await placeBid(signers.bob, BID_PRICE, BID_AMOUNT);
      await tx.wait();

      await validateBid(signers.bob, BID_PRICE, BID_AMOUNT, 0n, INITIAL_BID_TOKEN_BALANCE - BID_PRICE * BID_AMOUNT);
    });

    it("should place multiple bids and update state correctly", async function () {
      await time.increase(START_TIME);

      (await placeBid(signers.bob, HIGH_PRICE, HIGH_AMOUNT)).wait();
      (await placeBid(signers.carol, MID_PRICE, MID_AMOUNT)).wait();
      (await placeBid(signers.dave, LOW_PRICE, LOW_AMOUNT)).wait();

      await validateBid(signers.bob, HIGH_PRICE, HIGH_AMOUNT, 0n, INITIAL_BID_TOKEN_BALANCE - HIGH_PRICE * HIGH_AMOUNT);
      await validateBid(signers.carol, MID_PRICE, MID_AMOUNT, 0n, INITIAL_BID_TOKEN_BALANCE - MID_PRICE * MID_AMOUNT);
      await validateBid(signers.dave, LOW_PRICE, LOW_AMOUNT, 0n, INITIAL_BID_TOKEN_BALANCE - LOW_PRICE * LOW_AMOUNT);
    });

    describe("Bid Input Validation", function () {
      it("should revert if auction has not started", async function () {
        await expect(placeBid(signers.bob, BID_PRICE, BID_AMOUNT)).to.be.revertedWithCustomError(
          encryptedAuction,
          "AuctionNotActive",
        );
      });

      it("should revert if auction has ended", async function () {
        await time.increase(POST_END_TIME);
        await expect(placeBid(signers.bob, BID_PRICE, BID_AMOUNT)).to.be.revertedWithCustomError(
          encryptedAuction,
          "AuctionNotActive",
        );
      });

      it("should fill bid with zeroes and not transact if not enough bid token approved", async function () {
        await time.increase(START_TIME);

        await bidToken.approveHelper(signers.bob, fhevm, encryptedAuction.getAddress(), BID_PRICE * BID_AMOUNT - 1n);

        await placeBid(signers.bob, BID_PRICE, BID_AMOUNT);

        await validateBid(signers.bob, BID_PRICE, 0n, 0n, INITIAL_BID_TOKEN_BALANCE);
      });

      it("should revert if bid amount is zero", async function () {
        await time.increase(START_TIME);

        await placeBid(signers.bob, BID_PRICE, 0n);

        await validateBid(signers.bob, BID_PRICE, 0n, 0n, INITIAL_BID_TOKEN_BALANCE);
      });

      it("should revert if bid price is below floor price", async function () {
        await time.increase(START_TIME);

        await placeBid(signers.bob, FLOOR_PRICE - 10n, BID_AMOUNT);

        await validateBid(signers.bob, FLOOR_PRICE - 10n, 0n, 0n, INITIAL_BID_TOKEN_BALANCE);
      });

      it("should revert if bidder has already placed a bid", async function () {
        await time.increase(START_TIME);

        await placeBid(signers.bob, BID_PRICE, BID_AMOUNT);
        await expect(placeBid(signers.bob, BID_PRICE + 10n, BID_AMOUNT)).to.be.revertedWithCustomError(
          encryptedAuction,
          "BidAlreadyPlaced",
        );
      });
    });
  });

  // Helper function to setup auction with multiple bids
  async function setupAuctionWithBids(bids: { signer: HardhatEthersSigner; price: bigint; amount: bigint }[]) {
    await setupTokensAndApprovals(auctionableToken, INITIAL_TOKEN_AMOUNT, encryptedAuction, signers.alice, fhevm);
    await stakeToken.mintHelper(signers.jane.address, STAKE_AMOUNT);
    await stakeToken.approveHelper(signers.jane, encryptedAuction.getAddress(), STAKE_AMOUNT);
    const tx = await createTestAuction(encryptedAuction, auctionableToken, bidToken, signers);
    await tx.wait();
    await time.increase(START_TIME);

    for (const bid of bids) {
      await setupTokensAndApprovals(bidToken, INITIAL_BID_TOKEN_BALANCE, encryptedAuction, bid.signer, fhevm);
      await placeBid(bid.signer, bid.price, bid.amount);
    }
  }

  async function validateProcessedBid(
    signer: HardhatEthersSigner,
    slidingSum: bigint,
    finalPrice: bigint,
    wonAmount: bigint,
  ) {
    const bidId = await encryptedAuction.bidId(signer.address);
    const auction = await encryptedAuction.auctionData();
    if (network.name === "hardhat") {
      expect(await debug.decrypt128(auction.slidingSum)).to.equal(slidingSum);
      expect(await debug.decrypt64(auction.finalPrice)).to.equal(finalPrice);
    }
    expect(auction.lastProcessedBidId).to.equal(bidId);

    const bid = await encryptedAuction.bids(bidId);
    expect(await reencryptEuint64(signer, fhevm, bid.wonAmount, await encryptedAuction.getAddress())).to.equal(
      wonAmount,
    );
  }

  async function processBid(signer: HardhatEthersSigner) {
    const bidId = await encryptedAuction.bidId(signer.address);
    await (await encryptedAuction.connect(signers.jane).processNextBid(bidId)).wait();
    await awaitAllDecryptionResults();
  }

  describe("Bid Processing", function () {
    beforeEach(async function () {
      await setupAuctionWithBids([
        { signer: signers.bob, price: HIGH_PRICE, amount: HIGH_AMOUNT },
        { signer: signers.carol, price: MID_PRICE, amount: MID_AMOUNT },
        { signer: signers.dave, price: LOW_PRICE, amount: LOW_AMOUNT },
      ]);
    });

    it("should process bids in descending price order and update state", async function () {
      await time.increase(POST_END_TIME);

      // Process highest bid
      await processBid(signers.bob);
      await validateProcessedBid(signers.bob, HIGH_AMOUNT, HIGH_PRICE, HIGH_AMOUNT);

      // Process medium bid
      await processBid(signers.carol);
      await validateProcessedBid(signers.carol, HIGH_AMOUNT + MID_AMOUNT, MID_PRICE, MID_AMOUNT);

      // Process lowest bid
      expect(INITIAL_TOKEN_AMOUNT - HIGH_AMOUNT - MID_AMOUNT).to.be.lessThan(LOW_AMOUNT);
      await processBid(signers.dave);
      await validateProcessedBid(
        signers.dave,
        HIGH_AMOUNT + MID_AMOUNT + LOW_AMOUNT,
        LOW_PRICE,
        INITIAL_TOKEN_AMOUNT - HIGH_AMOUNT - MID_AMOUNT,
      );

      const auction = await encryptedAuction.auctionData();
      expect(auction.processedBidIndex).to.equal(4);
    });

    describe("Processing Validation", function () {
      it("should revert if processing bid in wrong order", async function () {
        await time.increase(POST_END_TIME);

        const bidIds = {
          carol: await encryptedAuction.bidId(signers.carol.address),
          dave: await encryptedAuction.bidId(signers.dave.address),
        };

        await processBid(signers.dave);
        await validateProcessedBid(signers.dave, LOW_AMOUNT, LOW_PRICE, LOW_AMOUNT);

        await processBid(signers.carol);
        const auction = await encryptedAuction.auctionData();
        expect(auction.processedBidIndex).to.equal(2);
        expect(auction.lastProcessedBidId).to.equal(bidIds.dave);
        if (network.name === "hardhat") {
          expect(await debug.decrypt128(auction.slidingSum)).to.equal(LOW_AMOUNT);
          expect(await debug.decrypt64(auction.finalPrice)).to.equal(LOW_PRICE);
        }
        const bid = await encryptedAuction.bids(bidIds.carol);
        expect(
          await reencryptEuint64(signers.carol, fhevm, bid.wonAmount, await encryptedAuction.getAddress()),
        ).to.equal(0n);
      });
      it("should revert if auction is still active", async function () {
        const bobBidId = await encryptedAuction.bidId(signers.bob.address);
        await expect(encryptedAuction.connect(signers.jane).processNextBid(bobBidId)).to.be.revertedWithCustomError(
          encryptedAuction,
          "AuctionNotEnded",
        );
      });
      it("should revert if bid is already processed", async function () {
        await time.increase(POST_END_TIME);
        const bobBidId = await encryptedAuction.bidId(signers.bob.address);
        await processBid(signers.bob);
        await expect(encryptedAuction.connect(signers.jane).processNextBid(bobBidId)).to.be.revertedWithCustomError(
          encryptedAuction,
          "BidAlreadyPlaced",
        );
      });
      it("should revert if bid processed by wrong sequencer", async function () {
        await time.increase(POST_END_TIME);
        const bobBidId = await encryptedAuction.bidId(signers.bob.address);
        await expect(encryptedAuction.connect(signers.alice).processNextBid(bobBidId)).to.be.revertedWithCustomError(
          encryptedAuction,
          "UnauthorizedAccount",
        );
      });
    });
  });

  describe("Claiming", function () {
    async function verifyClaimResult(
      signer: Signers[keyof Signers],
      wonAmount: bigint,
      finalPrice: bigint,
      originalAmount: bigint,
    ) {
      const tx = await encryptedAuction.connect(signer).claim();
      await tx.wait();

      const isClaimed = await encryptedAuction.claimed(signer.address);
      expect(isClaimed).to.equal(true);

      const auctionableTokenBalance = await auctionableToken.contract.connect(signer).balanceOf(signer.address);
      expect(await reencryptEuint64(signer, fhevm, auctionableTokenBalance, auctionableToken.address)).to.equal(
        wonAmount,
      );

      const bidTokenBalance = await bidToken.contract.connect(signer).balanceOf(signer.address);
      expect(await reencryptEuint64(signer, fhevm, bidTokenBalance, bidToken.address)).to.equal(
        originalAmount - finalPrice * wonAmount,
      );
    }

    async function verifyOwnerClaimResult(
      signer: Signers[keyof Signers],
      originalAmount: bigint,
      soldAmount: bigint,
      finalPrice: bigint,
    ) {
      const tx = await encryptedAuction.connect(signer).claimOwner();
      await tx.wait();

      const isClaimed = await encryptedAuction.claimed(signer.address);
      expect(isClaimed).to.equal(true);

      const auctionableTokenBalance = await auctionableToken.contract.connect(signer).balanceOf(signer.address);
      expect(await reencryptEuint64(signer, fhevm, auctionableTokenBalance, auctionableToken.address)).to.equal(
        originalAmount - soldAmount,
      );

      const bidTokenBalance = await bidToken.contract.connect(signer).balanceOf(signer.address);
      expect(await reencryptEuint64(signer, fhevm, bidTokenBalance, bidToken.address)).to.equal(
        soldAmount * finalPrice,
      );
    }

    const CAROL_BID_AMOUNT = 70n;
    const FINAL_PRICE = 80n;

    it("should claim bid and refund the bid token excess", async function () {
      await setupAuctionWithBids([
        { signer: signers.bob, price: HIGH_PRICE, amount: HIGH_AMOUNT },
        { signer: signers.carol, price: FINAL_PRICE, amount: CAROL_BID_AMOUNT },
      ]);
      await time.increase(POST_END_TIME);

      // Process bob's bid
      await processBid(signers.bob);

      // Process carol's bid
      await processBid(signers.carol);

      await verifyClaimResult(signers.bob, HIGH_AMOUNT, FINAL_PRICE, INITIAL_BID_TOKEN_BALANCE);
      await verifyClaimResult(
        signers.carol,
        INITIAL_TOKEN_AMOUNT - HIGH_AMOUNT,
        FINAL_PRICE,
        INITIAL_BID_TOKEN_BALANCE,
      );

      await verifyOwnerClaimResult(signers.alice, INITIAL_TOKEN_AMOUNT, INITIAL_TOKEN_AMOUNT, FINAL_PRICE);
    });

    it("should refund creator if not enough tokens sold", async function () {
      await setupAuctionWithBids([
        { signer: signers.bob, price: HIGH_PRICE, amount: HIGH_AMOUNT },
        { signer: signers.carol, price: MID_PRICE, amount: MID_AMOUNT },
      ]);
      await time.increase(POST_END_TIME);

      // Process bob's bid
      await processBid(signers.bob);

      // Process carol's bid
      await processBid(signers.carol);

      await verifyClaimResult(signers.bob, HIGH_AMOUNT, MID_PRICE, INITIAL_BID_TOKEN_BALANCE);
      await verifyClaimResult(signers.carol, MID_AMOUNT, MID_PRICE, INITIAL_BID_TOKEN_BALANCE);
      await verifyOwnerClaimResult(signers.alice, INITIAL_TOKEN_AMOUNT, HIGH_AMOUNT + MID_AMOUNT, MID_PRICE);
    });

    it("should fully refund creator if no tokens sold", async function () {
      await setupAuctionWithBids([]);
      await time.increase(POST_END_TIME);

      await verifyOwnerClaimResult(signers.alice, INITIAL_TOKEN_AMOUNT, 0n, 0n);
    });

    it("should claim zero tokens if user didn't win", async function () {
      await setupAuctionWithBids([
        { signer: signers.bob, price: MID_PRICE, amount: HIGH_AMOUNT },
        { signer: signers.carol, price: LOW_PRICE, amount: INITIAL_TOKEN_AMOUNT - HIGH_AMOUNT },
        { signer: signers.dave, price: LOW_PRICE, amount: 40n },
      ]);
      await time.increase(POST_END_TIME);

      await processBid(signers.bob);
      await processBid(signers.carol);
      await processBid(signers.dave);

      await verifyClaimResult(signers.bob, HIGH_AMOUNT, LOW_PRICE, INITIAL_BID_TOKEN_BALANCE);
      await verifyClaimResult(signers.carol, INITIAL_TOKEN_AMOUNT - HIGH_AMOUNT, LOW_PRICE, INITIAL_BID_TOKEN_BALANCE);
      await verifyClaimResult(signers.dave, 0n, LOW_PRICE, INITIAL_BID_TOKEN_BALANCE);
    });

    describe("Claim Validation", function () {
      it("should throw if called before auction end", async function () {
        await setupAuctionWithBids([
          { signer: signers.bob, price: HIGH_PRICE, amount: HIGH_AMOUNT },
          { signer: signers.carol, price: FINAL_PRICE, amount: CAROL_BID_AMOUNT },
        ]);

        await expect(encryptedAuction.connect(signers.bob).claim()).to.be.revertedWithCustomError(
          encryptedAuction,
          "AuctionNotEnded",
        );
        await expect(encryptedAuction.connect(signers.alice).claimOwner()).to.be.revertedWithCustomError(
          encryptedAuction,
          "AuctionNotEnded",
        );
      });
      it("should not claim if all bids are not processed", async function () {
        await setupAuctionWithBids([
          { signer: signers.bob, price: HIGH_PRICE, amount: HIGH_AMOUNT },
          { signer: signers.carol, price: FINAL_PRICE, amount: CAROL_BID_AMOUNT },
        ]);
        await time.increase(POST_END_TIME);
        // Process bob's bid
        await processBid(signers.bob);

        await expect(encryptedAuction.connect(signers.bob).claim()).to.be.revertedWithCustomError(
          encryptedAuction,
          "AuctionNotProcessed",
        );
        await expect(encryptedAuction.connect(signers.alice).claimOwner()).to.be.revertedWithCustomError(
          encryptedAuction,
          "AuctionNotProcessed",
        );
      });

      it("should not claim if already claimed", async function () {
        await setupAuctionWithBids([
          { signer: signers.bob, price: HIGH_PRICE, amount: HIGH_AMOUNT },
          { signer: signers.carol, price: FINAL_PRICE, amount: CAROL_BID_AMOUNT },
        ]);
        await time.increase(POST_END_TIME);

        // Process bob's bid
        await processBid(signers.bob);

        // Process carol's bid
        await processBid(signers.carol);

        await (await encryptedAuction.connect(signers.bob).claim()).wait();

        await expect(encryptedAuction.connect(signers.bob).claim()).to.be.revertedWithCustomError(
          encryptedAuction,
          "AlreadyClaimed",
        );

        await (await encryptedAuction.connect(signers.alice).claimOwner()).wait();

        await expect(encryptedAuction.connect(signers.alice).claimOwner()).to.be.revertedWithCustomError(
          encryptedAuction,
          "AlreadyClaimed",
        );
      });
      it("should throw if no bid placed", async function () {
        await setupAuctionWithBids([]);
        await time.increase(POST_END_TIME);

        expect(verifyClaimResult(signers.bob, 0n, 0n, INITIAL_BID_TOKEN_BALANCE)).to.be.revertedWith(
          "sender isn't allowed",
        );
      });
      it("should throw if claimOwner is called by non-creator", async function () {
        await setupAuctionWithBids([
          { signer: signers.bob, price: HIGH_PRICE, amount: HIGH_AMOUNT },
          { signer: signers.carol, price: FINAL_PRICE, amount: CAROL_BID_AMOUNT },
        ]);
        await time.increase(POST_END_TIME);

        // Process bob's bid
        await processBid(signers.bob);

        // Process carol's bid
        await processBid(signers.carol);

        await expect(encryptedAuction.connect(signers.bob).claimOwner()).to.be.revertedWithCustomError(
          encryptedAuction,
          "UnauthorizedAccount",
        );
      });
    });
  });
});
