import { useEffect } from "react";
import { useTokenApproval } from "../../hooks/useTokenApproval";

interface TokenApprovalStepProps {
  tokenAddress: `0x${string}` | null;
  mintedAmount: bigint | null;
  auctionAddress: `0x${string}` | null;
  onComplete: () => void;
  isExpanded: boolean;
  stepNumber: number;
}

export function TokenApprovalStep({
  tokenAddress,
  mintedAmount,
  auctionAddress,
  onComplete,
  isExpanded,
  stepNumber,
}: TokenApprovalStepProps) {
  const { error, isLoading, isSuccess, approveToken } = useTokenApproval({
    tokenAddress,
    tokenAmount: mintedAmount,
    auctionAddress,
  });
  console.log(isSuccess, isLoading, error);

  useEffect(() => {
    if (isSuccess && !isLoading) {
      onComplete();
    }
  }, [isSuccess, isLoading, onComplete]);

  if (!isExpanded) {
    return (
      <div className="step-summary">
        <h3>Step {stepNumber}: Token Approval</h3>
        {tokenAddress ? (
          <div className="step-status success">
            Approved token: {tokenAddress.slice(0, 6)}...
            {tokenAddress.slice(-4)}
          </div>
        ) : (
          <div className="step-status">Not started</div>
        )}
      </div>
    );
  }

  return (
    <div className="step-content">
      <h2>Step {stepNumber}: Approve Token</h2>
      {error && <div className="error-message">{error}</div>}
      <button
        className="action-button"
        onClick={() => approveToken()}
        disabled={isLoading}
      >
        {isLoading ? "Approving..." : "Approve Token"}
      </button>
    </div>
  );
}
