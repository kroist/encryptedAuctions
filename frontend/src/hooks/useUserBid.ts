import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import { auctionAbi } from "../lib/contracts/abi/auction";
import { useState } from "react";
import { useFhevmInstance } from "./fhevmSetup";

export function useUserBid(auctionAddress: `0x${string}`) {
  const { address, chain } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { data: fhevmInstance } = useFhevmInstance(
    chain?.rpcUrls.default.http[0] as string
  );

  const [bidPrice, setBidPrice] = useState<bigint | null>(null);
  const [bidAmount, setBidAmount] = useState<bigint | null>(null);
  const [wonAmount, setWonAmount] = useState<bigint | null>(null);
  const [isBidLoading, setIsBidLoading] = useState(false);

  const { data: bidId } = useReadContract({
    address: auctionAddress,
    abi: auctionAbi,
    functionName: "bidId",
    args: [address!],
    query: {
      enabled: !!address,
    },
  });

  const { refetch: refetchBidData } = useReadContract({
    address: auctionAddress,
    abi: auctionAbi,
    functionName: "bids",
    args: [bidId!],
    query: {
      enabled: false, // Only fetch when explicitly requested
    },
  });

  const checkBid = async () => {
    if (!fhevmInstance || !address || !bidId) return;

    setIsBidLoading(true);
    try {
      const { publicKey, privateKey } = fhevmInstance.generateKeypair();
      const eip712 = fhevmInstance.createEIP712(publicKey, auctionAddress);
      const { data: bidData } = await refetchBidData();
      if (!bidData) {
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signature = await signTypedDataAsync(eip712 as any);

      // Decrypt price (index 0 in the bid struct array)
      const decryptedPrice = await fhevmInstance.reencrypt(
        bidData[0],
        privateKey,
        publicKey,
        signature,
        auctionAddress,
        address
      );
      setBidPrice(decryptedPrice);

      // Decrypt amount (index 1 in the bid struct array)
      const decryptedAmount = await fhevmInstance.reencrypt(
        bidData[1],
        privateKey,
        publicKey,
        signature,
        auctionAddress,
        address
      );
      setBidAmount(decryptedAmount);

      // Decrypt won amount (index 2 in the bid struct array)
      const decryptedWonAmount = await fhevmInstance.reencrypt(
        bidData[2],
        privateKey,
        publicKey,
        signature,
        auctionAddress,
        address
      );
      console.log(decryptedWonAmount);
      setWonAmount(decryptedWonAmount);
    } catch (error) {
      console.error("Failed to decrypt bid:", error);
    } finally {
      setIsBidLoading(false);
    }
  };

  return {
    bidId,
    bidPrice,
    bidAmount,
    wonAmount,
    isBidLoading,
    checkBid,
  };
}
