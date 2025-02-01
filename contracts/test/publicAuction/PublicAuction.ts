import { mine, reset } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

import type { PublicAuction } from "../../types";
import { Signers, getSigners, initSigners } from "../signers";
import { deployPublicAuctionFixture } from "./PublicAuction.fixture";
import { PublicERC20Fixture, deployPublicERC20Fixture } from "./PublicERC20.fixture";

describe("PublicAuction", function () {
  let publicAuction: PublicAuction;
  let signers: Signers;
  let auctionableToken: PublicERC20Fixture;
  let bidToken: PublicERC20Fixture;

  before(async function () {
    await initSigners();
    signers = await getSigners();
  });

  beforeEach(async function () {
    reset();
    const contract = await deployPublicAuctionFixture();
    auctionableToken = await deployPublicERC20Fixture("AuctionableToken", "AT");
    bidToken = await deployPublicERC20Fixture("BidToken", "BT");
    publicAuction = contract;
  });

  describe("Auction Creation", function () {
    beforeEach(async function () {
      await auctionableToken.mintHelper(signers.alice.address, 100n);
      await auctionableToken.approveHelper(signers.alice, publicAuction.getAddress(), 100n);
    });

    it("should create an auction with correct parameters", async function () {
      const transaction = await publicAuction.createAuction(
        auctionableToken.address,
        100n,
        bidToken.address,
        signers.alice.address,
        1n,
        50n,
        200n,
      );

      await transaction.wait();

      const auctionEvent = await publicAuction.queryFilter(publicAuction.filters.AuctionCreated());
      expect(auctionEvent.length).to.equal(1);

      const auctionId = auctionEvent[0].args[0];

      const auction = await publicAuction.auctions(auctionId);

      expect(auction.token).to.equal(auctionableToken.address);
      expect(auction.tokenAmount).to.equal(100n);
      expect(auction.bidToken).to.equal(bidToken.address);
      expect(auction.bidSequencer).to.equal(signers.alice.address);
      expect(auction.floorPrice).to.equal(1n);
      expect(auction.startBlock).to.equal(50n);
      expect(auction.endBlock).to.equal(200n);
      expect(auction.bidIndex).to.equal(1n);
      expect(auction.processedBidIndex).to.equal(1n);
      expect(auction.slidingSum).to.equal(0n);
      expect(auction.lastProcessedBidId).to.equal(0n);
      expect(auction.lastProcessedBidPrice).to.equal(0n);
      expect(auction.finalPrice).to.equal(0n);
    });

    it("should increment auction index after creation", async function () {
      const initialIndex = await publicAuction.auctionIndex();

      const tx = await publicAuction.createAuction(
        auctionableToken.address,
        100n,
        bidToken.address,
        signers.alice.address,
        1n,
        50n,
        200n,
      );
      await tx.wait();

      const newIndex = await publicAuction.auctionIndex();
      expect(newIndex).to.equal(initialIndex + 1n);
    });
  });

  describe("Bid Placement", function () {
    let auctionId: bigint;

    beforeEach(async function () {
      await auctionableToken.mintHelper(signers.alice.address, 100n);
      await auctionableToken.approveHelper(signers.alice, publicAuction.getAddress(), 100n);
      const tx = await publicAuction.createAuction(
        auctionableToken.address,
        100n,
        bidToken.address,
        signers.alice.address,
        50n, // floor price
        50n, // start block
        200n, // end block
      );
      await tx.wait();
      const event = await publicAuction.queryFilter(publicAuction.filters.AuctionCreated());
      auctionId = event[0].args[0];

      await bidToken.mintHelper(signers.bob.address, 600n);
      await bidToken.approveHelper(signers.bob, publicAuction.getAddress(), 600n);
    });

    it("should allow valid bid placement", async function () {
      await mine(50); // Move to start block
      const tx = await publicAuction.connect(signers.bob).placeBid(auctionId, 60n, 10n);
      await tx.wait();

      const bidId = await publicAuction.bidId(auctionId, signers.bob.address);
      expect(bidId).to.equal(1n);

      const bid = await publicAuction.bids(auctionId, bidId);
      expect(bid.price).to.equal(60n);
      expect(bid.amount).to.equal(10n);
      expect(bid.wonAmount).to.equal(0n);

      const bobBidTokenBalance = await bidToken.contract.balanceOf(signers.bob.address);

      expect(bobBidTokenBalance).to.equal(0n);
    });

    it("should revert if not enough bid token approved", async function () {
      await mine(50); // Move to start block
      await bidToken.approveHelper(signers.bob, publicAuction.getAddress(), 599n);
      await expect(publicAuction.connect(signers.bob).placeBid(auctionId, 60n, 10n)).to.be.revertedWithCustomError(
        bidToken.contract,
        "ERC20InsufficientAllowance",
      );
    });

    it("should revert if auction has not started", async function () {
      await expect(publicAuction.connect(signers.bob).placeBid(auctionId, 60n, 10n)).to.be.revertedWithCustomError(
        publicAuction,
        "AuctionNotStarted",
      );
    });

    it("should revert if auction has ended", async function () {
      await mine(201); // Move past end block
      await expect(publicAuction.connect(signers.bob).placeBid(auctionId, 60n, 10n)).to.be.revertedWithCustomError(
        publicAuction,
        "AuctionEnded",
      );
    });

    it("should revert if bid amount is zero", async function () {
      await mine(50);
      await expect(publicAuction.connect(signers.bob).placeBid(auctionId, 60n, 0n)).to.be.revertedWithCustomError(
        publicAuction,
        "BidZeroAmount",
      );
    });

    it("should revert if bid price is below floor price", async function () {
      await mine(50);
      await expect(publicAuction.connect(signers.bob).placeBid(auctionId, 40n, 10n)).to.be.revertedWithCustomError(
        publicAuction,
        "BidNotHighEnough",
      );
    });

    it("should revert if bidder has already placed a bid", async function () {
      await mine(50);
      const tx = await publicAuction.connect(signers.bob).placeBid(auctionId, 60n, 10n);
      await tx.wait();
      await expect(publicAuction.connect(signers.bob).placeBid(auctionId, 70n, 10n)).to.be.revertedWithCustomError(
        publicAuction,
        "BidAlreadyPlaced",
      );
    });
  });

  describe("Bid Processing", function () {
    let auctionId: bigint;

    beforeEach(async function () {
      await auctionableToken.mintHelper(signers.alice.address, 100n);
      await auctionableToken.approveHelper(signers.alice, publicAuction.getAddress(), 100n);

      const tx = await publicAuction.createAuction(
        auctionableToken.address,
        100n,
        bidToken.address,
        signers.alice.address,
        50n,
        50n,
        200n,
      );
      await tx.wait();
      const event = await publicAuction.queryFilter(publicAuction.filters.AuctionCreated());
      auctionId = event[0].args[0];

      await mine(50);

      // Place multiple bids
      await bidToken.mintHelper(signers.bob.address, 100n * 40n);
      await bidToken.approveHelper(signers.bob, publicAuction.getAddress(), 100n * 40n);
      const bid1 = await publicAuction.connect(signers.bob).placeBid(auctionId, 100n, 40n);
      await bid1.wait();

      await bidToken.mintHelper(signers.carol.address, 90n * 30n);
      await bidToken.approveHelper(signers.carol, publicAuction.getAddress(), 90n * 30n);
      const bid2 = await publicAuction.connect(signers.carol).placeBid(auctionId, 90n, 30n);
      await bid2.wait();

      await bidToken.mintHelper(signers.dave.address, 80n * 50n);
      await bidToken.approveHelper(signers.dave, publicAuction.getAddress(), 80n * 50n);
      const bid3 = await publicAuction.connect(signers.dave).placeBid(auctionId, 80n, 50n);
      await bid3.wait();
    });

    it("should process bids in correct order", async function () {
      await mine(201); // Move past end block

      const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
      const carolBidId = await publicAuction.bidId(auctionId, signers.carol.address);
      const daveBidId = await publicAuction.bidId(auctionId, signers.dave.address);

      // Process highest bid first
      const tx1 = await publicAuction.processNextBid(auctionId, bobBidId);
      await tx1.wait();
      let auction = await publicAuction.auctions(auctionId);
      expect(auction.slidingSum).to.equal(40n);
      expect(auction.lastProcessedBidPrice).to.equal(100n);

      // Process second highest bid
      const tx2 = await publicAuction.processNextBid(auctionId, carolBidId);
      await tx2.wait();
      auction = await publicAuction.auctions(auctionId);
      expect(auction.slidingSum).to.equal(70n);
      expect(auction.lastProcessedBidPrice).to.equal(90n);

      // Process lowest bid
      const tx3 = await publicAuction.processNextBid(auctionId, daveBidId);
      await tx3.wait();
      auction = await publicAuction.auctions(auctionId);
      expect(auction.slidingSum).to.equal(120n);
      expect(auction.lastProcessedBidPrice).to.equal(80n);
    });

    it("should revert if processing bid in wrong order", async function () {
      await mine(201); // Move past end block

      const daveBidId = await publicAuction.bidId(auctionId, signers.dave.address);

      const carolBidId = await publicAuction.bidId(auctionId, signers.carol.address);

      // Process lowest bid
      const tx1 = await publicAuction.processNextBid(auctionId, daveBidId);
      await tx1.wait();

      // Process second highest bid
      await expect(publicAuction.processNextBid(auctionId, carolBidId)).to.be.revertedWithCustomError(
        publicAuction,
        "WrongBidOrder",
      );
    });

    it("should revert if auction is still active", async function () {
      const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
      await expect(publicAuction.processNextBid(auctionId, bobBidId)).to.be.revertedWithCustomError(
        publicAuction,
        "AuctionActive",
      );
    });

    it("should revert if bid is already processed", async function () {
      await mine(201); // Move past end block

      const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
      const tx = await publicAuction.processNextBid(auctionId, bobBidId);
      await tx.wait();

      await expect(publicAuction.processNextBid(auctionId, bobBidId)).to.be.revertedWithCustomError(
        publicAuction,
        "BidAlreadyPlaced",
      );
    });
  });

  describe("Bid Processing: Sliding Sum", function () {
    let auctionId: bigint;

    beforeEach(async function () {
      await auctionableToken.mintHelper(signers.alice.address, 100n);
      await auctionableToken.approveHelper(signers.alice, publicAuction.getAddress(), 100n);
      const tx = await publicAuction.createAuction(
        auctionableToken.address,
        100n,
        bidToken.address,
        signers.alice.address,
        50n,
        50n,
        200n,
      );
      await tx.wait();
      const event = await publicAuction.queryFilter(publicAuction.filters.AuctionCreated());
      auctionId = event[0].args[0];

      await mine(50);
    });

    it("should correctly set exact won amount when crossing token amount threshold", async function () {
      // Place multiple bids
      await bidToken.mintHelper(signers.bob.address, 100n * 40n);
      await bidToken.approveHelper(signers.bob, publicAuction.getAddress(), 100n * 40n);
      const bid1 = await publicAuction.connect(signers.bob).placeBid(auctionId, 100n, 40n);
      await bid1.wait();

      await bidToken.mintHelper(signers.carol.address, 90n * 60n);
      await bidToken.approveHelper(signers.carol, publicAuction.getAddress(), 90n * 60n);
      const bid2 = await publicAuction.connect(signers.carol).placeBid(auctionId, 90n, 60n);
      await bid2.wait();

      await bidToken.mintHelper(signers.dave.address, 80n * 50n);
      await bidToken.approveHelper(signers.dave, publicAuction.getAddress(), 80n * 50n);
      const bid3 = await publicAuction.connect(signers.dave).placeBid(auctionId, 80n, 50n);
      await bid3.wait();

      await mine(201); // Move past end block

      const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
      const carolBidId = await publicAuction.bidId(auctionId, signers.carol.address);
      const daveBidId = await publicAuction.bidId(auctionId, signers.dave.address);

      const tx1 = await publicAuction.processNextBid(auctionId, bobBidId);
      await tx1.wait();
      const tx2 = await publicAuction.processNextBid(auctionId, carolBidId);
      await tx2.wait();
      const tx3 = await publicAuction.processNextBid(auctionId, daveBidId);
      await tx3.wait();

      const bobBid = await publicAuction.bids(auctionId, bobBidId);
      const carolBid = await publicAuction.bids(auctionId, carolBidId);
      const daveBid = await publicAuction.bids(auctionId, daveBidId);

      expect(bobBid.wonAmount).to.equal(40n);
      expect(carolBid.wonAmount).to.equal(60n);
      expect(daveBid.wonAmount).to.equal(0n);

      const auction = await publicAuction.auctions(auctionId);
      expect(auction.finalPrice).to.equal(90n);
    });

    it("should correctly set partial won amount when crossing token amount threshold", async function () {
      // Place multiple bids
      await bidToken.mintHelper(signers.bob.address, 100n * 40n);
      await bidToken.approveHelper(signers.bob, publicAuction.getAddress(), 100n * 40n);
      const bid1 = await publicAuction.connect(signers.bob).placeBid(auctionId, 100n, 40n);
      await bid1.wait();

      await bidToken.mintHelper(signers.carol.address, 90n * 70n);
      await bidToken.approveHelper(signers.carol, publicAuction.getAddress(), 90n * 70n);
      const bid2 = await publicAuction.connect(signers.carol).placeBid(auctionId, 90n, 70n);
      await bid2.wait();

      await bidToken.mintHelper(signers.dave.address, 80n * 50n);
      await bidToken.approveHelper(signers.dave, publicAuction.getAddress(), 80n * 50n);
      const bid3 = await publicAuction.connect(signers.dave).placeBid(auctionId, 80n, 50n);
      await bid3.wait();

      await mine(201); // Move past end block

      const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
      const carolBidId = await publicAuction.bidId(auctionId, signers.carol.address);
      const daveBidId = await publicAuction.bidId(auctionId, signers.dave.address);

      const tx1 = await publicAuction.processNextBid(auctionId, bobBidId);
      await tx1.wait();
      const tx2 = await publicAuction.processNextBid(auctionId, carolBidId);
      await tx2.wait();
      const tx3 = await publicAuction.processNextBid(auctionId, daveBidId);
      await tx3.wait();

      const bobBid = await publicAuction.bids(auctionId, bobBidId);
      const carolBid = await publicAuction.bids(auctionId, carolBidId);
      const daveBid = await publicAuction.bids(auctionId, daveBidId);

      expect(bobBid.wonAmount).to.equal(40n);
      expect(carolBid.wonAmount).to.equal(60n);
      expect(daveBid.wonAmount).to.equal(0n);

      const auction = await publicAuction.auctions(auctionId);
      expect(auction.finalPrice).to.equal(90n);
    });
  });

  describe("Claiming", function () {
    let auctionId: bigint;

    beforeEach(async function () {
      await auctionableToken.mintHelper(signers.alice.address, 100n);
      await auctionableToken.approveHelper(signers.alice, publicAuction.getAddress(), 100n);
      const tx = await publicAuction.createAuction(
        auctionableToken.address,
        100n,
        bidToken.address,
        signers.alice.address,
        50n,
        50n,
        200n,
      );
      await tx.wait();
      const event = await publicAuction.queryFilter(publicAuction.filters.AuctionCreated());
      auctionId = event[0].args[0];
      await mine(50);
    });

    it("should claim bid and refund the bid token excess", async function () {
      {
        await bidToken.mintHelper(signers.bob.address, 100n * 40n);
        await bidToken.approveHelper(signers.bob, publicAuction.getAddress(), 100n * 40n);
        const bid = await publicAuction.connect(signers.bob).placeBid(auctionId, 100n, 40n);
        await bid.wait();
      }

      {
        await bidToken.mintHelper(signers.carol.address, 80n * 70n);
        await bidToken.approveHelper(signers.carol, publicAuction.getAddress(), 80n * 70n);
        const bid = await publicAuction.connect(signers.carol).placeBid(auctionId, 80n, 70n);
        await bid.wait();
      }

      await mine(201);

      {
        const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
        const tx = await publicAuction.processNextBid(auctionId, bobBidId);
        await tx.wait();
      }

      {
        const carolBidId = await publicAuction.bidId(auctionId, signers.carol.address);
        const tx = await publicAuction.processNextBid(auctionId, carolBidId);
        await tx.wait();
      }

      {
        const tx = await publicAuction.connect(signers.bob).claim(auctionId);
        await tx.wait();

        const isClaimed = await publicAuction.claimed(auctionId, signers.bob.address);
        expect(isClaimed).to.equal(true);

        const bobAuctionableTokenBalance = await auctionableToken.contract.balanceOf(signers.bob.address);
        expect(bobAuctionableTokenBalance).to.equal(40n);

        const bobBidTokenBalance = await bidToken.contract.balanceOf(signers.bob.address);
        expect(bobBidTokenBalance).to.equal(100n * 40n - 80n * 40n);
      }

      {
        const tx = await publicAuction.connect(signers.carol).claim(auctionId);
        await tx.wait();

        const isClaimed = await publicAuction.claimed(auctionId, signers.carol.address);
        expect(isClaimed).to.equal(true);

        const carolAuctionableTokenBalance = await auctionableToken.contract.balanceOf(signers.carol.address);
        expect(carolAuctionableTokenBalance).to.equal(60n);

        const carolBidTokenBalance = await bidToken.contract.balanceOf(signers.carol.address);
        expect(carolBidTokenBalance).to.equal(80n * 70n - 80n * 60n);
      }
    });

    it("should not claim if all bids are not processed", async function () {
      {
        await bidToken.mintHelper(signers.bob.address, 100n * 40n);
        await bidToken.approveHelper(signers.bob, publicAuction.getAddress(), 100n * 40n);
        const bid = await publicAuction.connect(signers.bob).placeBid(auctionId, 100n, 40n);
        await bid.wait();
      }

      {
        await bidToken.mintHelper(signers.carol.address, 80n * 70n);
        await bidToken.approveHelper(signers.carol, publicAuction.getAddress(), 80n * 70n);
        const bid = await publicAuction.connect(signers.carol).placeBid(auctionId, 80n, 70n);
        await bid.wait();
      }
      await mine(201);

      const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
      await publicAuction.processNextBid(auctionId, bobBidId);

      await expect(publicAuction.connect(signers.bob).claim(auctionId)).to.be.revertedWithCustomError(
        publicAuction,
        "AuctionNotProcessed",
      );
    });

    it("should not claim if already claimed", async function () {
      {
        await bidToken.mintHelper(signers.bob.address, 100n * 40n);
        await bidToken.approveHelper(signers.bob, publicAuction.getAddress(), 100n * 40n);
        const bid = await publicAuction.connect(signers.bob).placeBid(auctionId, 100n, 40n);
        await bid.wait();
      }
      await mine(201);

      const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
      await publicAuction.processNextBid(auctionId, bobBidId);

      const tx = await publicAuction.connect(signers.bob).claim(auctionId);
      await tx.wait();

      await expect(publicAuction.connect(signers.bob).claim(auctionId)).to.be.revertedWithCustomError(
        publicAuction,
        "AlreadyClaimed",
      );
    });
  });
});
