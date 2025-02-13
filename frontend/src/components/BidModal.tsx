import { useState, useEffect, useCallback } from "react";
import { usePlaceBid } from "../hooks/usePlaceBid";
import "./BidModal.css";
import "../styles/forms.css";

interface BidModalProps {
  isOpen: boolean;
  onClose: () => void;
  auctionAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  floorPrice: bigint;
}

export function BidModal({
  isOpen,
  onClose,
  auctionAddress,
  tokenAddress,
  floorPrice,
}: BidModalProps) {
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    error,
    isLoading,
    isSuccess,
    approvalSuccess,
    placeBid,
    approveToken,
  } = usePlaceBid({
    auctionAddress,
    tokenAddress,
    approveAmount: BigInt(amount) * BigInt(price),
  });

  const handleClose = useCallback(() => {
    setAmount("");
    setPrice("");
    setValidationError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isSuccess) {
      handleClose();
      // reload the page
      window.location.reload();
    }
  }, [isSuccess, handleClose]);

  if (!isOpen) return null;

  const handleApprove = () => {
    approveToken();
  };

  const handlePlaceBid = () => {
    setValidationError(null);

    try {
      const amountBigInt = BigInt(amount);
      const priceBigInt = BigInt(price);

      if (priceBigInt < floorPrice) {
        setValidationError(`Price must be at least ${floorPrice}`);
        return;
      }

      placeBid(amountBigInt, priceBigInt);
    } catch (error) {
      console.error(error);
      setValidationError("Please enter valid numbers");
    }
  };

  return (
    <div className="bid-modal-overlay" onClick={handleClose}>
      <div className="bid-modal" onClick={(e) => e.stopPropagation()}>
        <button className="bid-modal-close" onClick={handleClose}>
          ×
        </button>
        <h2>Place Your Bid</h2>
        <form
          className="bid-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!approvalSuccess) {
              handleApprove();
            } else {
              handlePlaceBid();
            }
          }}
        >
          <div className="form-group">
            <label htmlFor="amount">Amount of Tokens</label>
            <input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              disabled={isLoading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="price">Target Price</label>
            <input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={`Minimum ${floorPrice}`}
              disabled={isLoading}
            />
          </div>

          {(error || validationError) && (
            <div className="error-message">
              <p>{validationError || error}</p>
            </div>
          )}

          <div className="bid-form-actions">
            {!approvalSuccess ? (
              <button
                type="submit"
                className="action-button"
                disabled={isLoading || !amount}
              >
                {isLoading ? "Approving..." : "Approve Tokens"}
              </button>
            ) : (
              <button
                type="submit"
                className="action-button"
                disabled={isLoading || !amount || !price}
              >
                {isLoading ? "Placing Bid..." : "Place Bid"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
