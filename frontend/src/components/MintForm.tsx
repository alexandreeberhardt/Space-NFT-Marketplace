import { useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useAddresses } from "../hooks/useNFTMarket";
import NFT_ABI from "../contracts/abis/SpaceInvaderNFT.json";
import { formatError } from "../utils/formatError";

// In production, these URIs come from scripts/tokenURIs.json after running uploadToIPFS.ts.
// For demo, we use a placeholder.
const PLACEHOLDER_URI = "ipfs://QmPlaceholder/metadata.json";

export function MintForm() {
  const { address } = useAccount();
  const chainId = useChainId();
  const addrs = useAddresses(chainId);
  const publicClient = usePublicClient();

  const [recipient, setRecipient] = useState(address || "");
  const [uri, setUri] = useState(PLACEHOLDER_URI);
  const [error, setError] = useState("");
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [step, setStep] = useState<"idle" | "signing" | "confirming" | "minted">(
    "idle"
  );

  const { writeContractAsync, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash, confirmations: 1 });

  useEffect(() => {
    if (isSuccess) {
      setStep("minted");
    }
  }, [isSuccess]);

  if (!addrs?.nft) {
    return <p>Contracts not deployed on this network.</p>;
  }

  const handleMint = async () => {
    setError("");
    setHash(undefined);
    setStep("signing");
    try {
      if (!publicClient) {
        throw new Error("RPC client unavailable for this network.");
      }
      if (!address) {
        throw new Error("Connect your wallet first.");
      }
      const gas = await publicClient.estimateContractGas({
        account: address,
        address: addrs.nft,
        abi: NFT_ABI,
        functionName: "safeMint",
        args: [recipient, uri],
      });
      const txHash = await writeContractAsync({
        address: addrs.nft,
        abi: NFT_ABI,
        functionName: "safeMint",
        args: [recipient, uri],
        gas: (gas * 120n) / 100n,
      });
      setHash(txHash);
      setStep("confirming");
    } catch (e) {
      setStep("idle");
      setError(formatError(e));
    }
  };

  return (
    <div className="mint-form">
      <h2>Mint NFT</h2>
      <p>Public minting is enabled. You can mint for yourself or gift directly to another wallet.</p>

      <label>
        Recipient
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="0x..."
        />
      </label>

      <label>
        Token URI (IPFS)
        <input
          type="text"
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          placeholder="ipfs://..."
        />
      </label>

      <button onClick={handleMint} disabled={step !== "idle" || !recipient || !uri}>
        {step === "signing" && !hash
          ? "Waiting for signature..."
          : step === "confirming"
            ? "Confirming mint..."
            : step === "minted"
              ? "Minted!"
              : isPending
                ? "Waiting for signature..."
                : "Mint"}
      </button>

      {step === "minted" && <p className="success">NFT minted! Tx: {hash}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
