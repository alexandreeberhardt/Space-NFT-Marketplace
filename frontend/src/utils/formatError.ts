/**
 * Converts viem/wagmi contract errors into user-friendly messages.
 */
export function formatError(error: unknown): string {
  if (!error) return "Unknown error";

  const e = error as any;

  // Dig into viem's nested error structure for custom error names
  const errorName: string | undefined =
    e?.cause?.data?.errorName ??
    e?.data?.errorName ??
    e?.cause?.cause?.data?.errorName;

  if (errorName) {
    if (errorName === "NoOfferFromBidder") return "No offer from this bidder on this token.";
    if (errorName === "NoOfferToWithdraw") return "No offer found for this token.";
    if (errorName === "NotNFTOwner") return "You do not own this NFT.";
    if (errorName === "MarketplaceNotApproved") return "Please approve the marketplace to transfer your NFT first.";
    if (errorName === "NotListed") return "This NFT is no longer listed for sale.";
    if (errorName === "AlreadyListed") return "This NFT is already listed.";
    if (errorName === "IncorrectETHAmount") return "The price has changed. Please refresh and try again.";
    return `Contract error: ${errorName}`;
  }

  const msg = e.shortMessage || e.message || String(error);

  // User rejected
  if (msg.includes("User rejected") || msg.includes("4001")) {
    return "Transaction cancelled.";
  }
  // Insufficient funds
  if (msg.includes("insufficient funds")) {
    return "Insufficient ETH balance.";
  }
  if (msg.includes("NoOfferToWithdraw")) {
    return "No offer found for this token. Check the token ID and make sure you placed an offer.";
  }
  if (msg.includes("NoOfferFromBidder")) {
    return "No offer from this bidder on this token.";
  }
  if (msg.includes("gas limit too high")) {
    return "Transaction would fail on-chain (wrong token ID or no offer found).";
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
