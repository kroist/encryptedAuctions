import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { reset, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import type { PublicAuction } from "../../types";
import { Signers, getSigners, initSigners } from "../signers";
import { deployPublicAuctionFixture } from "./PublicAuction.fixture";
import { PublicERC20Fixture, deployPublicERC20Fixture } from "./PublicERC20.fixture";

// Test constants
const INITIAL_TOKEN_AMOUNT = 100n;
const FLOOR_PRICE = 50n;
// One hour from now
const START_TIME = BigInt(Math.floor(Date.now() / 1000) + 3600);
// Two hours from now
const END_TIME = BigInt(Math.floor(Date.now() / 1000) + 7200);
// After end time
const POST_END_TIME = END_TIME + 60n; // 1 minute after end
const BID_AMOUNT = 10n;
const BID_PRICE = 60n;
const INITIAL_BID_TOKEN_BALANCE = 600n;

// Bid processing constants
const HIGH_PRICE = 100n;
const MID_PRICE = 90n;
const LOW_PRICE = 80n;
const HIGH_AMOUNT = 40n;
const MID_AMOUNT = 30n;
const LOW_AMOUNT = 50n;

describe("PublicAuction", function () {
  // Helper function to setup tokens and approvals
  async function setupTokensAndApprovals(
    auctionableToken: PublicERC20Fixture,
    bidToken: PublicERC20Fixture,
    publicAuction: PublicAuction,
    signers: Signers,
  ) {
    await auctionableToken.mintHelper(signers.alice.address, INITIAL_TOKEN_AMOUNT);
    await auctionableToken.approveHelper(signers.alice, publicAuction.getAddress(), INITIAL_TOKEN_AMOUNT);
  }

  // Helper function to create auction
  async function createTestAuction(
    publicAuction: PublicAuction,
    auctionableToken: PublicERC20Fixture,
    bidToken: PublicERC20Fixture,
    signers: Signers,
  ) {
    return publicAuction.createAuction(
      auctionableToken.address,
      INITIAL_TOKEN_AMOUNT,
      bidToken.address,
      signers.alice.address,
      FLOOR_PRICE,
      START_TIME,
      END_TIME,
    );
  }

  let publicAuction: PublicAuction;
  let signers: Signers;
  let auctionableToken: PublicERC20Fixture;
  let bidToken: PublicERC20Fixture;

  before(async function () {
    await initSigners();
    signers = await getSigners();
  });

  beforeEach(async function () {
    await reset();
    publicAuction = await deployPublicAuctionFixture();
    auctionableToken = await deployPublicERC20Fixture("AuctionableToken", "AT");
    bidToken = await deployPublicERC20Fixture("BidToken", "BT");
  });

  describe("Auction Creation", function () {
    beforeEach(async function () {
      await setupTokensAndApprovals(auctionableToken, bidToken, publicAuction, signers);
    });

    it("should initialize auction with correct parameters and emit event", async function () {
      const tx = await createTestAuction(publicAuction, auctionableToken, bidToken, signers);
      await tx.wait();

      // Verify event emission
      const auctionEvent = await publicAuction.queryFilter(publicAuction.filters.AuctionCreated());
      expect(auctionEvent.length).to.equal(1);

      // Verify auction data
      const auction = await publicAuction.auctionData();
      expect(auction).to.deep.equal([
        auctionableToken.address,
        INITIAL_TOKEN_AMOUNT,
        bidToken.address,
        signers.alice.address,
        FLOOR_PRICE,
        START_TIME,
        END_TIME,
        1n,
        1n,
        0n,
        0n,
        0n,
        signers.alice.address,
      ]);
    });
  });

  describe("Bid Placement", function () {
    async function setupBidder() {
      await bidToken.mintHelper(signers.bob.address, INITIAL_BID_TOKEN_BALANCE);
      await bidToken.approveHelper(signers.bob, publicAuction.getAddress(), INITIAL_BID_TOKEN_BALANCE);
    }

    beforeEach(async function () {
      await setupTokensAndApprovals(auctionableToken, bidToken, publicAuction, signers);
      const tx = await createTestAuction(publicAuction, auctionableToken, bidToken, signers);
      await tx.wait();
      await setupBidder();
    });

    it("should allow valid bid placement and update state correctly", async function () {
      await time.increaseTo(START_TIME);
      const tx = await publicAuction.connect(signers.bob).placeBid(BID_PRICE, BID_AMOUNT);
      await tx.wait();

      const bidId = await publicAuction.bidId(signers.bob.address);
      expect(bidId).to.equal(1n);

      const bid = await publicAuction.bids(bidId);
      expect(bid).to.deep.equal([BID_PRICE, BID_AMOUNT, 0n]);

      const bobBidTokenBalance = await bidToken.contract.balanceOf(signers.bob.address);
      expect(bobBidTokenBalance).to.equal(0n);
    });

    describe("Bid Validation", function () {
      it("should revert if not enough bid token approved", async function () {
        await time.increaseTo(START_TIME);
        await bidToken.approveHelper(signers.bob, publicAuction.getAddress(), BID_PRICE * BID_AMOUNT - 1n);
        await expect(publicAuction.connect(signers.bob).placeBid(BID_PRICE, BID_AMOUNT)).to.be.revertedWithCustomError(
          bidToken.contract,
          "ERC20InsufficientAllowance",
        );
      });

      it("should revert if auction has not started", async function () {
        await expect(publicAuction.connect(signers.bob).placeBid(BID_PRICE, BID_AMOUNT)).to.be.revertedWithCustomError(
          publicAuction,
          "AuctionNotActive",
        );
      });

      it("should revert if auction has ended", async function () {
        await time.increaseTo(POST_END_TIME);
        await expect(publicAuction.connect(signers.bob).placeBid(BID_PRICE, BID_AMOUNT)).to.be.revertedWithCustomError(
          publicAuction,
          "AuctionNotActive",
        );
      });

      it("should revert if bid amount is zero", async function () {
        await time.increaseTo(START_TIME);
        await expect(publicAuction.connect(signers.bob).placeBid(BID_PRICE, 0n)).to.be.revertedWithCustomError(
          publicAuction,
          "BidZeroAmount",
        );
      });

      it("should revert if bid price is below floor price", async function () {
        await time.increaseTo(START_TIME);
        await expect(
          publicAuction.connect(signers.bob).placeBid(FLOOR_PRICE - 10n, BID_AMOUNT),
        ).to.be.revertedWithCustomError(publicAuction, "BidNotHighEnough");
      });

      it("should revert if bidder has already placed a bid", async function () {
        await time.increaseTo(START_TIME);
        const tx = await publicAuction.connect(signers.bob).placeBid(BID_PRICE, BID_AMOUNT);
        await tx.wait();
        await expect(
          publicAuction.connect(signers.bob).placeBid(BID_PRICE + 10n, BID_AMOUNT),
        ).to.be.revertedWithCustomError(publicAuction, "BidAlreadyPlaced");
      });
    });
  });

  // Helper function to setup a bidder with tokens and approvals
  async function setupBidder(signer: Signers[keyof Signers], price: bigint, amount: bigint) {
    await bidToken.mintHelper(signer.address, price * amount);
    await bidToken.approveHelper(signer, publicAuction.getAddress(), price * amount);
    const bid = await publicAuction.connect(signer).placeBid(price, amount);
    await bid.wait();
  }

  // Helper function to setup auction with multiple bids
  async function setupAuctionWithBids(bids: { singer: HardhatEthersSigner; price: bigint; amount: bigint }[]) {
    await setupTokensAndApprovals(auctionableToken, bidToken, publicAuction, signers);
    const tx = await createTestAuction(publicAuction, auctionableToken, bidToken, signers);
    await tx.wait();
    await time.increaseTo(START_TIME);

    for (const bid of bids) {
      await setupBidder(bid.singer, bid.price, bid.amount);
    }
  }

  describe("Bid Processing", function () {
    beforeEach(async function () {
      await setupAuctionWithBids([
        { singer: signers.bob, price: HIGH_PRICE, amount: HIGH_AMOUNT },
        { singer: signers.carol, price: MID_PRICE, amount: MID_AMOUNT },
        { singer: signers.dave, price: LOW_PRICE, amount: LOW_AMOUNT },
      ]);
    });

    it("should process bids in descending price order and update state", async function () {
      await time.increaseTo(POST_END_TIME);

      const bidIds = {
        bob: await publicAuction.bidId(signers.bob.address),
        carol: await publicAuction.bidId(signers.carol.address),
        dave: await publicAuction.bidId(signers.dave.address),
      };

      // Process highest bid
      await (await publicAuction.processNextBid(bidIds.bob)).wait();
      let auction = await publicAuction.auctionData();
      expect(auction.slidingSum).to.equal(HIGH_AMOUNT);
      let bid = await publicAuction.bids(auction.lastProcessedBidId);
      expect(bid.price).to.equal(HIGH_PRICE);

      // Process medium bid
      await (await publicAuction.processNextBid(bidIds.carol)).wait();
      auction = await publicAuction.auctionData();
      expect(auction.slidingSum).to.equal(HIGH_AMOUNT + MID_AMOUNT);
      bid = await publicAuction.bids(auction.lastProcessedBidId);
      expect(bid.price).to.equal(MID_PRICE);

      // Process lowest bid
      await (await publicAuction.processNextBid(bidIds.dave)).wait();
      auction = await publicAuction.auctionData();
      expect(auction.slidingSum).to.equal(HIGH_AMOUNT + MID_AMOUNT + LOW_AMOUNT);
      bid = await publicAuction.bids(auction.lastProcessedBidId);
      expect(bid.price).to.equal(LOW_PRICE);
    });

    describe("Processing Validation", function () {
      it("should revert if processing bid in wrong order", async function () {
        await time.increaseTo(POST_END_TIME);

        const bidIds = {
          dave: await publicAuction.bidId(signers.dave.address),
          carol: await publicAuction.bidId(signers.carol.address),
        };

        await (await publicAuction.processNextBid(bidIds.dave)).wait();

        await expect(publicAuction.processNextBid(bidIds.carol)).to.be.revertedWithCustomError(
          publicAuction,
          "WrongBidOrder",
        );
      });

      it("should revert if auction is still active", async function () {
        const bobBidId = await publicAuction.bidId(signers.bob.address);
        await expect(publicAuction.processNextBid(bobBidId)).to.be.revertedWithCustomError(
          publicAuction,
          "AuctionNotEnded",
        );
      });

      it("should revert if bid is already processed", async function () {
        await time.increaseTo(POST_END_TIME);
        const bobBidId = await publicAuction.bidId(signers.bob.address);

        await (await publicAuction.processNextBid(bobBidId)).wait();

        await expect(publicAuction.processNextBid(bobBidId)).to.be.revertedWithCustomError(
          publicAuction,
          "BidAlreadyPlaced",
        );
      });
    });
  });

  describe("Bid Processing: Sliding Sum", function () {
    async function setupAndProcessBids(inputs: { singer: HardhatEthersSigner; price: bigint; amount: bigint }[]) {
      await setupAuctionWithBids(inputs);
      await time.increaseTo(POST_END_TIME);

      const bidIds = {
        bob: await publicAuction.bidId(signers.bob.address),
        carol: await publicAuction.bidId(signers.carol.address),
        dave: await publicAuction.bidId(signers.dave.address),
      };

      // Process all bids
      await (await publicAuction.processNextBid(bidIds.bob)).wait();
      await (await publicAuction.processNextBid(bidIds.carol)).wait();
      await (await publicAuction.processNextBid(bidIds.dave)).wait();

      return bidIds;
    }

    it("should correctly set won amounts and final price", async function () {
      const bidIds = await setupAndProcessBids([
        { singer: signers.bob, price: HIGH_PRICE, amount: HIGH_AMOUNT },
        { singer: signers.carol, price: MID_PRICE, amount: MID_AMOUNT },
        { singer: signers.dave, price: LOW_PRICE, amount: LOW_AMOUNT },
      ]);
      const [bobBid, carolBid, daveBid] = await Promise.all([
        publicAuction.bids(bidIds.bob),
        publicAuction.bids(bidIds.carol),
        publicAuction.bids(bidIds.dave),
      ]);

      expect(bobBid.wonAmount).to.equal(HIGH_AMOUNT);
      expect(carolBid.wonAmount).to.equal(MID_AMOUNT);
      expect(daveBid.wonAmount).to.equal(INITIAL_TOKEN_AMOUNT - HIGH_AMOUNT - MID_AMOUNT);

      const auction = await publicAuction.auctionData();
      expect(auction.finalPrice).to.equal(LOW_PRICE);
    });

    it("should correctly set won amounts 2", async function () {
      const bidIds = await setupAndProcessBids([
        { singer: signers.bob, price: HIGH_PRICE, amount: HIGH_AMOUNT },
        { singer: signers.carol, price: MID_PRICE, amount: INITIAL_TOKEN_AMOUNT - HIGH_AMOUNT },
        { singer: signers.dave, price: LOW_PRICE, amount: LOW_AMOUNT },
      ]);
      const [bobBid, carolBid, daveBid] = await Promise.all([
        publicAuction.bids(bidIds.bob),
        publicAuction.bids(bidIds.carol),
        publicAuction.bids(bidIds.dave),
      ]);

      expect(bobBid.wonAmount).to.equal(HIGH_AMOUNT);
      expect(carolBid.wonAmount).to.equal(INITIAL_TOKEN_AMOUNT - HIGH_AMOUNT);
      expect(daveBid.wonAmount).to.equal(0n);

      const auction = await publicAuction.auctionData();
      expect(auction.finalPrice).to.equal(MID_PRICE);
    });
  });

  describe("Claiming", function () {
    const CAROL_BID_AMOUNT = 70n;
    const FINAL_PRICE = 80n;

    async function setupClaimingTest(finalPrice: bigint, carolAmount: bigint) {
      await setupTokensAndApprovals(auctionableToken, bidToken, publicAuction, signers);
      const tx = await createTestAuction(publicAuction, auctionableToken, bidToken, signers);
      await tx.wait();
      await time.increaseTo(START_TIME);

      // Setup bidders
      await setupBidder(signers.bob, HIGH_PRICE, HIGH_AMOUNT);
      await setupBidder(signers.carol, finalPrice, carolAmount);
    }

    async function processBids() {
      const bidIds = {
        bob: await publicAuction.bidId(signers.bob.address),
        carol: await publicAuction.bidId(signers.carol.address),
      };

      await (await publicAuction.processNextBid(bidIds.bob)).wait();
      await (await publicAuction.processNextBid(bidIds.carol)).wait();

      return bidIds;
    }

    async function verifyClaimResult(
      signer: Signers[keyof Signers],
      wonAmount: bigint,
      originalPrice: bigint,
      originalAmount: bigint,
    ) {
      const tx = await publicAuction.connect(signer).claim();
      await tx.wait();

      const isClaimed = await publicAuction.claimed(signer.address);
      expect(isClaimed).to.equal(true);

      const auctionableTokenBalance = await auctionableToken.contract.balanceOf(signer.address);
      expect(auctionableTokenBalance).to.equal(wonAmount);

      const bidTokenBalance = await bidToken.contract.balanceOf(signer.address);
      expect(bidTokenBalance).to.equal(originalPrice * originalAmount - FINAL_PRICE * wonAmount);
    }

    beforeEach(async function () {
      await setupClaimingTest(FINAL_PRICE, CAROL_BID_AMOUNT);
    });

    it("should claim bid and refund the bid token excess", async function () {
      await time.increaseTo(POST_END_TIME);
      await processBids();

      await verifyClaimResult(signers.bob, HIGH_AMOUNT, HIGH_PRICE, HIGH_AMOUNT);
      await verifyClaimResult(signers.carol, INITIAL_TOKEN_AMOUNT - HIGH_AMOUNT, FINAL_PRICE, CAROL_BID_AMOUNT);
    });

    describe("Claim Validation", function () {
      it("should not claim if all bids are not processed", async function () {
        await time.increaseTo(POST_END_TIME);
        const bobBidId = await publicAuction.bidId(signers.bob.address);
        await (await publicAuction.processNextBid(bobBidId)).wait();

        await expect(publicAuction.connect(signers.bob).claim()).to.be.revertedWithCustomError(
          publicAuction,
          "AuctionNotProcessed",
        );
      });

      it("should not claim if already claimed", async function () {
        await time.increaseTo(POST_END_TIME);
        await processBids();

        await (await publicAuction.connect(signers.bob).claim()).wait();

        await expect(publicAuction.connect(signers.bob).claim()).to.be.revertedWithCustomError(
          publicAuction,
          "AlreadyClaimed",
        );
      });
    });
  });

  describe("Owner Claiming", function () {
    const CAROL_BID_AMOUNT = 70n;
    const FINAL_PRICE = 80n;

    async function setupOwnerClaimingTest(finalPrice: bigint, carolAmount: bigint) {
      await setupTokensAndApprovals(auctionableToken, bidToken, publicAuction, signers);
      const tx = await createTestAuction(publicAuction, auctionableToken, bidToken, signers);
      await tx.wait();
      await time.increaseTo(START_TIME);

      // Setup bidders
      await setupBidder(signers.bob, HIGH_PRICE, HIGH_AMOUNT);
      await setupBidder(signers.carol, finalPrice, carolAmount);
    }

    async function processBids() {
      const bidIds = {
        bob: await publicAuction.bidId(signers.bob.address),
        carol: await publicAuction.bidId(signers.carol.address),
      };

      await (await publicAuction.processNextBid(bidIds.bob)).wait();
      await (await publicAuction.processNextBid(bidIds.carol)).wait();

      return bidIds;
    }

    it("should allow owner to claim bid tokens when all tokens are sold", async function () {
      await setupOwnerClaimingTest(FINAL_PRICE, CAROL_BID_AMOUNT);
      await time.increaseTo(POST_END_TIME);
      await processBids();

      const tx = await publicAuction.connect(signers.alice).claimOwner();
      await tx.wait();

      const isClaimed = await publicAuction.claimed(signers.alice.address);
      expect(isClaimed).to.equal(true);

      // Owner should receive bid tokens for all sold tokens
      const ownerBidTokenBalance = await bidToken.contract.balanceOf(signers.alice.address);
      expect(ownerBidTokenBalance).to.equal(INITIAL_TOKEN_AMOUNT * FINAL_PRICE);

      // Owner should not receive any auctionable tokens back since all were sold
      const ownerAuctionableTokenBalance = await auctionableToken.contract.balanceOf(signers.alice.address);
      expect(ownerAuctionableTokenBalance).to.equal(0n);
    });

    it("should allow owner to claim remaining tokens and bid tokens when not all tokens are sold", async function () {
      // Setup auction with bids that don't cover all tokens
      const PARTIAL_AMOUNT = INITIAL_TOKEN_AMOUNT / 2n;
      await setupOwnerClaimingTest(FINAL_PRICE, PARTIAL_AMOUNT - HIGH_AMOUNT);

      await time.increaseTo(POST_END_TIME);
      await processBids();

      const tx = await publicAuction.connect(signers.alice).claimOwner();
      await tx.wait();

      const isClaimed = await publicAuction.claimed(signers.alice.address);
      expect(isClaimed).to.equal(true);

      // Owner should receive bid tokens for sold tokens
      const ownerBidTokenBalance = await bidToken.contract.balanceOf(signers.alice.address);
      expect(ownerBidTokenBalance).to.equal(PARTIAL_AMOUNT * FINAL_PRICE);

      // Owner should receive unsold tokens back
      const ownerAuctionableTokenBalance = await auctionableToken.contract.balanceOf(signers.alice.address);
      expect(ownerAuctionableTokenBalance).to.equal(INITIAL_TOKEN_AMOUNT - PARTIAL_AMOUNT);
    });

    describe("Owner Claim Validation", function () {
      this.beforeEach(async function () {
        await setupOwnerClaimingTest(FINAL_PRICE, CAROL_BID_AMOUNT);
      });
      it("should not claim if auction is not processed", async function () {
        await time.increaseTo(POST_END_TIME);
        const bobBidId = await publicAuction.bidId(signers.bob.address);
        await (await publicAuction.processNextBid(bobBidId)).wait();

        await expect(publicAuction.connect(signers.alice).claimOwner()).to.be.revertedWithCustomError(
          publicAuction,
          "AuctionNotProcessed",
        );
      });

      it("should not claim if auction has not ended", async function () {
        await expect(publicAuction.connect(signers.alice).claimOwner()).to.be.revertedWithCustomError(
          publicAuction,
          "AuctionNotEnded",
        );
      });

      it("should not claim if already claimed", async function () {
        await time.increaseTo(POST_END_TIME);
        await processBids();

        await (await publicAuction.connect(signers.alice).claimOwner()).wait();

        await expect(publicAuction.connect(signers.alice).claimOwner()).to.be.revertedWithCustomError(
          publicAuction,
          "AlreadyClaimed",
        );
      });
    });
  });
});
