import { useAuctionDeployment } from "../../hooks/useAuctionDeployment";
import "./AuctionCreationSteps.css";
import { useEffect } from "react";

interface Props {
  onComplete: (auctionAddress: `0x${string}`) => void;
  isExpanded: boolean;
  stepNumber: number;
}

export function AuctionDeploymentStep({
  onComplete,
  isExpanded,
  stepNumber,
}: Props) {
  const { error, isLoading, isSuccess, auctionAddress, deployAuction } =
    useAuctionDeployment();

  const handleDeploy = async () => {
    await deployAuction();
  };

  useEffect(() => {
    if (isSuccess && auctionAddress && !isLoading) {
      onComplete(auctionAddress);
    }
  }, [isSuccess, auctionAddress, isLoading, onComplete]);

  return (
    <div className="step-summary">
      <h3>Step {stepNumber}: Auction Deployment</h3>

      {isExpanded && (
        <div className="step-content">
          {error && <div className="error-message">{error}</div>}

          {isSuccess && auctionAddress ? (
            <div className="success-message">
              Auction deployed at: {auctionAddress}
            </div>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={isLoading}
              className="action-button"
            >
              {isLoading ? "Deploying..." : "Deploy Auction"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
