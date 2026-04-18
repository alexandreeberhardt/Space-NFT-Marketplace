import { useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { useAddresses } from "../hooks/useNFTMarket";
import NFT_ABI from "../contracts/abis/SpaceInvaderNFT.json";
import { formatError } from "../utils/formatError";
import { generateInvaderCanvas, canvasToBlob } from "../utils/generateInvader";
import { pinFile, pinJSON, isSeedAlreadyMinted } from "../utils/pinataUpload";

type Step = "idle" | "generating" | "uploading" | "signing" | "confirming" | "minted";

export function MintForm() {
  const { address } = useAccount();
  const chainId = useChainId();
  const addrs = useAddresses(chainId);
  const publicClient = usePublicClient();

  const [seedInput, setSeedInput] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [hash, setHash] = useState<string | undefined>();
  const [mintedTokenId, setMintedTokenId] = useState<bigint | null>(null);

  const { writeContractAsync } = useWriteContract();

  const seed = parseInt(seedInput, 10);
  const seedValid = seedInput !== "" && !isNaN(seed) && seed >= 0 && seed <= 10000;

  useEffect(() => {
    if (!seedValid) { setPreview(null); return; }
    setPreview(generateInvaderCanvas(seed).toDataURL("image/png"));
  }, [seed, seedValid]);

  const handleMint = async () => {
    if (!seedValid || !address || !addrs?.nft || !publicClient) return;
    setError("");
    setHash(undefined);
    setMintedTokenId(null);

    try {
      setStep("generating");
      const alreadyMinted = await isSeedAlreadyMinted(seed);
      if (alreadyMinted) throw new Error(`Seed ${seed} has already been minted.`);

      const blob = await canvasToBlob(generateInvaderCanvas(seed));

      setStep("uploading");
      const imageCid = await pinFile(blob, `space-invader-seed-${seed}.png`);
      const metaCid = await pinJSON(
        {
          name: `Space Invader #${seed}`,
          description: `A procedurally generated Space Invader NFT. Seed: ${seed}.`,
          image: `ipfs://${imageCid}`,
          attributes: [{ trait_type: "Seed", value: seed }],
        },
        `space-invader-metadata-seed-${seed}`
      );
      const uri = `ipfs://${metaCid}`;

      setStep("signing");
      const txHash = await writeContractAsync({
        address: addrs.nft,
        abi: NFT_ABI,
        functionName: "safeMint",
        args: [address, uri],
      });
      setHash(txHash);

      setStep("confirming");
      await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });

      const supply = await publicClient.readContract({
        address: addrs.nft,
        abi: NFT_ABI,
        functionName: "totalSupply",
      });
      setMintedTokenId(supply as bigint);
      setStep("minted");
    } catch (e) {
      setStep("idle");
      setError(formatError(e));
    }
  };

  const stepLabel: Record<Step, string> = {
    idle: "Mint",
    generating: "Generating image...",
    uploading: "Uploading to IPFS...",
    signing: "Waiting for signature...",
    confirming: "Confirming on-chain...",
    minted: "Minted!",
  };

  if (!addrs?.nft) return <p>Contracts not deployed on this network.</p>;

  return (
    <div className="mint-form">
      <h2>Mint NFT</h2>
      <p>Enter a seed (0–10 000) to generate your unique Space Invader.</p>

      <label>
        Seed
        <input
          type="number"
          min={0}
          max={10000}
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          placeholder="0 – 10 000"
          disabled={step !== "idle"}
        />
      </label>

      {preview && (
        <div className="mint-preview">
          <img src={preview} alt={`Space Invader seed ${seed}`} />
          <span>Seed {seed}</span>
        </div>
      )}

      <button onClick={handleMint} disabled={!seedValid || step !== "idle"}>
        {stepLabel[step]}
      </button>

      {step === "minted" && (
        <p className="success">
          NFT minted! Token ID: {mintedTokenId?.toString() ?? "?"}. Tx: {hash}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
