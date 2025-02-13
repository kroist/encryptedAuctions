import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  isAddress,
  publicActions,
} from "viem";
import { createInstance, FhevmInstance } from "fhevmjs/node";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { auctionRouterAbi } from "./auctionRouterAbi";
import { auctionAbi } from "./auctionAbi";
import { AUCTION_ROUTER } from "../server";

const ACL_CONTRACT = "0xfee8407e2f5e3ee68ad77cae98c434e637f516e5";
const KMS_VERIFIER_CONTRACT = "0x9d6891a6240d6130c54ae243d8005063d05fe14b";
const PUBLIC_KEY_ID = "0301c5dd3e2702992b7c12930b7d4defeaaa52cf";
const GATEWAY_URL = "https://gateway.sepolia.zama.ai/";

interface AuctionParams {
  contractAddress: string; // address _contractAddress
  token: string; // address _token
  tokenAmount: bigint; // uint64 _tokenAmount
  bidToken: string; // address _bidToken
  bidSequencer: string; // address _bidSequencer
  floorPrice: bigint; // uint64 _floorPrice
  startTime: bigint; // uint256 _startTime
  endTime: bigint; // uint256 _endTime
  stakeToken: string; // address _stakeToken
  stakeAmount: bigint; // uint256 _stakeAmount
}

function createClient(privateKey: `0x${string}`, rpcUrl: string) {
  const account = privateKeyToAccount(privateKey);
  let client = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  }).extend(publicActions);
  return client;
}

type Client = ReturnType<typeof createClient>;

export class EthereumService {
  private wallet: Client;
  private fhevmInstance: FhevmInstance | null;

  constructor() {
    // Generate a random mock address
    const wallet = createClient(
      process.env.PRIVATE_KEY as `0x${string}`,
      process.env.RPC_URL as string
    );
    this.wallet = wallet;
    this.fhevmInstance = null;

    // Start the polling loop
    this.startPolling();
  }

  async getFhevmInstance() {
    if (!this.fhevmInstance) {
      this.fhevmInstance = await createInstance({
        kmsContractAddress: KMS_VERIFIER_CONTRACT,
        aclContractAddress: ACL_CONTRACT,
        networkUrl: process.env.RPC_URL as string,
        gatewayUrl: GATEWAY_URL,
        publicKeyId: PUBLIC_KEY_ID,
      });
    }
    return this.fhevmInstance;
  }

  getAddress(): string {
    return this.wallet.account.address;
  }

  async signMessage(params: AuctionParams): Promise<string> {
    try {
      // Validate Ethereum addresses
      if (!isAddress(params.token)) throw new Error("Invalid token address");
      if (!isAddress(params.bidToken))
        throw new Error("Invalid bid token address");
      if (!isAddress(params.bidSequencer))
        throw new Error("Invalid bid sequencer address");
      if (params.bidSequencer !== this.getAddress())
        throw new Error("Invalid bid sequencer");
      if (!isAddress(params.stakeToken))
        throw new Error("Invalid stake token address");

      // Validate timestamps
      if (params.endTime <= params.startTime)
        throw new Error("End time must be after start time");

      // Validate amounts
      if (params.tokenAmount < BigInt(0))
        throw new Error("Token amount must be positive");
      if (params.floorPrice < BigInt(0))
        throw new Error("Floor price must be positive");
      if (params.stakeAmount < BigInt(0))
        throw new Error("Stake amount must be positive");

      // In a real implementation, we would:
      // 1. Pack the parameters according to the contract's expected format
      // 2. Hash the packed data
      // 3. Sign the hash with the private key

      // For now, return a mock signature
      const domain = {
        name: "EncryptedAuction",
        version: "1",
        chainId: 11155111,
        verifyingContract: params.contractAddress as `0x${string}`,
      };
      const signature = await this.wallet.signTypedData({
        domain,
        types: {
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
        primaryType: "AuctionData",
        message: {
          token: params.token as `0x${string}`,
          tokenAmount: params.tokenAmount,
          bidToken: params.bidToken,
          bidSequencer: params.bidSequencer,
          floorPrice: params.floorPrice,
          startTime: params.startTime,
          endTime: params.endTime,
          stakeToken: params.stakeToken,
          stakeAmount: params.stakeAmount,
        },
      });
      return signature;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Validation error: ${error.message}`);
      }
      throw error;
    }
  }

  private startPolling(): void {
    this.findUnprocessedAuction();
  }

  async findUnprocessedAuction(): Promise<void> {
    console.log("Checking for unprocessed auctions...");
    const routerContract = getContract({
      address: AUCTION_ROUTER,
      abi: auctionRouterAbi,
      client: this.wallet,
    });
    const auctionsCount = await routerContract.read.auctionCount();
    for (let i = 0; i < auctionsCount; i++) {
      const id = BigInt(i);
      const auctionAddress = await routerContract.read.auctions([id]);
      const auctionContract = getContract({
        address: auctionAddress as `0x${string}`,
        abi: auctionAbi,
        client: this.wallet,
      });
      const auctionData = await auctionContract.read.auctionData();
      if (
        auctionData[3] === this.getAddress() &&
        auctionData[8] < auctionData[7] &&
        auctionData[6] * 1000n < BigInt(Date.now())
      ) {
        console.log("Processing auction", auctionAddress);
        await this.processAuction(auctionAddress as `0x${string}`);
      }
    }

    // Check again in 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 10000));
    this.findUnprocessedAuction();
  }

  async processAuction(auctionAddress: `0x${string}`): Promise<void> {
    console.log(auctionAddress);
    const auctionContract = getContract({
      address: auctionAddress,
      abi: auctionAbi,
      client: this.wallet,
    });
    const auctionData = await auctionContract.read.auctionData();
    let lastProcessedBidIndex = auctionData[8];
    const bidIndex = auctionData[7];
    console.log("kek", lastProcessedBidIndex, bidIndex);
    const bids: { price: bigint; index: number }[] = [];
    for (let i = 1; i < bidIndex; i++) {
      const bidData = await auctionContract.read.bids([BigInt(i)]);
      console.log(bidData);
      const encryptedPrice = bidData[0];
      const decryptedPrice = await this.decryptPrice(
        auctionAddress,
        encryptedPrice
      );
      console.log(decryptedPrice);
      bids.push({ price: decryptedPrice, index: i });
    }
    // sort bids by price descending, then by index ascending
    bids.sort((a, b) => {
      if (a.price === b.price) {
        return a.index - b.index;
      }
      return b.price > a.price ? 1 : -1;
    });
    console.log(bids);
    for (let i = Number(lastProcessedBidIndex - 1n); i < bids.length; i++) {
      console.log("Processing bid", i + 1);
      const tx = await auctionContract.write.processNextBid(
        [BigInt(bids[i].index)],
        { gas: 3000000n }
      );
      const receipt = await this.wallet.waitForTransactionReceipt({ hash: tx });
      console.log(receipt);
      while (true) {
        const auctionData = await auctionContract.read.auctionData();
        console.log(auctionData[8] - 1n);
        if (auctionData[8] - 1n === BigInt(i + 1)) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async decryptPrice(auctionAddress: `0x${string}`, encryptedPrice: bigint) {
    const fhevmInstance = await this.getFhevmInstance();
    const { publicKey, privateKey } = fhevmInstance.generateKeypair();
    const eip712 = fhevmInstance.createEIP712(publicKey, auctionAddress);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signature = await this.wallet.signTypedData(eip712 as any);
    const decrypted = await fhevmInstance.reencrypt(
      encryptedPrice,
      privateKey,
      publicKey,
      signature,
      auctionAddress,
      this.getAddress()
    );
    return decrypted;
  }
}
