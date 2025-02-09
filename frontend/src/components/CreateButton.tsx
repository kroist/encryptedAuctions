import { useEvmConnectionReady } from "../hooks/evmConnectionReady";
import { useNavigate } from "react-router-dom";
import "./CreateButton.css";

export function CreateButton() {
  const isEvmConnectionReady = useEvmConnectionReady();
  const navigate = useNavigate();

  return (
    <button
      className="create-button"
      onClick={() => navigate("/create-auction")}
      disabled={!isEvmConnectionReady}
    >
      <span className="plus-icon">+</span>
      <span className="button-text">Create Auction</span>
    </button>
  );
}
