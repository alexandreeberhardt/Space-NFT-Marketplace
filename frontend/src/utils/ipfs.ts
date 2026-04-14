const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";
const IPFS_IO_GATEWAY = "https://ipfs.io/ipfs/";

/**
 * Converts an ipfs:// URI to an HTTP URL using the Pinata gateway.
 * Falls back to ipfs.io for non-Pinata CIDs.
 */
export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `${PINATA_GATEWAY}${uri.slice(7)}`;
  }
  if (uri.startsWith("https://")) {
    return uri;
  }
  return `${IPFS_IO_GATEWAY}${uri}`;
}
