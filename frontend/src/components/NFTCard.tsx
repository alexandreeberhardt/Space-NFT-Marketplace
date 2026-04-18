import { useState, useEffect } from "react";
import { useChainId } from "wagmi";
import { formatEther } from "viem";
import { ipfsToHttp, fetchWithGatewayFallback } from "../utils/ipfs";
import { formatError } from "../utils/formatError";
import { useBuyNFT, useTokenURI } from "../hooks/useNFTMarket";

interface Metadata {
  name: string;
  image: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

interface NFTCardProps {
  tokenId: bigint;
  seller?: string;
  price?: bigint;
  active?: boolean;
  onPurchased?: () => void;
}

export function NFTCard({ tokenId, seller, price, active = false, onPurchased }: NFTCardProps) {
  const chainId = useChainId();
  const { buy, isPending, isConfirmed } = useBuyNFT(chainId);
  const { data: tokenURIData } = useTokenURI(tokenId, chainId);

  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [imgError, setImgError] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tokenURIData) return;
    setMetaLoading(true);
    fetchWithGatewayFallback(tokenURIData as string)
      .then((r) => r.json())
      .then((data) => { setMetadata(data); setMetaLoading(false); })
      .catch(() => setMetaLoading(false));
  }, [tokenURIData]);

  useEffect(() => {
    if (isConfirmed && onPurchased) onPurchased();
  }, [isConfirmed, onPurchased]);

  const handleBuy = async () => {
    setError("");
    try {
      await buy(tokenId, price!);
    } catch (e) {
      setError(formatError(e));
    }
  };

  return (
    <div className="nft-card">
      {metadata?.image ? (
        <img
          src={ipfsToHttp(metadata.image)}
          alt={metadata.name || `Space Invader #${tokenId}`}
          onError={(e) => {
            const img = e.currentTarget;
            const idx = parseInt(img.dataset.gwIdx || "0") + 1;
            if (idx < 4) {
              img.dataset.gwIdx = String(idx);
              img.src = ipfsToHttp(metadata.image, idx);
            } else {
              setImgError(true);
            }
          }}
        />
      ) : (
        <div className="nft-placeholder">{metaLoading ? "Loading..." : "No image"}</div>
      )}
      {imgError && <div className="nft-placeholder">Image unavailable</div>}

      <div className="nft-info">
        <h3>{metadata?.name || `Space Invader #${tokenId}`}</h3>

        {active && price !== undefined ? (
          <p className="price">{formatEther(price)} ETH</p>
        ) : (
          <p className="price not-listed">Not listed</p>
        )}

        {active && seller && (
          <p className="seller">
            Seller: {seller.slice(0, 6)}...{seller.slice(-4)}
          </p>
        )}

        {metadata?.attributes && (
          <div className="attributes">
            {metadata.attributes.map((a) => (
              <span key={a.trait_type} className="trait">
                {a.trait_type}: {a.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {active && price !== undefined && (
        <button
          onClick={handleBuy}
          disabled={isPending || isConfirmed}
          className="buy-btn"
        >
          {isPending ? "Confirming..." : isConfirmed ? "Purchased!" : "Buy Now"}
        </button>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
