import { type CSSProperties, useState } from "react";
import "./PlaceBidButton.css";
import { BidModal } from "./BidModal";
import { USDC_ADDRESS } from "../lib/constants";

interface PlaceBidButtonProps {
  status: string;
  processingProgress?: number;
  isEvmConnectionReady: boolean;
  auctionAddress: `0x${string}`;
  floorPrice: bigint;
  isCreator?: boolean;
  bidIsPlaced?: boolean;
}

export function PlaceBidButton({
  status,
  processingProgress = 0,
  isEvmConnectionReady,
  auctionAddress,
  floorPrice,
  isCreator = false,
  bidIsPlaced = false,
}: PlaceBidButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        className="bid-button"
        disabled={
          status !== "ACTIVE_BIDDING" ||
          !isEvmConnectionReady ||
          bidIsPlaced ||
          isCreator
        }
        onClick={() => setIsModalOpen(true)}
        title={
          status === "NOT_STARTED"
            ? "Auction has not started yet"
            : status === "PROCESSING"
            ? "Auction is being processed"
            : status === "ENDED"
            ? "Auction has ended"
            : bidIsPlaced
            ? "You have already placed a bid"
            : ""
        }
      >
        {status === "ACTIVE_BIDDING" ? (
          "Place Bid"
        ) : status === "NOT_STARTED" ? (
          "Not Started"
        ) : status === "PROCESSING" ? (
          <>
            Processing {processingProgress}%
            <div
              className="progress-bar"
              style={
                {
                  "--progress": `${processingProgress}%`,
                } as CSSProperties
              }
            />
          </>
        ) : (
          "Auction Ended"
        )}
      </button>

      <BidModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        auctionAddress={auctionAddress}
        tokenAddress={USDC_ADDRESS}
        floorPrice={floorPrice}
      />
    </>
  );
}
