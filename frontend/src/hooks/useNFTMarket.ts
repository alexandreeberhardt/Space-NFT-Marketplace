import { useState, useMemo } from "react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";
import { getAddresses } from "../contracts/addresses";
import NFT_ABI from "../contracts/abis/SpaceInvaderNFT.json";
import MARKET_ABI from "../contracts/abis/SpaceMarketplace.json";

export function useAddresses(chainId: number | undefined) {
  if (!chainId) return null;
  try {
    const addrs = getAddresses(chainId);
    if (!addrs.nft || !addrs.marketplace) {
      return null;
    }
    return addrs;
  } catch {
    return null;
  }
}

export interface Listing {
  seller: string;
  price: bigint;
  active: boolean;
}

/** Fetch a single listing by tokenId */
export function useListing(tokenId: bigint, chainId: number | undefined) {
  const addrs = useAddresses(chainId);
  return useReadContract({
    address: addrs?.marketplace,
    abi: MARKET_ABI,
    functionName: "listings",
    args: addrs ? [addrs.nft, tokenId] : undefined,
    query: { enabled: !!addrs?.marketplace },
  });
}

/** Fetch tokenURI for a given tokenId */
export function useTokenURI(tokenId: bigint, chainId: number | undefined) {
  const addrs = useAddresses(chainId);
  return useReadContract({
    address: addrs?.nft,
    abi: NFT_ABI,
    functionName: "tokenURI",
    args: [tokenId],
    query: { enabled: !!addrs?.nft },
  });
}

/** Fetch total supply */
export function useTotalSupply(chainId: number | undefined) {
  const addrs = useAddresses(chainId);
  return useReadContract({
    address: addrs?.nft,
    abi: NFT_ABI,
    functionName: "totalSupply",
    query: { enabled: !!addrs?.nft },
  });
}

/**
 * Reads ownership, listings and offers for all tokens in one multicall batch.
 * Returns:
 *   ownedUnlisted  — token IDs owned by user and not currently listed
 *   ownedTokenIds  — all token IDs owned by user
 *   userOffers     — { tokenId, amount } where user has a pending offer
 *   allTokenIds    — every minted token ID (1..totalSupply)
 */
export function useNFTData(chainId: number | undefined) {
  const addrs = useAddresses(chainId);
  const { address } = useAccount();

  const { data: supplyData } = useTotalSupply(chainId);
  const total = supplyData ? Number(supplyData as bigint) : 0;

  const tokenIds = useMemo(
    () => Array.from({ length: total }, (_, i) => BigInt(i + 1)),
    [total]
  );

  const ownerOfCalls = useMemo(
    () =>
      tokenIds.map((id) => ({
        address: addrs?.nft as `0x${string}`,
        abi: NFT_ABI as any,
        functionName: "ownerOf" as const,
        args: [id],
      })),
    [tokenIds, addrs?.nft]
  );

  const listingCalls = useMemo(
    () =>
      tokenIds.map((id) => ({
        address: addrs?.marketplace as `0x${string}`,
        abi: MARKET_ABI as any,
        functionName: "listings" as const,
        args: [addrs?.nft, id],
      })),
    [tokenIds, addrs]
  );

  const offerCalls = useMemo(
    () =>
      tokenIds.map((id) => ({
        address: addrs?.marketplace as `0x${string}`,
        abi: MARKET_ABI as any,
        functionName: "offers" as const,
        args: [addrs?.nft, id, address],
      })),
    [tokenIds, addrs, address]
  );

  const { data: ownerData } = useReadContracts({
    contracts: ownerOfCalls,
    query: { enabled: !!addrs && total > 0 },
  });

  const { data: listingData } = useReadContracts({
    contracts: listingCalls,
    query: { enabled: !!addrs && total > 0 },
  });

  const { data: offerData } = useReadContracts({
    contracts: offerCalls,
    query: { enabled: !!addrs && !!address && total > 0 },
  });

  const ownedTokenIds = useMemo(() => {
    if (!ownerData || !address) return [];
    return tokenIds.filter((_, i) => {
      const r = ownerData[i];
      return r?.status === "success" && (r.result as string).toLowerCase() === address.toLowerCase();
    });
  }, [ownerData, tokenIds, address]);

  const ownedUnlisted = useMemo(() => {
    if (!listingData) return ownedTokenIds;
    return ownedTokenIds.filter((id) => {
      const idx = tokenIds.indexOf(id);
      const r = listingData[idx];
      const listing = r?.result as { active: boolean } | undefined;
      return !listing?.active;
    });
  }, [ownedTokenIds, listingData, tokenIds]);

  const userOffers = useMemo(() => {
    if (!offerData) return [];
    return tokenIds
      .map((id, i) => ({ tokenId: id, amount: offerData[i]?.result as bigint | undefined }))
      .filter((o) => o.amount && o.amount > 0n);
  }, [offerData, tokenIds]);

  return { ownedUnlisted, ownedTokenIds, userOffers, allTokenIds: tokenIds };
}

export interface OfferInfo {
  tokenId: bigint;
  bidder: `0x${string}`;
  amount: bigint;
}

const OFFER_CACHE_KEY = "space-nft-offers";

interface CachedOffer {
  chainId: number;
  tokenId: string;
  bidder: string;
  amount: string;
}

export function saveCachedOffer(offer: CachedOffer) {
  try {
    const existing: CachedOffer[] = JSON.parse(localStorage.getItem(OFFER_CACHE_KEY) || "[]");
    const key = `${offer.chainId}-${offer.tokenId}-${offer.bidder.toLowerCase()}`;
    const filtered = existing.filter(
      (o) => `${o.chainId}-${o.tokenId}-${o.bidder.toLowerCase()}` !== key
    );
    localStorage.setItem(OFFER_CACHE_KEY, JSON.stringify([...filtered, offer]));
  } catch {}
}

/**
 * Returns active offers on NFTs owned by the current user.
 * Reads bidder/tokenId from localStorage (saved when making offers),
 * then verifies live amounts on-chain via multicall.
 */
export function useOffersOnMyNFTs(chainId: number | undefined) {
  const addrs = useAddresses(chainId);
  const { ownedTokenIds } = useNFTData(chainId);

  const cachedOffers = useMemo(() => {
    if (!chainId) return [];
    try {
      const all: CachedOffer[] = JSON.parse(localStorage.getItem(OFFER_CACHE_KEY) || "[]");
      const ownedSet = new Set(ownedTokenIds.map((id) => id.toString()));
      return all.filter((o) => o.chainId === chainId && ownedSet.has(o.tokenId));
    } catch {
      return [];
    }
  }, [chainId, ownedTokenIds]);

  const verificationCalls = useMemo(
    () =>
      cachedOffers.map((o) => ({
        address: addrs?.marketplace as `0x${string}`,
        abi: MARKET_ABI as any,
        functionName: "offers" as const,
        args: [addrs?.nft, BigInt(o.tokenId), o.bidder as `0x${string}`],
      })),
    [cachedOffers, addrs]
  );

  const { data: amounts } = useReadContracts({
    contracts: verificationCalls,
    query: { enabled: !!addrs && cachedOffers.length > 0 },
  });

  const offers = useMemo<OfferInfo[]>(() => {
    return cachedOffers
      .map((o, i) => ({
        tokenId: BigInt(o.tokenId),
        bidder: o.bidder as `0x${string}`,
        amount: amounts ? ((amounts[i]?.result as bigint) ?? 0n) : BigInt(o.amount),
      }))
      .filter((o) => o.amount > 0n);
  }, [cachedOffers, amounts]);

  return { offers, loading: false, fetchError: null };
}

/** Buy NFT hook: returns { buy, hash, isPending, isConfirmed } */
export function useBuyNFT(chainId: number | undefined) {
  const addrs = useAddresses(chainId);
  const publicClient = usePublicClient();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { writeContractAsync, isPending } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  });

  const { address } = useAccount();
  const buy = async (tokenId: bigint, price: bigint) => {
    if (!addrs) {
      throw new Error("Contracts not deployed on this network.");
    }
    if (!publicClient) {
      throw new Error("RPC client unavailable for this network.");
    }
    const gas = await publicClient.estimateContractGas({
      account: address,
      address: addrs.marketplace,
      abi: MARKET_ABI,
      functionName: "buyNFT",
      args: [addrs.nft, tokenId],
      value: price,
    });
    const txHash = await writeContractAsync({
      address: addrs.marketplace,
      abi: MARKET_ABI,
      functionName: "buyNFT",
      args: [addrs.nft, tokenId],
      value: price,
      gas: (gas * 120n) / 100n,
    });
    setHash(txHash);
    return txHash;
  };

  return { buy, hash, isPending, isConfirmed };
}

/** Approve + List NFT hook */
export function useListNFT(chainId: number | undefined) {
  const addrs = useAddresses(chainId);
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { writeContractAsync, isPending } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  });

  const approve = async (tokenId: bigint) => {
    if (!addrs) {
      throw new Error("Contracts not deployed on this network.");
    }
    const txHash = await writeContractAsync({
      address: addrs.nft,
      abi: NFT_ABI,
      functionName: "approve",
      args: [addrs.marketplace, tokenId],
    });
    setHash(txHash);
    return txHash;
  };

  const list = async (tokenId: bigint, priceEth: string) => {
    if (!addrs) {
      throw new Error("Contracts not deployed on this network.");
    }
    const txHash = await writeContractAsync({
      address: addrs.marketplace,
      abi: MARKET_ABI,
      functionName: "listNFT",
      args: [addrs.nft, tokenId, parseEther(priceEth)],
    });
    setHash(txHash);
    return txHash;
  };

  return { approve, list, hash, isPending, isConfirmed };
}

/** Make an ETH offer on any NFT (listed or not) */
export function useMakeOffer(chainId: number | undefined) {
  const addrs = useAddresses(chainId);
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { writeContractAsync, isPending } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  });

  const makeOffer = async (tokenId: bigint, amountEth: string) => {
    if (!addrs) throw new Error("Contracts not deployed on this network.");
    const txHash = await writeContractAsync({
      address: addrs.marketplace,
      abi: MARKET_ABI,
      functionName: "makeOffer",
      args: [addrs.nft, tokenId],
      value: parseEther(amountEth),
    });
    setHash(txHash);
    return txHash;
  };

  return { makeOffer, hash, isPending, isConfirmed };
}

/** Approve + accept an offer from a specific bidder */
export function useAcceptOffer(chainId: number | undefined) {
  const addrs = useAddresses(chainId);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { writeContractAsync: writeApprove, isPending: approvePending } = useWriteContract();
  const { writeContractAsync: writeAccept, isPending: acceptPending } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  });

  const approve = async (tokenId: bigint) => {
    if (!addrs || !publicClient || !address)
      throw new Error("Wallet not connected.");
    const gas = await publicClient.estimateContractGas({
      account: address,
      address: addrs.nft,
      abi: NFT_ABI,
      functionName: "approve",
      args: [addrs.marketplace, tokenId],
    });
    const txHash = await writeApprove({
      address: addrs.nft,
      abi: NFT_ABI,
      functionName: "approve",
      args: [addrs.marketplace, tokenId],
      gas: (gas * 120n) / 100n,
    });
    setHash(txHash);
    return txHash;
  };

  const acceptOffer = async (tokenId: bigint, bidder: `0x${string}`) => {
    if (!addrs || !publicClient || !address)
      throw new Error("Wallet not connected.");
    const gas = await publicClient.estimateContractGas({
      account: address,
      address: addrs.marketplace,
      abi: MARKET_ABI,
      functionName: "acceptOffer",
      args: [addrs.nft, tokenId, bidder],
    });
    const txHash = await writeAccept({
      address: addrs.marketplace,
      abi: MARKET_ABI,
      functionName: "acceptOffer",
      args: [addrs.nft, tokenId, bidder],
      gas: (gas * 120n) / 100n,
    });
    setHash(txHash);
    return txHash;
  };

  return { approve, acceptOffer, hash, approvePending, acceptPending, isConfirmed };
}

/** Withdraw a previously made offer and reclaim ETH */
export function useWithdrawOffer(chainId: number | undefined) {
  const addrs = useAddresses(chainId);
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const { writeContractAsync, isPending } = useWriteContract();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  });

  const withdrawOffer = async (tokenId: bigint) => {
    if (!addrs) throw new Error("Contracts not deployed on this network.");
    const txHash = await writeContractAsync({
      address: addrs.marketplace,
      abi: MARKET_ABI,
      functionName: "withdrawOffer",
      args: [addrs.nft, tokenId],
      gas: 100000n,
    });
    setHash(txHash);
    return txHash;
  };

  return { withdrawOffer, hash, isPending, isConfirmed };
}
