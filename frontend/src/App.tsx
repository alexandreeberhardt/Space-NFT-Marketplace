import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { ConnectButton } from "./components/ConnectButton";
import { Gallery } from "./components/Gallery";
import { ListForm } from "./components/ListForm";
import { MintForm } from "./components/MintForm";
import { OfferForm } from "./components/OfferForm";
import { sepolia } from "./wagmi.config";
import "./App.css";

type Tab = "gallery" | "list" | "offers" | "mint";

export default function App() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [tab, setTab] = useState<Tab>("gallery");

  const isWrongNetwork = isConnected && chainId !== sepolia.id && chainId !== 31337;

  return (
    <div className="app">
      <header>
        <div className="header-inner">
          <h1>Space Invader NFT</h1>
          <ConnectButton />
        </div>
      </header>

      {isWrongNetwork && (
        <div className="network-warning">
          Please switch to Sepolia testnet or local Hardhat network.
        </div>
      )}

      {isConnected && !isWrongNetwork && (
        <nav className="tabs">
          <button
            className={tab === "gallery" ? "active" : ""}
            onClick={() => setTab("gallery")}
          >
            Gallery
          </button>
          <button
            className={tab === "list" ? "active" : ""}
            onClick={() => setTab("list")}
          >
            List NFT
          </button>
          <button
            className={tab === "offers" ? "active" : ""}
            onClick={() => setTab("offers")}
          >
            Offers
          </button>
          <button
            className={tab === "mint" ? "active" : ""}
            onClick={() => setTab("mint")}
          >
            Mint
          </button>
        </nav>
      )}

      <main>
        {!isConnected && (
          <div className="welcome">
            <p>Insert coin - connect your wallet to enter the arcade.</p>
          </div>
        )}

        {isConnected && !isWrongNetwork && tab === "gallery" && <Gallery />}
        {isConnected && !isWrongNetwork && tab === "list" && <ListForm />}
        {isConnected && !isWrongNetwork && tab === "offers" && <OfferForm />}
        {isConnected && !isWrongNetwork && tab === "mint" && <MintForm />}
      </main>

      <footer>
        <p>Space Invader NFT Marketplace - IFT-4100/7100</p>
        {address && (
          <p className="footer-address">
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        )}
      </footer>
    </div>
  );
}
