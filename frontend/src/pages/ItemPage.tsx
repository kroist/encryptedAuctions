import { useParams, Link } from "react-router-dom";
import { Header } from "../components/Header";
import { PlaceBidButton } from "../components/PlaceBidButton";
import "./ItemPage.css";
import { useEvmConnectionReady } from "../hooks/evmConnectionReady";
import "../styles/forms.css";
import { useAuctionAddressList } from "../hooks/auctionAddressList";

export function ItemPage() {
  const { data: auctionList } = useAuctionAddressList();
  const { address } = useParams();
  const isEvmConnectionReady = useEvmConnectionReady();
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
            </div>
            <PlaceBidButton
              status={item.status}
              processingProgress={item.processingProgress}
              isEvmConnectionReady={isEvmConnectionReady}
              auctionAddress={address as `0x${string}`}
              floorPrice={BigInt(item.floorPrice)}
            />
          </div>
        </div>
      </main>
    </>
  );
}
