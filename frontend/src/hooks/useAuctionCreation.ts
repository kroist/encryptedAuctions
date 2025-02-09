import { useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  getSequencerAddress,
  getSequencerSignature,
} from "../lib/bidSequencer";
import { auctionAbi } from "../lib/contracts/abi/auction";

export interface AuctionConfig {
  startTime: string;
  endTime: string;
  floorPrice: bigint;
}

type AuctionCreationHook = {
  auctionAddress: `0x${string}` | null;
  tokenAddress: `0x${string}` | null;
  tokenAmount: bigint | null;
};

export function useAuctionCreation({
  auctionAddress,
  tokenAddress,
  tokenAmount,
}: AuctionCreationHook) {
  const [error, setError] = useState<string | null>(null);

  const {
    writeContract: createAuction,
    data: createHash,
    isPending: isCreating,
  } = useWriteContract();

  const { isLoading: isWaitingForCreate, isSuccess: createSuccess } =
    useWaitForTransactionReceipt({
      hash: createHash,
    });

  const handleCreateAuction = async (config: AuctionConfig) => {
    if (!tokenAddress || !tokenAmount || !auctionAddress) {
      setError("Incomplete information");
      return;
    }

    // Validate inputs
    if (!config.startTime || !config.endTime || !config.floorPrice) {
      setError("Please fill in all required fields");
      return;
    }

    if (config.startTime >= config.endTime) {
      setError("End time must be after start time");
      return;
    }

    const startTimeBigint =
      BigInt(Date.parse(new Date(config.startTime).toUTCString())) / 1000n;
    const endTimeBigint =
      BigInt(Date.parse(new Date(config.endTime).toUTCString())) / 1000n;

    const sequencerAddress = await getSequencerAddress();

    const signature = await getSequencerSignature(
      auctionAddress,
      tokenAddress,
      tokenAmount,
      "0x12BcCa49859e00455d6d1d5fe9a0B4732f9743BE",
      sequencerAddress,
      config.floorPrice,
      startTimeBigint,
      endTimeBigint,
      "0x12BcCa49859e00455d6d1d5fe9a0B4732f9743BE",
      0n
    );

    console.log("Signature", signature);

    createAuction({
      address: auctionAddress,
      abi: auctionAbi,
      functionName: "createAuction",
      args: [
        tokenAddress,
        tokenAmount,
        "0x12BcCa49859e00455d6d1d5fe9a0B4732f9743BE",
        sequencerAddress,
        config.floorPrice,
        startTimeBigint,
        endTimeBigint,
        "0x12BcCa49859e00455d6d1d5fe9a0B4732f9743BE",
        0n,
        signature,
      ],
    });
  };

  return {
    error,
    isLoading: isCreating || isWaitingForCreate,
    isSuccess: createSuccess,
    createAuction: handleCreateAuction,
  };
}
