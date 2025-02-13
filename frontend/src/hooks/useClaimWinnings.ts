import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { auctionAbi } from "../lib/contracts/abi/auction";

export function useClaimWinnings(
  auctionAddress: `0x${string}`,
  auctionCreator: `0x${string}`
) {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const { data: hasClaimed } = useReadContract({
    address: auctionAddress,
    abi: auctionAbi,
    functionName: "claimed",
    args: [address!],
    query: {
      enabled: !!address,
    },
  });

  // auctionData is a tuple where creator is at index 12
  const isCreator = address === auctionCreator;

  const claim = async () => {
    if (!address) return;

    await writeContractAsync({
      address: auctionAddress,
      abi: auctionAbi,
      functionName: isCreator ? "claimOwner" : "claim",
    });
  };

  return {
    claim,
    hasClaimed,
    isClaimPending: isPending,
    isCreator,
  };
}
