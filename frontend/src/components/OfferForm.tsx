import { useState, useEffect } from "react";
import { useChainId } from "wagmi";
import { useMakeOffer, useAcceptOffer, useWithdrawOffer, useAddresses } from "../hooks/useNFTMarket";
import { formatError } from "../utils/formatError";

type OfferTab = "make" | "accept" | "withdraw";

// ---------------------------------------------------------------------------
// Make Offer sub-form
// ---------------------------------------------------------------------------

function MakeOfferForm() {
  const chainId = useChainId();
  const addrs = useAddresses(chainId);
  const { makeOffer, isPending, isConfirmed } = useMakeOffer(chainId);

  const [tokenId, setTokenId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isConfirmed) setDone(true);
  }, [isConfirmed]);

  const handleSubmit = async () => {
    setError("");
    setDone(false);
    try {
      await makeOffer(BigInt(tokenId), amount);
    } catch (e) {
      setError(formatError(e));
    }
  };

  const reset = () => {
    setTokenId("");
    setAmount("");
    setDone(false);
    setError("");
  };

  if (done) {
    return (
      <div>
        <p className="success">Offer of {amount} ETH placed on token #{tokenId}!</p>
        <button onClick={reset} style={{ marginTop: "0.75rem", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
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

      <label>
        Token ID
        <input
          type="number"
          min={1}
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="e.g. 3"
        />
      </label>

      <label>
        Offer amount (ETH)
        <input
          type="number"
          min={0}
          step="0.001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 0.05"
        />
      </label>

      <button
        onClick={handleSubmit}
        disabled={!tokenId || !amount || isPending || !addrs}
      >
        {isPending ? "Confirming..." : "Make Offer"}
      </button>

      {error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Accept Offer sub-form (two-step: approve → acceptOffer)
// ---------------------------------------------------------------------------

function AcceptOfferForm() {
  const chainId = useChainId();
  const addrs = useAddresses(chainId);
  const { approve, acceptOffer, approvePending, acceptPending, isConfirmed } =
    useAcceptOffer(chainId);

  const [tokenId, setTokenId] = useState("");
  const [bidder, setBidder] = useState("");
  const [step, setStep] = useState<"idle" | "approving" | "approved" | "accepting" | "done">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isConfirmed && step === "accepting") setStep("done");
  }, [isConfirmed, step]);

  const handleApprove = async () => {
    setError("");
    setStep("approving");
    try {
      await approve(BigInt(tokenId));
      setStep("approved");
    } catch (e) {
      setStep("idle");
      setError(formatError(e));
    }
  };

  const handleAccept = async () => {
    setError("");
    setStep("accepting");
    try {
      await acceptOffer(BigInt(tokenId), bidder as `0x${string}`);
    } catch (e) {
      setStep("approved");
      setError(formatError(e));
    }
  };

  const reset = () => {
    setTokenId("");
    setBidder("");
    setStep("idle");
    setError("");
  };

  if (step === "done") {
    return (
      <div>
        <p className="success">Offer accepted! Token #{tokenId} transferred to {bidder.slice(0, 6)}...{bidder.slice(-4)}.</p>
        <button onClick={reset} style={{ marginTop: "0.75rem", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
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

      <label>
        Token ID
        <input
          type="number"
          min={1}
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="e.g. 3"
          disabled={step !== "idle"}
        />
      </label>

      <label>
        Bidder address
        <input
          type="text"
          value={bidder}
          onChange={(e) => setBidder(e.target.value)}
          placeholder="0x..."
          disabled={step !== "idle"}
        />
      </label>

      {step === "idle" && (
        <button onClick={handleApprove} disabled={!tokenId || !bidder || !addrs}>
          Step 1: Approve Marketplace
        </button>
      )}

      {step === "approving" && (
        <button disabled>
          {approvePending ? "Waiting for signature..." : "Confirming approval..."}
        </button>
      )}

      {step === "approved" && (
        <button onClick={handleAccept} disabled={!addrs}>
          Step 2: Accept Offer
        </button>
      )}

      {step === "accepting" && (
        <button disabled>
          {acceptPending ? "Waiting for signature..." : "Confirming..."}
        </button>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Withdraw Offer sub-form
// ---------------------------------------------------------------------------

function WithdrawOfferForm() {
  const chainId = useChainId();
  const addrs = useAddresses(chainId);
  const { withdrawOffer, isPending, isConfirmed } = useWithdrawOffer(chainId);

  const [tokenId, setTokenId] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isConfirmed) setDone(true);
  }, [isConfirmed]);

  const handleSubmit = async () => {
    setError("");
    setDone(false);
    try {
      await withdrawOffer(BigInt(tokenId));
    } catch (e) {
      setError(formatError(e));
    }
  };

  const reset = () => {
    setTokenId("");
    setDone(false);
    setError("");
  };

  if (done) {
    return (
      <div>
        <p className="success">Offer on token #{tokenId} withdrawn. ETH reclaimed.</p>
        <button onClick={reset} style={{ marginTop: "0.75rem", background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
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

      <label>
        Token ID
        <input
          type="number"
          min={1}
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          placeholder="e.g. 3"
        />
      </label>

      <button
        onClick={handleSubmit}
        disabled={!tokenId || isPending || !addrs}
      >
        {isPending ? "Confirming..." : "Withdraw Offer"}
      </button>

      {error && <p className="error">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main OfferForm component
// ---------------------------------------------------------------------------

export function OfferForm() {
  const [tab, setTab] = useState<OfferTab>("make");

  return (
    <div className="list-form">
      <h2>Offers</h2>

      <div className="offer-tabs">
        <button
          className={tab === "make" ? "active" : ""}
          onClick={() => setTab("make")}
        >
          Make Offer
        </button>
        <button
          className={tab === "accept" ? "active" : ""}
          onClick={() => setTab("accept")}
        >
          Accept Offer
        </button>
        <button
          className={tab === "withdraw" ? "active" : ""}
          onClick={() => setTab("withdraw")}
        >
          Withdraw Offer
        </button>
      </div>

      <div className="offer-panel">
        {tab === "make" && <MakeOfferForm />}
        {tab === "accept" && <AcceptOfferForm />}
        {tab === "withdraw" && <WithdrawOfferForm />}
      </div>
    </div>
  );
}
