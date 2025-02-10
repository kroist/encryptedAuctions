import { useWalletReady } from "./walletReady";
import { useFhevmReady } from "./fhevmReady";

export const useEvmConnectionReady = () => {
  const fhevmReady = useFhevmReady();
  const walletReady = useWalletReady();
  return fhevmReady && walletReady;
};
