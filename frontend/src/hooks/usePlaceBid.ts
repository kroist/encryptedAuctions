import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { useState } from "react";
import { auctionAbi } from "../lib/contracts/abi/auction";
import { useFhevmInstance } from "./fhevmSetup";
import { bytesToHex } from "viem";
import { useTokenApproval } from "./useTokenApproval";

type PlaceBidHook = {
  auctionAddress: `0x${string}` | null;
  tokenAddress: `0x${string}` | null;
  approveAmount: bigint | null;
};

export function usePlaceBid({
  auctionAddress,
  tokenAddress,
  approveAmount,
}: PlaceBidHook) {
  const [error, setError] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const { address: myAddress, chain } = useAccount();
  const { data: fhevmInstance } = useFhevmInstance(
    chain?.rpcUrls.default.http[0] as string
  );

  const {
    writeContract: placeBidContract,
    data: bidHash,
    isPending: isBidding,
  } = useWriteContract();

  const { isLoading: isWaitingForBid, isSuccess: bidSuccess } =
    useWaitForTransactionReceipt({
      hash: bidHash,
    });

  const {
    error: approvalError,
    isLoading: isApproving,
    isSuccess: approvalSuccess,
    approveToken: handleApproveToken,
  } = useTokenApproval({
    auctionAddress,
    tokenAddress,
    tokenAmount: approveAmount,
  });

  const approveToken = () => {
    handleApproveToken();
  };

  const handlePlaceBid = async (amount: bigint, price: bigint) => {
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

    setIsEncrypting(true);

    try {
      // Create and encrypt bid amount
      const inputAmount = fhevmInstance.createEncryptedInput(
        auctionAddress,
        myAddress
      );
      inputAmount.add64(amount);
      const encryptedAmount = await inputAmount.encrypt();

      // Create and encrypt bid price
      const inputPrice = fhevmInstance.createEncryptedInput(
        auctionAddress,
        myAddress
      );
      inputPrice.add64(price);
      const encryptedPrice = await inputPrice.encrypt();

      setIsEncrypting(false);

      try {
        placeBidContract({
          address: auctionAddress,
          abi: auctionAbi,
          functionName: "placeBid",
          args: [
            bytesToHex(encryptedPrice.handles[0]),
            bytesToHex(encryptedAmount.handles[0]),
            bytesToHex(encryptedAmount.inputProof),
          ],
        });
        setError(null);
      } catch (err) {
        setError("Failed to place bid: " + (err as Error).message);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to encrypt bid data: " + (err as Error).message);
      setIsEncrypting(false);
    }
  };

  return {
    error: error || approvalError,
    isLoading: isBidding || isWaitingForBid || isEncrypting || isApproving,
    isSuccess: bidSuccess,
    approvalSuccess,
    placeBid: handlePlaceBid,
    approveToken,
  };
}
