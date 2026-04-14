import { useState, useEffect } from "react";
import { useChainId } from "wagmi";
import { formatEther } from "viem";
import { ipfsToHttp } from "../utils/ipfs";
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
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tokenURIData) return;
    const url = ipfsToHttp(tokenURIData as string);
    fetch(url)
      .then((r) => r.json())
      .then(setMetadata)
      .catch(() => setMetadata(null));
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
        />
      ) : (
        <div className="nft-placeholder">Loading...</div>
      )}

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
