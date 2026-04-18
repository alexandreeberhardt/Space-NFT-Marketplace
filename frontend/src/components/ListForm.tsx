import { useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";
import { useAddresses, useNFTData } from "../hooks/useNFTMarket";
import NFT_ABI from "../contracts/abis/SpaceInvaderNFT.json";
import MARKET_ABI from "../contracts/abis/SpaceMarketplace.json";
import { formatError } from "../utils/formatError";

export function ListForm() {
  const { address } = useAccount();
  const chainId = useChainId();
  const addrs = useAddresses(chainId);
  const publicClient = usePublicClient();

  const { ownedUnlisted } = useNFTData(chainId);
  const [tokenId, setTokenId] = useState("");
  const [price, setPrice] = useState("");
  const [step, setStep] = useState<"idle" | "approving" | "approved" | "listing" | "listed">("idle");
  const [error, setError] = useState("");
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [listHash, setListHash] = useState<`0x${string}` | undefined>();

  // Separate write hooks for approve and list
  const { writeContractAsync: writeApprove, isPending: approvePending } = useWriteContract();
  const { writeContractAsync: writeList, isPending: listPending } = useWriteContract();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
  const { isSuccess: listConfirmed } = useWaitForTransactionReceipt({ hash: listHash, confirmations: 1 });

  // Advance step when approve tx is confirmed
  useEffect(() => {
    if (approveConfirmed && step === "approving") {
      setStep("approved");
    }
  }, [approveConfirmed, step]);

  // Advance step when list tx is confirmed
  useEffect(() => {
    if (listConfirmed && step === "listing") {
      setStep("listed");
    }
  }, [listConfirmed, step]);

  const handleApprove = async () => {
    if (!addrs || !tokenId) return;
    setError("");
    setApproveHash(undefined);
    setStep("approving");
    try {
      if (!publicClient) {
        throw new Error("RPC client unavailable for this network.");
      }
      if (!address) {
        throw new Error("Connect your wallet first.");
      }

      let currentOwner: `0x${string}`;
      try {
        currentOwner = (await publicClient.readContract({
          address: addrs.nft,
          abi: NFT_ABI,
          functionName: "ownerOf",
          args: [BigInt(tokenId)],
        })) as `0x${string}`;
      } catch {
        throw new Error("This token does not exist on the current network.");
      }

      if (currentOwner.toLowerCase() !== address.toLowerCase()) {
        throw new Error("You do not own this NFT.");
      }

      const approvedAddress = (await publicClient.readContract({
        address: addrs.nft,
        abi: NFT_ABI,
        functionName: "getApproved",
        args: [BigInt(tokenId)],
      })) as `0x${string}`;
      if (approvedAddress.toLowerCase() === addrs.marketplace.toLowerCase()) {
        setStep("approved");
        return;
      }

      const gas = await publicClient.estimateContractGas({
        account: address,
        address: addrs.nft,
        abi: NFT_ABI,
        functionName: "approve",
        args: [addrs.marketplace, BigInt(tokenId)],
      });
      const hash = await writeApprove({
        address: addrs.nft,
        abi: NFT_ABI,
        functionName: "approve",
        args: [addrs.marketplace, BigInt(tokenId)],
        gas: (gas * 120n) / 100n,
      });
      setApproveHash(hash);
    } catch (e) {
      setStep("idle");
      setError(formatError(e));
    }
  };

  const handleList = async () => {
    if (!addrs || !tokenId || !price) return;
    setError("");
    setListHash(undefined);
    setStep("listing");
    try {
      if (!publicClient) {
        throw new Error("RPC client unavailable for this network.");
      }
      if (!address) {
        throw new Error("Connect your wallet first.");
      }
      const gas = await publicClient.estimateContractGas({
        account: address,
        address: addrs.marketplace,
        abi: MARKET_ABI,
        functionName: "listNFT",
        args: [addrs.nft, BigInt(tokenId), parseEther(price)],
      });
      const hash = await writeList({
        address: addrs.marketplace,
        abi: MARKET_ABI,
        functionName: "listNFT",
        args: [addrs.nft, BigInt(tokenId), parseEther(price)],
        gas: (gas * 120n) / 100n,
      });
      setListHash(hash);
    } catch (e) {
      setStep("approved");
      setError(formatError(e));
    }
  };

  const reset = () => {
    setStep("idle");
    setTokenId("");
    setPrice("");
    setError("");
    setApproveHash(undefined);
    setListHash(undefined);
  };

  return (
    <div className="list-form">
      <h2>List an NFT</h2>

      {ownedUnlisted.length > 0 && step === "idle" && (
        <div className="nft-hints">
          <span>Your unlisted NFTs:</span>
          {ownedUnlisted.map((id) => (
            <button key={id.toString()} className="hint-chip" onClick={() => setTokenId(id.toString())}>
              #{id.toString()}
            </button>
          ))}
        </div>
      )}

      <label>
        Token ID
        <input
          type="number"
          min={1}
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="e.g. 1"
          disabled={step !== "idle"}
        />
      </label>

      <label>
        Price (ETH)
        <input
          type="number"
          min={0}
          step="0.001"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 0.05"
          disabled={step === "listed"}
        />
      </label>

      {step === "idle" && (
        <button onClick={handleApprove} disabled={!tokenId || !addrs}>
          Step 1: Approve Marketplace
        </button>
      )}

      {step === "approving" && (
        <button disabled>
          {!approveHash && approvePending ? "Waiting for signature..." : "Confirming approval..."}
        </button>
      )}

      {step === "approved" && (
        <button onClick={handleList} disabled={!price}>
          Step 2: List NFT
        </button>
      )}

      {step === "listing" && (
        <button disabled>
          {!listHash && listPending ? "Waiting for signature..." : "Confirming listing..."}
        </button>
      )}

      {step === "listed" && (
        <>
          <p className="success">NFT #{tokenId} listed for {price} ETH!</p>
          <button onClick={reset} style={{ marginTop: "0.75rem", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            List another
          </button>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
