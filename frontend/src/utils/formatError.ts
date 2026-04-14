/**
 * Converts viem/wagmi contract errors into user-friendly messages.
 */
export function formatError(error: unknown): string {
  if (!error) return "Unknown error";

  const msg = (error as { message?: string; shortMessage?: string }).shortMessage
    || (error as { message?: string }).message
    || String(error);

  // User rejected
  if (msg.includes("User rejected") || msg.includes("4001")) {
    return "Transaction cancelled.";
  }
  // Insufficient funds
  if (msg.includes("insufficient funds")) {
    return "Insufficient ETH balance.";
  }
  if (msg.includes("gas limit too high")) {
    return "Wallet/RPC rejected the gas limit. Retry after reconnecting the wallet or switching network.";
  }
  if (
    msg.includes("ownerOf") ||
    msg.includes("ERC721NonexistentToken") ||
    msg.includes("invalid token ID")
  ) {
    return "This token does not exist on the current network.";
  }
  // Custom contract errors
  if (msg.includes("IncorrectETHAmount")) {
    return "The price has changed. Please refresh and try again.";
  }
  if (msg.includes("NotListed")) {
    return "This NFT is no longer listed for sale.";
  }
  if (msg.includes("AlreadyListed")) {
    return "This NFT is already listed.";
  }
  if (msg.includes("NotNFTOwner")) {
    return "You do not own this NFT.";
  }
  if (msg.includes("MarketplaceNotApproved")) {
    return "Please approve the marketplace to transfer your NFT first.";
  }
  // Generic
  return msg.slice(0, 120);
}
