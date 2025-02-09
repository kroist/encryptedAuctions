import { useParams, Link } from "react-router-dom";
import { Header } from "../components/Header";
import { mockUser, mockItems } from "../mock/data";
import "./ItemPage.css";
import { useEvmConnectionReady } from "../hooks/evmConnectionReady";
import "../styles/forms.css";

export function ItemPage() {
  const { id } = useParams();
  const isEvmConnectionReady = useEvmConnectionReady();
  const item = mockItems.find((item) => item.id === Number(id));

  if (!item) {
    return <div>Item not found</div>;
  }

  return (
    <>
      <Header user={mockUser} />
      <main className="item-page">
        <Link to="/" className="back-button">
          ← Back to Items
        </Link>
        <div className="item-container">
          <div className="item-details">
            <h1>{item.name}</h1>
            <p className="description">{item.description}</p>
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
                    {item.tokenAmount} {item.tokenType}
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
            <button
              className="bid-button"
              disabled={
                item.status !== "ACTIVE_BIDDING" || !isEvmConnectionReady
              }
              title={
                item.status === "NOT_STARTED"
                  ? "Auction has not started yet"
                  : item.status === "PROCESSING"
                  ? "Auction is being processed"
                  : item.status === "ENDED"
                  ? "Auction has ended"
                  : ""
              }
            >
              {item.status === "ACTIVE_BIDDING" ? (
                "Place Bid"
              ) : item.status === "NOT_STARTED" ? (
                "Not Started"
              ) : item.status === "PROCESSING" ? (
                <>
                  Processing {item.processingProgress}%
                  <div
                    className="progress-bar"
                    style={
                      {
                        "--progress": `${item.processingProgress}%`,
                      } as React.CSSProperties
                    }
                  />
                </>
              ) : (
                "Auction Ended"
              )}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
