/* eslint-disable @typescript-eslint/no-explicit-any */
import { useReadContract, useReadContracts } from "wagmi";
import { auctionRouterConfig } from "../lib/contracts/auctionRouter";
import { useQuery } from "@tanstack/react-query";
import { auctionAbi } from "../lib/contracts/abi/auction";
import { tokenAbi } from "../lib/contracts/abi/token";
import { AuctionStatus, Item } from "../types/types";

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

  // Fetch item details for each auction
  const itemContracts = addresses?.map((address) => {
    return {
      address,
      abi: auctionAbi,
      functionName: "auctionData",
    };
  });

  const { data: itemDetails } = useReadContracts({
    contracts: itemContracts,
    query: {
      enabled: addresses !== undefined,
    },
  });
  // Fetch token names for each auction
  const tokenContracts = itemDetails
    ?.map((detail) => {
      if (!detail.result || !Array.isArray(detail.result)) return null;
      const tokenAddress = detail.result[0] as `0x${string}`;
      return {
        address: tokenAddress,
        abi: tokenAbi,
        functionName: "name",
      };
    })
    .filter(
      (contract): contract is NonNullable<typeof contract> => contract !== null
    );

  const { data: tokenNames } = useReadContracts({
    contracts: tokenContracts,
    query: {
      enabled: itemDetails !== undefined,
    },
  });

  return useQuery({
    queryKey: ["auction-address-list"],
    queryFn: () => {
      if (!addresses || !created || !itemDetails || !tokenNames)
        return { addresses: [], created: [], items: [] };

      const items: Item[] = [];
      console.log("addresses", addresses.length);
      for (let i = 0; i < addresses.length; i++) {
        if (!created[i].result) continue;
        const auctionData = itemDetails[i].result as any;
        const startDate = new Date(Number((auctionData[5] as bigint) * 1000n));
        const endDate = new Date(Number((auctionData[6] as bigint) * 1000n));
        const currentTime = new Date();
        const bidCount = Number(auctionData[7]) - 1;
        const bidsProcessed = Number(auctionData[8]) - 1;

        let status = AuctionStatus.NotStarted;

        if (startDate <= currentTime) {
          if (currentTime < endDate) {
            status = AuctionStatus.ActiveBidding;
          } else {
            if (bidCount < bidsProcessed) {
              status = AuctionStatus.Processing;
            } else {
              status = AuctionStatus.Ended;
            }
          }
        }

        const item: Item = {
          id: i,
          address: addresses[i],
          name: `Auction ${i}`,
          seller: auctionData[12],
          tokenAmount: auctionData[1],
          tokenAddress: auctionData[0],
          tokenName: tokenNames?.[i]?.result
            ? String(tokenNames[i].result)
            : "Unknown Token",
          floorPrice: auctionData[4],
          startDate: startDate.toISOString(),
          endTime: endDate.toISOString(),
          bidCount,
          status,
        };
        items.push(item);
      }

      return { addresses, created, items };
    },
    staleTime: Infinity,
    gcTime: Infinity,
    enabled:
      auctionCount !== undefined &&
      addresses !== undefined &&
      created !== undefined &&
      itemDetails !== undefined &&
      tokenNames !== undefined,
  });
};
