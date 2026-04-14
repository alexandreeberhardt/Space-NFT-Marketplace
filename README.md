# Space Invader NFT Marketplace

TP3 - IFT-4100/7100 Concepts et applications de la blockchain

A decentralized NFT marketplace built on Ethereum (Sepolia testnet). Space Invader images are procedurally generated in Python and minted as ERC-721 tokens with royalty support. The marketplace allows fixed-price listings, purchases, and an offer system.

<p align="center">
  <img src="./invaders/invader_01.png" alt="Invader 01" width="100" hspace="8" />
  <img src="./invaders/invader_02.png" alt="Invader 02" width="100" hspace="8" />
  <img src="./invaders/invader_03.png" alt="Invader 03" width="100" hspace="8" />
  <img src="./invaders/invader_04.png" alt="Invader 04" width="100" hspace="8" />
  <img src="./invaders/invader_05.png" alt="Invader 05" width="100" hspace="8" />
</p>

---

## Architecture

| Component | Technology | Notes |
|---|---|---|
| Smart contracts | Solidity 0.8.28 + OpenZeppelin v5 | NFT en UUPS, marketplace immuable |
| Development framework | Hardhat v2 + TypeScript | Tests with Mocha/Chai |
| NFT standard | ERC-721 + ERC-2981 (royalties) | `SpaceInvaderNFT.sol` |
| Marketplace | Fixed-price sales + offer system | `SpaceMarketplace.sol` |
| Storage | IPFS via Pinata | Images + metadata JSON |
| Frontend | React + Vite + wagmi v2 + viem | MetaMask / WalletConnect |
| Testnet | Ethereum Sepolia | chainId 11155111 |

### Payment flow (buyNFT)

```
Buyer (1 ETH)
  -> 5%    -> Creator (ERC-2981 royalty)
  -> 2.5%  -> Platform (fee recipient)
  -> 92.5% -> Seller
```

### Deployment model

```
SpaceInvaderNFT -> proxy + implementation
SpaceMarketplace -> direct immutable deployment
```

---

## Prerequisites

- Node.js v18+ (v22 LTS recommended - Hardhat warns on v25)
- Python 3.10+
- MetaMask with Sepolia ETH ([faucet](https://sepoliafaucet.com) or [Alchemy](https://www.alchemy.com/faucets/ethereum-sepolia))
- Pinata account (free tier) for IPFS uploads
- (Optional) Alchemy / Infura RPC URL for Sepolia

---

## Installation

```bash
git clone https://github.com/alexandreeberhardt/Space-NFT-Marketplace
cd Space-NFT-Marketplace

# Copy and fill in secrets
cp .env.example .env

# Install JS/TS dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

### .env variables

| Key | Description |
|---|---|
| `PRIVATE_KEY` | Deployer private key (no 0x prefix needed) |
| `SEPOLIA_RPC_URL` | Alchemy/Infura Sepolia RPC URL |
| `PINATA_JWT` | Pinata API JWT token |
| `ETHERSCAN_API_KEY` | For contract verification (optional) |

---

## Compile

```bash
npx hardhat compile
# Copy ABIs to frontend after compiling:
npx hardhat run scripts/copyAbis.ts
```

---

## Test

```bash
npx hardhat test
```

Expected output: **17 tests passing** covering:
1. Contract deployment
2. NFT minting
3. NFT listing
4. NFT purchase
5. Royalties and fee distribution
6. Offer system (makeOffer / acceptOffer / withdrawOffer)
7. Multi-collection state isolation
8. Duplicate listing prevention
9. Incorrect ETH amount revert

```bash
# With coverage (bonus):
npx hardhat coverage
```

---

## Generate NFT Assets

```bash
# Generate 20 Space Invader PNG images
python3 generate_invaders.py   # edit INVADER_COUNT = 20

# Extract attributes (seed, body color) for metadata
python3 scripts/extract_attributes.py

# Upload images + metadata to Pinata IPFS
npx hardhat run scripts/uploadToIPFS.ts
# Outputs: scripts/imageCIDs.json, scripts/tokenURIs.json
```

---

## Deploy

### Local (Hardhat node)

```bash
# Terminal 1: start local node
npx hardhat node

# Terminal 2: deploy
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/mintBatch.ts --network localhost
```

After deploying locally, update `frontend/src/contracts/addresses.ts` with the printed NFT proxy address and marketplace address (chainId 31337).

### Sepolia testnet

```bash
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat run scripts/mintBatch.ts --network sepolia
```

Addresses are saved to `deployments/sepolia.json`. Copy the NFT proxy address and marketplace address into `frontend/src/contracts/addresses.ts` under key `11155111`.

---

## Frontend

```bash
cd frontend
cp .env.example .env
# Fill in VITE_SEPOLIA_RPC_URL and VITE_WALLETCONNECT_PROJECT_ID

npm install
npm run dev
# Opens at http://localhost:5173
```

Get a free WalletConnect project ID at [cloud.walletconnect.com](https://cloud.walletconnect.com).

```bash
# Production build:
npm run build
```

---

## Deployed Contracts (Sepolia)

| Contract | Proxy / Address | Implementation | Explorer |
|---|---|---|---|
| SpaceInvaderNFT | `0x2aDf2C54853056DD27c13d9A4d32B5B808758E16` | `0x2e99f91DC50D704e3339ecdCC943821a54A33fA8` | [Etherscan](https://sepolia.etherscan.io/address/0x2aDf2C54853056DD27c13d9A4d32B5B808758E16) |
| SpaceMarketplace | `0x8a798F4f0CCb00e79c20D53cc1Ca33aee054c793` | immutable | [Etherscan](https://sepolia.etherscan.io/address/0x8a798F4f0CCb00e79c20D53cc1Ca33aee054c793) |

The NFT implementation and the marketplace contract are verified on Etherscan.

---

## Security Notes

- **CEI pattern** enforced in `buyNFT` and offer functions: state updated before any external call.
- **Reentrancy guard** implemented inline using a `uint256 _reentrancyStatus` storage variable (no OZ base contract needed with OZ v5).
- **ETH transfers** use `.call{value:}("")` - not `.transfer()` - to support smart contract wallets.
- **Custom errors** used throughout for gas efficiency.
- **Input validation** on all public entry points (`ZeroPrice`, `ZeroAddress`, `FeeTooHigh`).
- **Private key** never committed - use `.env` (gitignored).
- **SpaceMarketplace is immutable**: no proxy, no upgrade admin, deployed directly.
- **SpaceInvaderNFT UUPS upgrade** gated by `onlyOwner` via `_authorizeUpgrade`.
- **Platform fee** capped at 10% (1000 bps) to prevent owner rug.

---

## Project Structure

```
contracts/
  SpaceInvaderNFT.sol        ERC-721 + ERC-2981, UUPS
  SpaceMarketplace.sol       Fixed-price marketplace + offer system, immutable
scripts/
  deploy.ts                  Deploy NFT proxy + immutable marketplace
  mintBatch.ts               Mint 20 NFTs on-chain
  uploadToIPFS.ts            Upload images + metadata to Pinata
  extract_attributes.py      Extract seed/color attributes
  copyAbis.ts                Copy ABIs to frontend
test/
  SpaceMarketplace.test.ts   17 automated tests
frontend/
  src/
    wagmi.config.ts          Chain + connector config
    contracts/               Addresses + ABIs
    components/              Gallery, NFTCard, ConnectButton, forms
    hooks/useNFTMarket.ts    wagmi read/write hooks
    utils/                   ipfsToHttp, formatError
generate_invaders.py         Procedural image generator
deployments/                 Deployed addresses (per network)
```
