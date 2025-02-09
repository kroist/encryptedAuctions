import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { latest } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";
import { FhevmInstance } from "fhevmjs/node";
import { ethers, network } from "hardhat";

import { EncryptedAuction, EncryptedAuctionRouter } from "../../types";
import { ConfidentialERC20Factory } from "../../types/contracts/ConfidentialERC20Factory";
import { awaitAllDecryptionResults } from "../asyncDecrypt";
import { getFHEGasFromTxReceipt } from "../coprocessorUtils";
import { createInstance } from "../instance";
import { PublicERC20Fixture, deployPublicERC20Fixture } from "../publicAuction/PublicERC20.fixture";
import { Signers, getSigners, initSigners } from "../signers";
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
const INITIAL_BID_TOKEN_BALANCE = 600n;

const STAKE_AMOUNT = 1000n;

describe("EncryptedAuction:FHEGas", function () {
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

  let fixtureAuction: Awaited<ReturnType<typeof deployEncryptedAuctionFixture>>;
  let encryptedAuction: EncryptedAuction;
  let signers: Signers;
  let auctionableToken: ConfidentialERC20Fixture;
  let bidToken: ConfidentialERC20Fixture;
  let fhevm: FhevmInstance;
  let stakeToken: PublicERC20Fixture;
  let router: EncryptedAuctionRouter;
  let tokenFactory: ConfidentialERC20Factory;

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

  async function processBid(signer: HardhatEthersSigner) {
    const bidId = await encryptedAuction.bidId(signer.address);
    await (await encryptedAuction.connect(signers.jane).processNextBid(bidId)).wait();
    await awaitAllDecryptionResults();
  }

  async function getGasFromTxes(txes: string[]) {
    const txHashes = await Promise.all(txes.map((tx) => ethers.provider.getTransactionReceipt(tx)));
    const nativeGasSum = txHashes.reduce((acc, txHash) => acc + txHash!.gasUsed, 0n);

    let fheGasSum = 0;
    if (network.name === "hardhat") {
      // `getFHEGasFromTxReceipt` function only works in mocked mode but gives same exact FHEGas consumed than on the real fhEVM
      fheGasSum = txHashes.reduce((acc, txHash) => acc + getFHEGasFromTxReceipt(txHash!), 0);
    }
    return { nativeGasSum, fheGasSum };
  }

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
    fhevm = await createInstance();
    stakeToken = await deployPublicERC20Fixture("StakeToken", "ST");
    await setupTokensAndApprovals(auctionableToken, INITIAL_TOKEN_AMOUNT, encryptedAuction, signers.alice, fhevm);
    await stakeToken.mintHelper(signers.jane.address, STAKE_AMOUNT);
    await stakeToken.approveHelper(signers.jane, encryptedAuction.getAddress(), STAKE_AMOUNT);
  });

  it("gas consumed during createAuction", async function () {
    const tx = await createTestAuction(encryptedAuction, auctionableToken, bidToken, signers);
    await tx.wait();
    const { nativeGasSum, fheGasSum } = await getGasFromTxes([tx.hash]);
    console.log("Native Gas Consumed during createAuction", nativeGasSum);
    console.log("FHEGas Consumed during createAuction", fheGasSum);
  });

  it("gas consumed during bid", async function () {
    (await createTestAuction(encryptedAuction, auctionableToken, bidToken, signers)).wait();
    await setupTokensAndApprovals(bidToken, INITIAL_BID_TOKEN_BALANCE, encryptedAuction, signers.bob, fhevm);

    await time.increase(START_TIME);

    const tx = await placeBid(signers.bob, BID_PRICE, BID_AMOUNT);
    await tx.wait();
    const { nativeGasSum, fheGasSum } = await getGasFromTxes([tx.hash]);
    console.log("Native Gas Consumed during bid", nativeGasSum);
    console.log("FHEGas Consumed during bid", fheGasSum);
  });

  it("gas consumed during bid processing", async function () {
    (await createTestAuction(encryptedAuction, auctionableToken, bidToken, signers)).wait();
    await setupTokensAndApprovals(bidToken, INITIAL_BID_TOKEN_BALANCE, encryptedAuction, signers.bob, fhevm);
    await setupTokensAndApprovals(bidToken, INITIAL_BID_TOKEN_BALANCE, encryptedAuction, signers.carol, fhevm);

    await time.increase(START_TIME);

    (await placeBid(signers.bob, BID_PRICE, BID_AMOUNT)).wait();
    (await placeBid(signers.carol, BID_PRICE, BID_AMOUNT)).wait();

    await time.increase(POST_END_TIME);

    const bidIds = {
      bob: await encryptedAuction.bidId(signers.bob.address),
      carol: await encryptedAuction.bidId(signers.carol.address),
    };

    const tx1 = await encryptedAuction.connect(signers.jane).processNextBid(bidIds.bob);
    await tx1.wait();
    {
      const { nativeGasSum, fheGasSum } = await getGasFromTxes([tx1.hash]);
      console.log("Native Gas Consumed during first bid processing", nativeGasSum);
      console.log("FHEGas Consumed during first bid processing", fheGasSum);
    }
    {
      const txHashes = await awaitAllDecryptionResults();
      const { nativeGasSum, fheGasSum } = await getGasFromTxes(txHashes);
      console.log("Native Gas Consumed during first bid callback", nativeGasSum);
      console.log("FHEGas Consumed during first bid callback", fheGasSum);
    }
    {
      const tx2 = await encryptedAuction.connect(signers.jane).processNextBid(bidIds.carol);
      await tx2.wait();
      const { nativeGasSum, fheGasSum } = await getGasFromTxes([tx2.hash]);
      console.log("Native Gas Consumed during second bid processing", nativeGasSum);
      console.log("FHEGas Consumed during second bid processing", fheGasSum);
    }
    {
      const txHashes = await awaitAllDecryptionResults();
      const { nativeGasSum, fheGasSum } = await getGasFromTxes(txHashes);
      console.log("Native Gas Consumed during second bid callback", nativeGasSum);
      console.log("FHEGas Consumed during second bid callback", fheGasSum);
    }
  });

  it("gas consumed during bid claiming", async function () {
    (await createTestAuction(encryptedAuction, auctionableToken, bidToken, signers)).wait();
    await setupTokensAndApprovals(bidToken, INITIAL_BID_TOKEN_BALANCE, encryptedAuction, signers.bob, fhevm);
    await setupTokensAndApprovals(bidToken, INITIAL_BID_TOKEN_BALANCE, encryptedAuction, signers.carol, fhevm);

    await time.increase(START_TIME);

    (await placeBid(signers.bob, BID_PRICE, BID_AMOUNT)).wait();
    (await placeBid(signers.carol, BID_PRICE, BID_AMOUNT)).wait();

    await time.increase(POST_END_TIME);

    await processBid(signers.bob);
    await processBid(signers.carol);

    {
      const tx = await encryptedAuction.connect(signers.bob).claim();
      await tx.wait();

      const { nativeGasSum, fheGasSum } = await getGasFromTxes([tx.hash]);

      console.log("Native Gas Consumed during claim", nativeGasSum);
      console.log("FHEGas Consumed during claim", fheGasSum);
    }

    {
      const tx = await encryptedAuction.connect(signers.alice).claimOwner();
      await tx.wait();

      const { nativeGasSum, fheGasSum } = await getGasFromTxes([tx.hash]);

      console.log("Native Gas Consumed during claimOwner", nativeGasSum);
      console.log("FHEGas Consumed during claimOwner", fheGasSum);
    }
  });
});
