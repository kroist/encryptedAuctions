import express from "express";
import cors from "cors";
import { EthereumService } from "./services/ethereum";
import dotenv from "dotenv";
import { createInstance } from "fhevmjs/node";
dotenv.config();

export const AUCTION_ROUTER = process.env.AUCTION_ROUTER as `0x${string}`;

function getRpcUrls() {
  const rawRpcUrls = [
    process.env.RPC_URL,
    process.env.RPC_URL_2,
    process.env.RPC_URL_3,
  ];
  return rawRpcUrls
    .filter((rpcUrl) => rpcUrl !== undefined)
    .map((rpcUrl) => rpcUrl);
}

// Export a singleton instance
const ethereumService = new EthereumService(getRpcUrls());

const app = express();
const port = (process.env.PORT as unknown as number) || (3001 as number);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get("/api/address", (req, res) => {
  try {
    const address = ethereumService.getAddress();
    res.json({ address });
  } catch (error) {
    console.error("Error getting address:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/sign", async (req, res) => {
  try {
    const {
      contractAddress,
      token,
      tokenAmount,
      bidToken,
      bidSequencer,
      floorPrice,
      startTime,
      endTime,
      stakeToken,
      stakeAmount,
    } = req.body;

    // Validate required fields
    if (
      !contractAddress ||
      !token ||
      !tokenAmount ||
      !bidToken ||
      !bidSequencer ||
      !floorPrice ||
      !startTime ||
      !endTime ||
      !stakeToken ||
      !stakeAmount
    ) {
      return res.status(400).json({
        error: "Missing required fields",
        requiredFields: [
          "contractAddress (address)",
          "token (address)",
          "tokenAmount (uint64)",
          "bidToken (address)",
          "bidSequencer (address)",
          "floorPrice (uint64)",
          "startTime (uint256)",
          "endTime (uint256)",
          "stakeToken (address)",
          "stakeAmount (uint256)",
        ],
      });
    }

    // Convert numeric strings to BigInt
    const params = {
      contractAddress,
      token,
      tokenAmount: BigInt(tokenAmount),
      bidToken,
      bidSequencer,
      floorPrice: BigInt(floorPrice),
      startTime: BigInt(startTime),
      endTime: BigInt(endTime),
      stakeToken,
      stakeAmount: BigInt(stakeAmount),
    };

    const signature = await ethereumService.signMessage(params);
    res.json({ signature });
  } catch (error) {
    console.error("Error signing message:", error);
    if (
      error instanceof Error &&
      error.message.startsWith("Validation error:")
    ) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Start server
app.listen(port, "0.0.0.0", () => {
  console.log(`Bid server running at http://0.0.0.0:${port}`);
  console.log(`Available endpoints:`);
  console.log(`- GET  /address - Get Ethereum address`);
  console.log(`- POST /sign    - Sign auction parameters`);
  console.log(`  Required parameters:`);
  console.log(`  - contractAddress (address)`);
  console.log(`  - token (address)`);
  console.log(`  - tokenAmount (uint64)`);
  console.log(`  - bidToken (address)`);
  console.log(`  - bidSequencer (address)`);
  console.log(`  - floorPrice (uint64)`);
  console.log(`  - startTime (uint256)`);
  console.log(`  - endTime (uint256)`);
  console.log(`  - stakeToken (address)`);
  console.log(`  - stakeAmount (uint256)`);
});
