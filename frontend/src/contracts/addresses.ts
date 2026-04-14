/**
 * Contract addresses per network.
 * Populated after running scripts/deploy.ts.
 * Update these values from deployments/<network>.json after each deployment.
 */

export const ADDRESSES = {
  // Sepolia testnet
  11155111: {
    nft: "0x3a5d2721257a26DaBdD6A14b64C0634ffC8dCCD3" as `0x${string}`,
    marketplace: "0xAA5038Faf52ac76EebFaa8C3865D8110B6f9369B" as `0x${string}`,
  },
  // Local Hardhat node
  31337: {
    nft: "" as `0x${string}`,
    marketplace: "" as `0x${string}`,
  },
} as const;

export type SupportedChainId = keyof typeof ADDRESSES;

export function getAddresses(chainId: number) {
  const addrs = ADDRESSES[chainId as SupportedChainId];
  if (!addrs) throw new Error(`Unsupported chain ID: ${chainId}`);
  return addrs;
}
