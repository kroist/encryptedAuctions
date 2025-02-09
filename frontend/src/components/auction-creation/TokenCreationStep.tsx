import { useState, useEffect } from "react";
import { useTokenCreation } from "../../hooks/useTokenCreation";

interface TokenCreationStepProps {
  onComplete: (tokenAddress: `0x${string}`) => void;
  isExpanded: boolean;
  stepNumber: number;
}

export function TokenCreationStep({
  onComplete,
  isExpanded,
  stepNumber,
}: TokenCreationStepProps) {
  const [tokenName, setTokenName] = useState("");
  const { error, isLoading, isSuccess, tokenAddress, createToken } =
    useTokenCreation();

  useEffect(() => {
    if (isSuccess && tokenAddress && !isLoading) {
      onComplete(tokenAddress);
    }
  }, [isSuccess, tokenAddress, isLoading, onComplete]);

  if (!isExpanded) {
    return (
      <div className="step-summary">
        <h3>Step {stepNumber}: Token Creation</h3>
        {tokenAddress ? (
          <div className="step-status success">
            Created token: {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
          </div>
        ) : (
          <div className="step-status">Not started</div>
        )}
      </div>
    );
  }

  return (
    <div className="step-content">
      <h2>Step {stepNumber}: Create Token</h2>
      {error && <div className="error-message">{error}</div>}
      <div className="form-group">
        <label htmlFor="tokenName">Token Name</label>
        <input
          id="tokenName"
          type="text"
          value={tokenName}
          onChange={(e) => setTokenName(e.target.value)}
          placeholder="Enter token name"
          disabled={isLoading}
        />
      </div>
      <button
        className="action-button"
        onClick={() => createToken(tokenName)}
        disabled={isLoading || !tokenName}
      >
        {isLoading ? "Creating..." : "Create Token"}
      </button>
    </div>
  );
}
