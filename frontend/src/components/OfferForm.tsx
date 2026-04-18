import { useState, useEffect } from "react";
import { formatEther, parseEther } from "viem";
import { useChainId, useAccount, useReadContract, useWaitForTransactionReceipt } from "wagmi";
import { useMakeOffer, useAcceptOffer, useWithdrawOffer, useAddresses, useNFTData, useOffersOnMyNFTs, saveCachedOffer } from "../hooks/useNFTMarket";
import MARKET_ABI from "../contracts/abis/SpaceMarketplace.json";
import { formatError } from "../utils/formatError";

type Step = "idle" | "signing" | "confirming" | "done" | "error";

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Make Offer
// ---------------------------------------------------------------------------

function MakeOfferForm() {
  const chainId = useChainId();
  const addrs = useAddresses(chainId);
  const { makeOffer, hash, isPending, isConfirmed } = useMakeOffer(chainId);
  const { allTokenIds, ownedTokenIds } = useNFTData(chainId);
  const { address } = useAccount();
  const ownedSet = new Set(ownedTokenIds.map((id) => id.toString()));
  const otherTokenIds = allTokenIds.filter((id) => !ownedSet.has(id.toString()));

  const [tokenId, setTokenId] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");

  const busy = step === "signing" || step === "confirming";

  useEffect(() => {
    if (isConfirmed && step === "confirming" && address && chainId && tokenId && amount) {
      saveCachedOffer({ chainId, tokenId, bidder: address, amount: parseEther(amount).toString() });
      setStep("done");
    }
  }, [isConfirmed, step]);

  const handleSubmit = async () => {
    setError("");
    setStep("signing");
    try {
      await makeOffer(BigInt(tokenId), amount);
      setStep("confirming");
    } catch (e) {
      setStep("error");
      setError(formatError(e));
    }
  };

  if (step === "done") {
    return (
      <div>
        <p className="success">
          Offer of {amount} ETH placed on token #{tokenId}!
        </p>
        <p className="form-hint">Tx: {hash ? shortHash(hash) : "—"}</p>
        <button
          onClick={() => { setStep("idle"); setTokenId(""); setAmount(""); }}
          style={{ marginTop: "0.75rem", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          Make another offer
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="form-hint">
        Place an ETH offer on any token (listed or not). The ETH is held by the contract until accepted or withdrawn.
      </p>

      {otherTokenIds.length > 0 && !busy && (
        <div className="nft-hints">
          <span>Available tokens:</span>
          {otherTokenIds.map((id) => (
            <button key={id.toString()} className="hint-chip" onClick={() => setTokenId(id.toString())}>
              #{id.toString()}
            </button>
          ))}
        </div>
      )}

      <label>
        Token ID
        <input type="number" min={1} value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="e.g. 3" disabled={busy} />
      </label>

      <label>
        Offer amount (ETH)
        <input type="number" min={0} step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 0.05" disabled={busy} />
      </label>

      <button onClick={handleSubmit} disabled={!tokenId || !amount || busy || !addrs}>
        {step === "signing" && !hash ? "Waiting for signature..." : step === "confirming" || isPending ? "Confirming on-chain..." : "Make Offer"}
      </button>

      {step === "error" && error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accept Offer (two-step: approve → acceptOffer)
// ---------------------------------------------------------------------------

function AcceptOfferForm() {
  const chainId = useChainId();
  const addrs = useAddresses(chainId);
  const { approve, acceptOffer, approvePending, acceptPending } = useAcceptOffer(chainId);
  const { offers, loading, fetchError } = useOffersOnMyNFTs(chainId);

  const [tokenId, setTokenId] = useState("");
  const [bidder, setBidder] = useState("");
  const [step, setStep] = useState<"idle" | "approving" | "approved" | "accepting" | "done">("idle");
  const [error, setError] = useState("");
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
  const [acceptHash, setAcceptHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: acceptConfirmed } = useWaitForTransactionReceipt({ hash: acceptHash, confirmations: 1 });

  const isValidBidder = bidder.startsWith("0x") && bidder.length === 42;
  const isValidToken = tokenId !== "" && !isNaN(Number(tokenId));

  const { data: offerAmount } = useReadContract({
    address: addrs?.marketplace,
    abi: MARKET_ABI,
    functionName: "offers",
    args: addrs && isValidToken && isValidBidder
      ? [addrs.nft, BigInt(tokenId), bidder as `0x${string}`]
      : undefined,
    query: { enabled: !!addrs && isValidToken && isValidBidder && step === "idle" },
  });

  const liveAmount = offerAmount as bigint | undefined;
  const offerExists = liveAmount !== undefined && liveAmount > 0n;

  useEffect(() => {
    if (approveConfirmed && step === "approving") setStep("approved");
  }, [approveConfirmed, step]);

  const handleApprove = async () => {
    setError("");
    if (!offerExists) {
      setError("No offer found from this bidder on this token. Verify the token ID and bidder address.");
      return;
    }
    setApproveHash(undefined);
    setStep("approving");
    try {
      const txHash = await approve(BigInt(tokenId));
      setApproveHash(txHash);
    } catch (e) {
      setStep("idle");
      setError(formatError(e));
    }
  };

  const handleAccept = async () => {
    setError("");
    setAcceptHash(undefined);
    setStep("accepting");
    try {
      const txHash = await acceptOffer(BigInt(tokenId), bidder as `0x${string}`);
      setAcceptHash(txHash);
    } catch (e) {
      setStep("approved");
      setError(formatError(e));
    }
  };

  useEffect(() => {
    if (acceptConfirmed && step === "accepting") setStep("done");
  }, [acceptConfirmed, step]);

  if (step === "done" && acceptConfirmed) {
    return (
      <div>
        <p className="success">
          Offer accepted! Token #{tokenId} transferred to {bidder.slice(0, 6)}...{bidder.slice(-4)}.
        </p>
        <p className="form-hint">Tx: {acceptHash ? shortHash(acceptHash) : "—"}</p>
        <button
          onClick={() => { setStep("idle"); setTokenId(""); setBidder(""); setError(""); setApproveHash(undefined); setAcceptHash(undefined); }}
          style={{ marginTop: "0.75rem", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          Accept another offer
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="form-hint">
        Accept an ETH offer from a specific bidder. You must own the token and approve the marketplace first.
      </p>

      {step === "idle" && (
        <div style={{ marginBottom: "1rem" }}>
          {loading && <p className="form-hint" style={{ color: "var(--text-muted)" }}>Loading offers...</p>}
          {!loading && fetchError && (
            <p className="error" style={{ fontSize: "0.8rem" }}>Failed to load offers: {fetchError.slice(0, 120)}</p>
          )}
          {!loading && !fetchError && offers.length === 0 && (
            <p className="form-hint" style={{ color: "var(--text-muted)" }}>No pending offers on your NFTs.</p>
          )}
          {!loading && offers.length > 0 && (
            <div className="offer-table-wrapper">
            <table className="offer-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Amount</th>
                  <th>Bidder</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={`${o.tokenId}-${o.bidder}`}>
                    <td>#{o.tokenId.toString()}</td>
                    <td>{formatEther(o.amount)} ETH</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {o.bidder.slice(0, 8)}...{o.bidder.slice(-6)}
                    </td>
                    <td>
                      <button
                        className="hint-chip"
                        onClick={() => { setTokenId(o.tokenId.toString()); setBidder(o.bidder); }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      <label>
        Token ID
        <input type="number" min={1} value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="e.g. 3" disabled={step !== "idle"} />
      </label>

      <label>
        Bidder address
        <input type="text" value={bidder} onChange={(e) => setBidder(e.target.value)} placeholder="0x..." disabled={step !== "idle"} />
      </label>

      {step === "idle" && isValidToken && isValidBidder && (
        <p className="form-hint" style={{ color: offerExists ? "var(--success, #4caf50)" : "var(--text-muted)" }}>
          {offerExists ? `Offer found: ${formatEther(liveAmount!)} ETH` : "No offer found from this bidder."}
        </p>
      )}

      {step === "idle" && (
        <button onClick={handleApprove} disabled={!tokenId || !bidder || !addrs}>
          Step 1 — Approve Marketplace
        </button>
      )}
      {step === "approving" && (
        <button disabled>
          {!approveHash ? "Waiting for signature..." : "Confirming approval..."}
        </button>
      )}
      {step === "approved" && (
        <>
          <p className="success" style={{ marginBottom: "0.5rem" }}>Marketplace approved.</p>
          <button onClick={handleAccept} disabled={!addrs}>
            Step 2 — Accept Offer
          </button>
        </>
      )}
      {step === "accepting" && (
        <button disabled>
          {acceptPending ? "Waiting for signature..." : "Confirming on-chain..."}
        </button>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Withdraw Offer
// ---------------------------------------------------------------------------

function WithdrawOfferForm() {
  const chainId = useChainId();
  const addrs = useAddresses(chainId);
  const { withdrawOffer, hash, isPending, isConfirmed } = useWithdrawOffer(chainId);
  const { userOffers } = useNFTData(chainId);

  const [tokenId, setTokenId] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");

  const busy = step === "signing" || step === "confirming";

  useEffect(() => {
    if (isConfirmed && step === "confirming") setStep("done");
  }, [isConfirmed, step]);

  const handleSubmit = async () => {
    setError("");
    setStep("signing");
    try {
      await withdrawOffer(BigInt(tokenId));
      setStep("confirming");
    } catch (e) {
      setStep("error");
      setError(formatError(e));
    }
  };

  if (step === "done") {
    return (
      <div>
        <p className="success">Offer on token #{tokenId} withdrawn. ETH reclaimed!</p>
        <p className="form-hint">Tx: {hash ? shortHash(hash) : "—"}</p>
        <button
          onClick={() => { setStep("idle"); setTokenId(""); setError(""); }}
          style={{ marginTop: "0.75rem", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          Withdraw another offer
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="form-hint">
        Withdraw your pending offer on a token and reclaim the ETH.
      </p>

      {userOffers.length > 0 && !busy && (
        <div className="nft-hints">
          <span>Your pending offers:</span>
          {userOffers.map(({ tokenId: id, amount }) => (
            <button key={id.toString()} className="hint-chip" onClick={() => setTokenId(id.toString())}>
              #{id.toString()} ({formatEther(amount!)} ETH)
            </button>
          ))}
        </div>
      )}
      {userOffers.length === 0 && !busy && (
        <p className="form-hint" style={{ color: "var(--text-muted)" }}>No pending offers found.</p>
      )}

      <label>
        Token ID
        <input type="number" min={1} value={tokenId} onChange={(e) => setTokenId(e.target.value)} placeholder="e.g. 3" disabled={busy} />
      </label>

      <button onClick={handleSubmit} disabled={!tokenId || busy || !addrs}>
        {step === "signing" && !hash ? "Waiting for signature..." : step === "confirming" || isPending ? "Confirming on-chain..." : "Withdraw Offer"}
      </button>

      {step === "error" && error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main OfferForm
// ---------------------------------------------------------------------------

type OfferTab = "make" | "accept" | "withdraw";

export function OfferForm() {
  const [tab, setTab] = useState<OfferTab>("make");

  return (
    <div className="list-form">
      <h2>Offers</h2>

      <div className="offer-tabs">
        <button className={tab === "make" ? "active" : ""} onClick={() => setTab("make")}>Make Offer</button>
        <button className={tab === "accept" ? "active" : ""} onClick={() => setTab("accept")}>Accept Offer</button>
        <button className={tab === "withdraw" ? "active" : ""} onClick={() => setTab("withdraw")}>Withdraw Offer</button>
      </div>

      <div className="offer-panel">
        {tab === "make" && <MakeOfferForm />}
        {tab === "accept" && <AcceptOfferForm />}
        {tab === "withdraw" && <WithdrawOfferForm />}
      </div>
    </div>
  );
}
