import { useEffect, useState } from "react";
import { useTokenMinting } from "../../hooks/useTokenMinting";

interface TokenMintingStepProps {
  myAddress: `0x${string}`;
  tokenAddress: string | null;
  onComplete: (amount: bigint) => void;
  isExpanded: boolean;
  stepNumber: number;
}

export function TokenMintingStep({
  myAddress,
  tokenAddress,
  onComplete,
  isExpanded,
  stepNumber,
}: TokenMintingStepProps) {
  const [mintAmount, setMintAmount] = useState(0n);
  const { error, isLoading, isSuccess, mintTokens } =
    useTokenMinting(tokenAddress);

  // Effect to call onComplete when tokens are minted

  useEffect(() => {
    if (isSuccess && mintAmount && !isLoading) {
      console.log("Minted tokens", mintAmount);
      onComplete(mintAmount);
    }
  }, [isSuccess, tokenAddress, isLoading, onComplete, mintTokens, mintAmount]);

  if (!isExpanded) {
    return (
      <div className="step-summary">
        <h3>Step {stepNumber}: Token Minting</h3>
        {isSuccess ? (
          <div className="step-status success">Minted {mintAmount} tokens</div>
        ) : (
          <div className="step-status">
            {!tokenAddress ? "Waiting for token creation" : "Not started"}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="step-content">
      <h2>Step {stepNumber}: Mint Tokens</h2>
      {error && <div className="error-message">{error}</div>}
      {tokenAddress && (
        <div className="token-info">
          Token address: {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
        </div>
      )}
      <div className="form-group">
        <label htmlFor="mintAmount">Amount to Mint</label>
        <input
          id="mintAmount"
          type="number"
          value={mintAmount.toString()}
          onChange={(e) => setMintAmount(BigInt(e.target.value))}
          placeholder="Enter amount to mint"
          disabled={isLoading || !tokenAddress}
        />
      </div>
      <button
        className="action-button"
        onClick={() => mintTokens(myAddress!, mintAmount)}
        disabled={isLoading || !tokenAddress || !mintAmount}
      >
        {isLoading ? "Minting..." : "Mint Tokens"}
      </button>
    </div>
  );
}
