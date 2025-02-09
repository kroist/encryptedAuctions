import { useReadContract, useReadContracts } from "wagmi";
import { auctionRouterConfig } from "../lib/contracts/auctionRouter";
import { useQuery } from "@tanstack/react-query";
import { auctionAbi } from "../lib/contracts/abi/auction";

export const useAuctionAddressList = () => {
  const { data: auctionCount } = useReadContract({
    ...auctionRouterConfig,
    functionName: "auctionCount",
  });

  const count = auctionCount ? Number(auctionCount) : 0;
  const contracts = Array.from({ length: count }, (_, i) => ({
    ...auctionRouterConfig,
    functionName: "auctions",
    args: [BigInt(i)],
  }));

  const { data: queriedAddresses } = useReadContracts({
    contracts,
  });

  const addresses = queriedAddresses?.map(
    (result) => result.result as `0x${string}`
  );

  const contractsCreated = addresses?.map((address) => {
    return {
      address,
      abi: auctionAbi,
      functionName: "auctionCreated",
    };
  });

  const { data: created } = useReadContracts({
    contracts: contractsCreated,
    query: {
      enabled: addresses !== undefined,
    },
  });

  return useQuery({
    queryKey: ["auction-address-list"],
    queryFn: () => {
      return { addresses, created };
    },
    staleTime: Infinity,
    gcTime: Infinity,
    enabled:
      auctionCount !== undefined &&
      addresses !== undefined &&
      created !== undefined,
  });
};
