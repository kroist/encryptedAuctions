import { AUCTION_ROUTER } from "../constants";
import { auctionRouterAbi } from "./abi/auctionRouter";

export const auctionRouterConfig = {
  address: AUCTION_ROUTER,
  abi: auctionRouterAbi,
} as const;
