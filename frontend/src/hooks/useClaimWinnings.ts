import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { auctionAbi } from "../lib/contracts/abi/auction";
import { useEffect } from "react";

export function useClaimWinnings(
  auctionAddress: `0x${string}`,
  auctionCreator: `0x${string}`
) {
  const { address } = useAccount();
  const { data: claimHash, writeContract, isPending } = useWriteContract();
  const { isLoading: isWaitingForClaim, isSuccess: claimSuccess } =
    useWaitForTransactionReceipt({
      hash: claimHash,
    });

  const { data: hasClaimed, refetch } = useReadContract({
    address: auctionAddress,
    abi: auctionAbi,
    functionName: "claimed",
    args: [address!],
    query: {
      enabled: !!address,
    },
  });

  useEffect(() => {
    refetch();
  }, [claimSuccess, refetch]);

  // auctionData is a tuple where creator is at index 12
  const isCreator = address === auctionCreator;

  const claim = () => {
    if (!address) return;

    writeContract({
      address: auctionAddress,
      abi: auctionAbi,
      functionName: isCreator ? "claimOwner" : "claim",
    });
  };

  return {
    claim,
    hasClaimed,
    isClaimPending: isPending || isWaitingForClaim,
    isCreator,
  };
}
