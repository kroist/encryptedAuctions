import { useState } from "react";
import {
  useAuctionCreation,
  type AuctionConfig,
} from "../../hooks/useAuctionCreation";

interface AuctionConfigStepProps {
  tokenAddress: `0x${string}` | null;
  mintedAmount: bigint | null;
  auctionAddress: `0x${string}` | null;
  onComplete: () => void;
  isExpanded: boolean;
  stepNumber: number;
}

export function AuctionConfigStep({
  tokenAddress,
  mintedAmount,
  auctionAddress,
  onComplete,
  isExpanded,
  stepNumber,
}: AuctionConfigStepProps) {
  const [config, setConfig] = useState<AuctionConfig>({
    startTime: "",
    endTime: "",
    floorPrice: 0n,
  });

  const { error, isLoading, isSuccess, createAuction } = useAuctionCreation({
    tokenAddress,
    tokenAmount: mintedAmount,
    auctionAddress,
  });

  // Effect to call onComplete when auction is created
  if (isSuccess && !isLoading) {
    onComplete();
  }

  const handleInputChange =
    (field: keyof AuctionConfig) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setConfig((prev) => ({
        ...prev,
        [field]: e.target.value,
      }));
    };

  if (!isExpanded) {
    return (
      <div className="step-summary">
        <h3>Step {stepNumber}: Auction Configuration</h3>
        {isSuccess ? (
          <div className="step-status success">
            Auction created successfully
          </div>
        ) : (
          <div className="step-status">
            {!tokenAddress
              ? "Waiting for token creation"
              : !mintedAmount
              ? "Waiting for token minting"
              : "Not started"}
          </div>
        )}
      </div>
    );
  }

  const now = new Date();
  const minStartTime = now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
  const minEndTime = config.startTime
    ? new Date(config.startTime).toISOString().slice(0, 16)
    : minStartTime;

  return (
    <div className="step-content">
      <h2>Step {stepNumber}: Configure Auction</h2>
      {error && <div className="error-message">{error}</div>}
      {tokenAddress && mintedAmount && auctionAddress && (
        <>
          <div className="token-info">
            Token: {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
            <br />
            Amount: {mintedAmount} tokens
            <br />
            Auction: {auctionAddress.slice(0, 6)}...{auctionAddress.slice(-4)}
          </div>
          <div className="form-group">
            <label htmlFor="startTime">Start Time</label>
            <input
              id="startTime"
              type="datetime-local"
              value={config.startTime}
              onChange={handleInputChange("startTime")}
              min={minStartTime}
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="endTime">End Time</label>
            <input
              id="endTime"
              type="datetime-local"
              value={config.endTime}
              onChange={handleInputChange("endTime")}
              min={minEndTime}
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="floorPrice">Floor Price (ETH)</label>
            <input
              id="floorPrice"
              type="number"
              step="0.01"
              value={config.floorPrice.toString()}
              onChange={handleInputChange("floorPrice")}
              placeholder="Enter floor price in ETH"
              disabled={isLoading}
            />
          </div>
          <button
            className="action-button"
            onClick={() => createAuction(config)}
            disabled={
              isLoading ||
              !config.startTime ||
              !config.endTime ||
              !config.floorPrice
            }
          >
            {isLoading ? "Creating..." : "Create Auction"}
          </button>
        </>
      )}
    </div>
  );
}
