import { createConfig, http } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";
import { walletConnect, injected } from "wagmi/connectors";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo";

export const wagmiConfig = createConfig({
  chains: [sepolia, hardhat],
  connectors: [
    injected(), // MetaMask / browser wallet
    walletConnect({ projectId }),
  ],
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_SEPOLIA_RPC_URL || undefined, {
      batch: true,
    }),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  pollingInterval: 4000,
});

export { sepolia, hardhat };
