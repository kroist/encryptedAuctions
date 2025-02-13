import { Link } from "react-router-dom";
import "./ItemList.css";
import { useAuctionAddressList } from "../hooks/auctionAddressList";

export function ItemList() {
  const { data: auctionList } = useAuctionAddressList();

  return (
    <div className="item-list">
      {auctionList?.items.map((item) => (
        <Link to={`/item/${item.address}`} key={item.id} className="item-card">
          <h2 className="item-title">{item.name}</h2>
          <div className="item-content">
            <div className="status-badge">
              <span className={`status status-${item.status.toLowerCase()}`}>
                <span className="status-dot"></span>
                {item.status.replace("_", " ")}
              </span>
            </div>
            <div className="item-info">
              <div className="token-info">
                <span className="token-amount">
                  {item.tokenAmount} {item.tokenName}
                </span>
                <span className="floor-price">Floor: {item.floorPrice}</span>
              </div>
              <div className="bid-info">
                <span className="bid-count">{item.bidCount} sealed bids</span>
              </div>
              <div className="auction-times">
                <div className="time-row">
                  <span className="time-label">Starts:</span>
                  <span className="time-value">{item.startDate}</span>
                </div>
                <div className="time-row">
                  <span className="time-label">Ends:</span>
                  <span className="time-value">{item.endTime}</span>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
