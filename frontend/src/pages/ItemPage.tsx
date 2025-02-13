import { useParams, Link } from "react-router-dom";
import { Header } from "../components/Header";
import { PlaceBidButton } from "../components/PlaceBidButton";
import "./ItemPage.css";
import { useEvmConnectionReady } from "../hooks/evmConnectionReady";
import "../styles/forms.css";
import { useAuctionAddressList } from "../hooks/auctionAddressList";
import { useUserBid } from "../hooks/useUserBid";
import { useClaimWinnings } from "../hooks/useClaimWinnings";
import { useAccount } from "wagmi";

export function ItemPage() {
  const { data: auctionList } = useAuctionAddressList();
  const { address } = useParams();
  const { address: myAddress } = useAccount();
  const isEvmConnectionReady = useEvmConnectionReady();
  const { bidId, bidPrice, bidAmount, wonAmount, isBidLoading, checkBid } =
    useUserBid(address as `0x${string}`);
  const item = auctionList?.items.find((item) => item.address === address);

  if (!item) {
    return <div>Item not found</div>;
  }

  return (
    <>
      <Header />
      <main className="item-page">
        <Link to="/" className="back-button">
          ← Back to Items
        </Link>
        <div className="item-container">
          <div className="item-details">
            <h1>{item.name}</h1>
            <div className="status-badge">
              <span className={`status status-${item.status.toLowerCase()}`}>
                <span className="status-dot"></span>
                {item.status.replace("_", " ")}
              </span>
            </div>
            <div className="info-grid">
              <div className="info-section">
                <h3>Token Details</h3>
                <div className="info-item">
                  <span className="label">Amount</span>
                  <span className="value">
                    {item.tokenAmount} {item.tokenName}
                  </span>
                </div>
                <div className="info-item">
                  <span className="label">Floor Price</span>
                  <span className="value">{item.floorPrice}</span>
                </div>
              </div>

              <div className="info-section">
                <h3>Auction Details</h3>
                <div className="info-item">
                  <span className="label">Seller</span>
                  <span className="value">{item.seller}</span>
                </div>
                <div className="info-item">
                  <span className="label">Start Time</span>
                  <span className="value">{item.startDate}</span>
                </div>
                <div className="info-item">
                  <span className="label">End Time</span>
                  <span className="value">{item.endTime}</span>
                </div>
                <div className="info-item">
                  <span className="label">Sealed Bids</span>
                  <span className="value">{item.bidCount}</span>
                </div>
              </div>

              {bidId !== undefined && bidId !== 0n && (
                <div className="info-section">
                  <h3>Your Bid</h3>
                  {bidPrice !== null && bidAmount !== null ? (
                    <>
                      <div className="info-item">
                        <span className="label">Amount</span>
                        <span className="value">{bidAmount.toString()}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">Price</span>
                        <span className="value">{bidPrice.toString()}</span>
                      </div>
                      {item.status === "ENDED" && wonAmount !== null && (
                        <div className="info-item">
                          <span className="label">Won Amount</span>
                          <span className="value">{wonAmount.toString()}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={checkBid}
                      disabled={isBidLoading}
                      className="action-button"
                    >
                      {isBidLoading ? "Loading..." : "Show Bid"}
                    </button>
                  )}
                </div>
              )}
            </div>
            {item.status === "ENDED" &&
              ((bidId !== null && bidId !== 0n) ||
                myAddress === item.seller) && (
                <ClaimWinningsButton
                  auctionAddress={address as `0x${string}`}
                  auctionCreator={item.seller}
                />
              )}
            <PlaceBidButton
              status={item.status}
              processingProgress={item.processingProgress}
              isEvmConnectionReady={isEvmConnectionReady}
              auctionAddress={address as `0x${string}`}
              isCreator={item.seller === myAddress}
              floorPrice={BigInt(item.floorPrice)}
              bidIsPlaced={bidId !== undefined && bidId !== 0n}
            />
          </div>
        </div>
      </main>
    </>
  );
}

function ClaimWinningsButton({
  auctionAddress,
  auctionCreator,
}: {
  auctionAddress: `0x${string}`;
  auctionCreator: `0x${string}`;
}) {
  const { claim, hasClaimed, isClaimPending, isCreator } = useClaimWinnings(
    auctionAddress,
    auctionCreator
  );

  if (hasClaimed) {
    return null;
  }

  return (
    <button onClick={claim} disabled={isClaimPending} className="action-button">
      {isClaimPending
        ? "Claiming..."
        : isCreator
        ? "Claim Payments"
        : "Claim Winnings"}
    </button>
  );
}
