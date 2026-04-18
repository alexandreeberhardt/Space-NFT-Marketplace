const GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
];

export function ipfsToHttp(uri: string, gatewayIndex = 0): string {
  if (!uri) return "";
  const gw = GATEWAYS[gatewayIndex % GATEWAYS.length];
  if (uri.startsWith("ipfs://")) return `${gw}${uri.slice(7)}`;
  if (uri.startsWith("https://")) return uri;
  return `${gw}${uri}`;
}

export async function fetchWithGatewayFallback(uri: string): Promise<Response> {
  const cid = uri.startsWith("ipfs://") ? uri.slice(7) : uri;
  for (const gw of GATEWAYS) {
    try {
      const res = await fetch(`${gw}${cid}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return res;
    } catch {}
  }
  throw new Error(`Failed to fetch ${uri} from all gateways`);
}
