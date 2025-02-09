import { User } from "../types/types";
import { useFhevmInitialization, useFhevmInstance } from "../hooks/fhevmSetup";
import "./Header.css";
import { ConnectButton } from "./ConnectButton";
import { useAccount } from "wagmi";
import { useFhevmReady } from "../hooks/fhevmReady";

interface HeaderProps {
  user: User;
}

export function Header({ user }: HeaderProps) {
  const fhevmReady = useFhevmReady();

  return (
    <header className="header">
      <div className="header-content">
        <h2>Encrypted Auctions</h2>
        {!fhevmReady && <div className="alert">Initializing FHEVM...</div>}
        <div className="user-info">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
