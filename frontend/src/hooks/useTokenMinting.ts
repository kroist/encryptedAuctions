import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState } from "react";
import { tokenAbi } from "../lib/contracts/abi/token";

export function useTokenMinting(tokenAddress: string | null) {
  const [error, setError] = useState<string | null>(null);

  const {
    writeContract: mintTokens,
    data: mintHash,
    isPending: isMinting,
  } = useWriteContract();

  const { isLoading: isWaitingForMint, isSuccess: mintSuccess } =
    useWaitForTransactionReceipt({
      hash: mintHash,
    });

  const handleMintTokens = async (to: `0x${string}`, amount: bigint) => {
    if (!amount) {
      setError("Please enter amount to mint");
      return;
    }
    if (!tokenAddress) {
      setError("No token address provided");
      return;
    }

    try {
      mintTokens({
        address: tokenAddress as `0x${string}`,
        abi: tokenAbi,
        functionName: "mint",
        args: [to, BigInt(amount)],
      });
      setError(null);
    } catch (err) {
      setError("Failed to mint tokens: " + (err as Error).message);
    }
  };

  return {
    error,
    isLoading: isMinting || isWaitingForMint,
    isSuccess: mintSuccess,
    mintTokens: handleMintTokens,
  };
}
