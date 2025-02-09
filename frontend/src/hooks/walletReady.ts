import { useWalletInfo } from "@reown/appkit/react";

export const useWalletReady = () => {
  const { walletInfo } = useWalletInfo();
  if (!walletInfo) {
    return false;
  }
  return true;
};
