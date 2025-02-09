import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { useState } from "react";
import { tokenAbi } from "../lib/contracts/abi/token";
import { useFhevmInstance } from "./fhevmSetup";
import { bytesToHex } from "viem";

type TokenApprovalHook = {
  auctionAddress: `0x${string}` | null;
  tokenAddress: `0x${string}` | null;
  tokenAmount: bigint | null;
};

export function useTokenApproval({
  auctionAddress,
  tokenAddress,
  tokenAmount,
}: TokenApprovalHook) {
  const [error, setError] = useState<string | null>(null);
  const { address: myAddress, chain } = useAccount();
  const { data: fhevmInstance } = useFhevmInstance(
    chain?.rpcUrls.default.http[0] as string
  );

  const {
    writeContract: approveTokens,
    data: mintHash,
    isPending: isMinting,
  } = useWriteContract();

  const { isLoading: isWaitingForMint, isSuccess: mintSuccess } =
    useWaitForTransactionReceipt({
      hash: mintHash,
    });

  const handleApproveTokens = async () => {
    if (!tokenAmount) {
      setError("No amount provided");
      return;
    }
    if (!tokenAddress) {
      setError("No token address provided");
      return;
    }
    if (!auctionAddress) {
      setError("No auction address provided");
      return;
    }
    if (!fhevmInstance) {
      setError("No FHEVM instance available");
      return;
    }
    if (!myAddress) {
      setError("No account available");
      return;
    }

    const inputAlice = fhevmInstance.createEncryptedInput(
      auctionAddress,
      myAddress
    );
    inputAlice.add64(tokenAmount);
    console.log(inputAlice);
    try {
      const encryptedAllowanceAmount = await inputAlice.encrypt();
      console.log(encryptedAllowanceAmount);

      try {
        approveTokens({
          address: tokenAddress as `0x${string}`,
          abi: tokenAbi,
          functionName: "approve",
          args: [
            auctionAddress,
            bytesToHex(encryptedAllowanceAmount.handles[0]),
            bytesToHex(encryptedAllowanceAmount.inputProof),
          ],
        });
        setError(null);
      } catch (err) {
        setError("Failed to mint tokens: " + (err as Error).message);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to encrypt input: " + (err as Error).message);
    }
  };

  return {
    error,
    isLoading: isMinting || isWaitingForMint,
    isSuccess: mintSuccess,
    approveToken: handleApproveTokens,
  };
}
