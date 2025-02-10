import "./Header.css";
import { ConnectButton } from "./ConnectButton";
import { useFhevmReady } from "../hooks/fhevmReady";
import { useUSDCToken } from "../hooks/useUSDCToken";
import { useAccount } from "wagmi";
export function Header() {
  const fhevmReady = useFhevmReady();
  const { address } = useAccount();
  const { balance, isBalanceLoading, mintTokens, isMinting, checkBalance } =
    useUSDCToken(address);
  const handleMint = () => {
    if (!address) return;
    mintTokens(address, BigInt(1000));
  };

  return (
    <header className="header">
      <div className="header-content">
        <h2>Encrypted Auctions</h2>
        {!fhevmReady && <div className="alert">Initializing FHEVM...</div>}
        <div className="user-info">
          <div className="usdc-section">
            <div>
              USDC Balance:{" "}
              {isBalanceLoading ? "Loading..." : balance?.toString() ?? "?"}
              <button
                onClick={checkBalance}
                disabled={isBalanceLoading}
                className="check-balance-btn"
              >
                {isBalanceLoading ? "Checking..." : "Check Balance"}
              </button>
            </div>
            <div className="usdc-mint">
              <button onClick={handleMint} disabled={isMinting || !address}>
                {isMinting ? "Minting..." : "Mint 1000 USDC"}
              </button>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
