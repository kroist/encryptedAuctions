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
  name: string;
  description: string;
  seller: string;
  tokenAmount: string;
  tokenType: string;
  floorPrice: string;
  startDate: string;
  endTime: string;
  bidCount: number;
  status: AuctionStatus;
  processingProgress?: number; // percentage from 0 to 100
}
