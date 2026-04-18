# Space Invader NFT - Frontend

React + Vite + wagmi v2 frontend for the Space Invader NFT Marketplace.

## Prerequisites

- Node.js v22 LTS
- A browser wallet (MetaMask recommended)
- Sepolia ETH for transactions

## Setup

```bash
cd frontend
cp .env.example .env
# Fill in VITE_SEPOLIA_RPC_URL and VITE_WALLETCONNECT_PROJECT_ID
npm install
```

## Environment variables

| Variable | Description |
|---|---|
| `VITE_SEPOLIA_RPC_URL` | Alchemy/Infura Sepolia RPC URL |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect project ID (free at cloud.walletconnect.com) |

## Run

```bash
npm run dev       # Dev server at http://localhost:5173
npm run build     # Production build -> dist/
npm run preview   # Preview production build locally
```

## Features

- **Gallery** - browse all minted NFTs; buy listed ones directly
- **List NFT** - approve + list any NFT you own (two-step)
- **Offers** - make an ETH offer on any NFT, accept incoming offers, withdraw your own offers
- **Mint** - mint a new Space Invader NFT from an IPFS metadata URI

## Network support

- Sepolia testnet (chainId 11155111)
- Local Hardhat node (chainId 31337) - update `src/contracts/addresses.ts` after local deploy

## Contract addresses

Configured in `src/contracts/addresses.ts`. Populated from `deployments/sepolia.json` after running the deploy script from the project root.
