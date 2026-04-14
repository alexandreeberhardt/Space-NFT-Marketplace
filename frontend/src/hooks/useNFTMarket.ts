import { useState } from "react";
import {
  usePublicClient,
  useReadContract,
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

  const buy = async (tokenId: bigint, price: bigint) => {
    if (!addrs) {
      throw new Error("Contracts not deployed on this network.");
    }
    if (!publicClient) {
      throw new Error("RPC client unavailable for this network.");
    }
    const gas = await publicClient.estimateContractGas({
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
