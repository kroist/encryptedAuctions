import { expect } from "chai";
import { mine, reset } from "@nomicfoundation/hardhat-network-helpers";
import { getSigners, initSigners, Signers } from "../signers";
import { deployPublicAuctionFixture } from "./PublicAuction.fixture";
import type { PublicAuction } from "../../types";

describe("PublicAuction", function () {
  let publicAuction: PublicAuction;
  let signers: Signers;

  before(async function () {
    await initSigners();
    signers = await getSigners();
  });

  beforeEach(async function () {
    reset();
    const contract = await deployPublicAuctionFixture();
    publicAuction = contract;
  });

  describe("Auction Creation", function () {

    const dummyTokenAddress = "0x3459555676F217a10338EdFDC1d7242879E89ea6";
    const dummyBidTokenAddress = "0xb859b000d4efEbd7c3d5aC35b042699D6d9db187";
    const dummySequencerAddress = "0x4F3A53a6D7680A3eCd95f1aD607b16d6309F4202";

    it("should create an auction with correct parameters", async function () {
      const transaction = await publicAuction.createAuction(
        dummyTokenAddress,
        100n,
        dummyBidTokenAddress,
        dummySequencerAddress,
        1n,
        50n,
        200n,
      );

      await transaction.wait();
      
      const auctionEvent = await publicAuction.queryFilter(publicAuction.filters.AuctionCreated());
      expect(auctionEvent.length).to.equal(1);

      const auctionId = auctionEvent[0].args[0];

      const auction = await publicAuction.auctions(auctionId);

      expect(auction.token).to.equal(dummyTokenAddress);
      expect(auction.tokenAmount).to.equal(100n);
      expect(auction.bidToken).to.equal(dummyBidTokenAddress);
      expect(auction.bidSequencer).to.equal(dummySequencerAddress);
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
        dummyTokenAddress,
        100n,
        dummyBidTokenAddress,
        dummySequencerAddress,
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

    const dummyTokenAddress = "0x3459555676F217a10338EdFDC1d7242879E89ea6";
    const dummyBidTokenAddress = "0xb859b000d4efEbd7c3d5aC35b042699D6d9db187";
    const dummySequencerAddress = "0x4F3A53a6D7680A3eCd95f1aD607b16d6309F4202";

    beforeEach(async function () {
      const tx = await publicAuction.createAuction(
        dummyTokenAddress,
        100n,
        dummyBidTokenAddress,
        dummySequencerAddress,
        50n, // floor price
        50n, // start block
        200n, // end block
      );
      await tx.wait();
      const event = await publicAuction.queryFilter(publicAuction.filters.AuctionCreated());
      auctionId = event[0].args[0];
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
    });

    it("should revert if auction has not started", async function () {
      await expect(
        publicAuction.connect(signers.bob).placeBid(auctionId, 60n, 10n)
      ).to.be.revertedWithCustomError(publicAuction, "AuctionNotStarted");
    });

    it("should revert if auction has ended", async function () {
      await mine(201); // Move past end block
      await expect(
        publicAuction.connect(signers.bob).placeBid(auctionId, 60n, 10n)
      ).to.be.revertedWithCustomError(publicAuction, "AuctionEnded");
    });

    it("should revert if bid amount is zero", async function () {
      await mine(50);
      await expect(
        publicAuction.connect(signers.bob).placeBid(auctionId, 60n, 0n)
      ).to.be.revertedWithCustomError(publicAuction, "BidZeroAmount");
    });

    it("should revert if bid price is below floor price", async function () {
      await mine(50);
      await expect(
        publicAuction.connect(signers.bob).placeBid(auctionId, 40n, 10n)
      ).to.be.revertedWithCustomError(publicAuction, "BidNotHighEnough");
    });

    it("should revert if bidder has already placed a bid", async function () {
      await mine(50);
      const tx = await publicAuction.connect(signers.bob).placeBid(auctionId, 60n, 10n);
      await tx.wait();
      await expect(
        publicAuction.connect(signers.bob).placeBid(auctionId, 70n, 10n)
      ).to.be.revertedWithCustomError(publicAuction, "BidAlreadyPlaced");
    });
  });

  describe("Bid Processing", function () {
    let auctionId: bigint;

    const dummyTokenAddress = "0x3459555676F217a10338EdFDC1d7242879E89ea6";
    const dummyBidTokenAddress = "0xb859b000d4efEbd7c3d5aC35b042699D6d9db187";

    beforeEach(async function () {
      const tx = await publicAuction.createAuction(
        dummyTokenAddress,
        100n,
        dummyBidTokenAddress,
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
      const bid1 = await publicAuction.connect(signers.bob).placeBid(auctionId, 100n, 40n);
      await bid1.wait();
      const bid2 = await publicAuction.connect(signers.carol).placeBid(auctionId, 90n, 30n);
      await bid2.wait();
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
      await expect(
        publicAuction.processNextBid(auctionId, carolBidId)
      ).to.be.revertedWithCustomError(publicAuction, "WrongBidOrder");
    });

    it("should revert if auction is still active", async function () {
      const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
      await expect(
        publicAuction.processNextBid(auctionId, bobBidId)
      ).to.be.revertedWithCustomError(publicAuction, "AuctionActive");
    });

    it("should revert if bid is already processed", async function () {
      await mine(201); // Move past end block

      const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
      const tx = await publicAuction.processNextBid(auctionId, bobBidId);
      await tx.wait();
      
      await expect(
        publicAuction.processNextBid(auctionId, bobBidId)
      ).to.be.revertedWithCustomError(publicAuction, "BidAlreadyPlaced");
    });
  });

  describe("Bid Processing: Sliding Sum", function () {

    let auctionId: bigint;

    const dummyTokenAddress = "0x3459555676F217a10338EdFDC1d7242879E89ea6";
    const dummyBidTokenAddress = "0xb859b000d4efEbd7c3d5aC35b042699D6d9db187";

    beforeEach(async function () {
      const tx = await publicAuction.createAuction(
        dummyTokenAddress,
        100n,
        dummyBidTokenAddress,
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
      const bid1 = await publicAuction.connect(signers.bob).placeBid(auctionId, 100n, 40n);
      await bid1.wait();
      const bid2 = await publicAuction.connect(signers.carol).placeBid(auctionId, 90n, 60n);
      await bid2.wait();
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
      const bid1 = await publicAuction.connect(signers.bob).placeBid(auctionId, 100n, 40n);
      await bid1.wait();
      const bid2 = await publicAuction.connect(signers.carol).placeBid(auctionId, 90n, 70n);
      await bid2.wait();
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

    const dummyTokenAddress = "0x3459555676F217a10338EdFDC1d7242879E89ea6";
    const dummyBidTokenAddress = "0xb859b000d4efEbd7c3d5aC35b042699D6d9db187";

    beforeEach(async function () {
      const tx = await publicAuction.createAuction(
        dummyTokenAddress,
        100n,
        dummyBidTokenAddress,
        signers.alice.address,
        50n,
        50n,
        200n,
      );
      await tx.wait();
      const event = await publicAuction.queryFilter(publicAuction.filters.AuctionCreated());
      auctionId = event[0].args[0];
      
      await mine(50);
      const bid = await publicAuction.connect(signers.bob).placeBid(auctionId, 100n, 40n);
      await bid.wait();
      await mine(201);
    });

    it("should mark bid as claimed", async function () {
      const bobBidId = await publicAuction.bidId(auctionId, signers.bob.address);
      const tx1 = await publicAuction.processNextBid(auctionId, bobBidId);
      await tx1.wait();
      
      const tx2 = await publicAuction.connect(signers.bob).claim(auctionId);
      await tx2.wait();
      
      const isClaimed = await publicAuction.claimed(auctionId, signers.bob.address);
      expect(isClaimed).to.equal(true);
    });
  });
});
