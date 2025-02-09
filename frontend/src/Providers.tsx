import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { PropsWithChildren } from "react";
import { WagmiProvider } from "wagmi";
import { WALLETCONNECT_PROJECT_ID } from "./lib/constants";
import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { sepolia } from "@reown/appkit/networks";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const projectId = WALLETCONNECT_PROJECT_ID;
const networks = [sepolia];

const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
});

createAppKit({
  adapters: [wagmiAdapter],
  /* @ts-expect-error msg */
  networks,
  projectId,
  features: {
    analytics: false,
    swaps: false,
    onramp: false,
    receive: false,
    send: false,
    socials: false,
    email: false,
  },
  enableCoinbase: false,
});

export function Providers({ children }: PropsWithChildren) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
