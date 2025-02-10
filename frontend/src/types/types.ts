export interface User {
  address: string;
  balance: string;
}

export enum AuctionStatus {
  NotStarted = "NOT_STARTED",
  ActiveBidding = "ACTIVE_BIDDING",
  Processing = "PROCESSING",
  Ended = "ENDED",
}

export interface Item {
  id: number;
  address: `0x${string}`;
  name: string;
  seller: `0x${string}`;
  tokenAmount: string;
  tokenAddress: string;
  tokenName: string;
  floorPrice: string;
  startDate: string;
  endTime: string;
  bidCount: number;
  status: AuctionStatus;
  processingProgress?: number; // percentage from 0 to 100
}
