import { useState, useCallback } from "react";
import { useChainId } from "wagmi";
import { useListing, useTotalSupply } from "../hooks/useNFTMarket";
import { NFTCard } from "./NFTCard";

function TokenRow({
  tokenId,
  onPurchased,
}: {
  tokenId: bigint;
  onPurchased: () => void;
}) {
  const chainId = useChainId();
  const { data } = useListing(tokenId, chainId);

  if (!data) return null;
  const [seller, price, active] = data as [string, bigint, boolean];

  return (
    <NFTCard
      tokenId={tokenId}
      seller={seller}
      price={price}
      active={active}
      onPurchased={onPurchased}
    />
  );
}

export function Gallery() {
  const chainId = useChainId();
  const { data: totalSupply, refetch } = useTotalSupply(chainId);
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePurchased = useCallback(() => {
    refetch();
    setRefreshKey((k) => k + 1);
  }, [refetch]);

  const total = totalSupply ? Number(totalSupply) : 0;

  if (total === 0) {
    return (
      <div className="gallery-empty">
        <p>No NFTs found. Make sure the contracts are deployed and NFTs are minted.</p>
      </div>
    );
  }

  return (
    <div className="gallery" key={refreshKey}>
      <h2>NFT Collection</h2>
      <div className="nft-grid">
        {Array.from({ length: total }, (_, i) => (
          <TokenRow
            key={i + 1}
            tokenId={BigInt(i + 1)}
            onPurchased={handlePurchased}
          />
        ))}
      </div>
    </div>
  );
}
