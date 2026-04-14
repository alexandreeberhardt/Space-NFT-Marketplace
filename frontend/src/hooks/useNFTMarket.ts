import { useState } from "react";
import {
  useAccount,
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
    });
    setHash(txHash);
    return txHash;
  };

  return { withdrawOffer, hash, isPending, isConfirmed };
}
