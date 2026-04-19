# Space Invader NFT Marketplace

TP3 - IFT-4100/7100 Concepts et applications de la blockchain

Une marketplace NFT décentralisée déployée sur Ethereum (testnet Sepolia). Les images Space Invader sont générées de manière procédurale à partir d'un numéro de graine (canvas côté client), téléversées sur IPFS via Pinata, et mintées comme tokens ERC-721 avec support des royalties - aucun téléversement manuel de fichier. La marketplace utilise des **listings à prix fixe** (V1) et un **système d'offres OTC** (V2, `makeOffer` / `acceptOffer` / `withdrawOffer`) ; aucune enchère temporelle n'est implémentée.

<p align="center">
  <img src="./invaders/invader_01.png" alt="Invader 01" width="100" hspace="8" />
  <img src="./invaders/invader_02.png" alt="Invader 02" width="100" hspace="8" />
  <img src="./invaders/invader_03.png" alt="Invader 03" width="100" hspace="8" />
  <img src="./invaders/invader_04.png" alt="Invader 04" width="100" hspace="8" />
  <img src="./invaders/invader_05.png" alt="Invader 05" width="100" hspace="8" />
</p>

---

## Vidéo de démonstration

[Voir la démo sur YouTube](https://youtu.be/LbCieoxt1hI?si=_RzkPI0WX57h3J7e)

La vidéo montre : connexion wallet sur Sepolia, transaction complète (mint, listing, achat), preuve de déploiement sur Etherscan, et upgrade v1 -> v2 (avant/après).

---

## Architecture

| Composant | Technologie | Notes |
|---|---|---|
| Contrats intelligents | Solidity 0.8.28 + OpenZeppelin v5 | NFT + Marketplace (V1->V2) via proxy UUPS |
| Framework de développement | Hardhat v2 + TypeScript | Tests avec Mocha/Chai |
| Standard NFT | ERC-721 + ERC-2981 (royalties) | `SpaceInvaderNFT.sol` |
| Marketplace | Vente à prix fixe + système d'offres | `SpaceMarketplaceV1.sol` -> `SpaceMarketplaceV2.sol` |
| Stockage | IPFS via Pinata | Images + JSON de métadonnées |
| Frontend | React + Vite + wagmi v2 + viem | MetaMask / WalletConnect |
| Testnet | Ethereum Sepolia | chainId 11155111 |

### Flux de paiement (buyNFT)

```
Acheteur (1 ETH)
  -> 5%    -> Créateur (royalty ERC-2981)
  -> 2.5%  -> Plateforme (destinataire des frais)
  -> 92.5% -> Vendeur
```

### Modèle de déploiement

```
SpaceInvaderNFT  -> proxy UUPS
SpaceMarketplace -> proxy UUPS (v1) + upgrade vers v2 (SpaceMarketplaceV2)
```

---

> **Version Node.js** : utiliser Node.js **v22 LTS**. La chaîne d'outils Hardhat de ce dépôt est validée sur Node 22. Utiliser `nvm use 22` ou consulter `.nvmrc`.

## Prérequis

- Node.js **v22 LTS** (v18+ minimum - v25 casse Hardhat)
- Python 3.10+
- MetaMask avec de l'ETH Sepolia ([faucet](https://sepoliafaucet.com) ou [Alchemy](https://www.alchemy.com/faucets/ethereum-sepolia))
- Compte Pinata (offre gratuite) pour les téléversements IPFS
- (Optionnel) URL RPC Alchemy / Infura pour Sepolia

---

## Installation

```bash
git clone https://github.com/alexandreeberhardt/Space-NFT-Marketplace
cd Space-NFT-Marketplace

# Copier et remplir les secrets
cp .env.example .env

# Installer les dépendances JS/TS
npm install

# Installer les dépendances Python
pip install -r requirements.txt
```

### Variables .env

| Clé | Description |
|---|---|
| `PRIVATE_KEY` | Clé privée du déployeur (sans préfixe 0x) |
| `SEPOLIA_RPC_URL` | URL RPC Sepolia via Alchemy/Infura |
| `PINATA_JWT` | Token JWT de l'API Pinata |
| `ETHERSCAN_API_KEY` | Pour la vérification du contrat (optionnel) |

---

## Compilation

```bash
npm run compile
# Copier les ABIs vers le frontend après compilation :
npx hardhat run scripts/copyAbis.ts
```

---

## Tests

```bash
npm test
```

Résultat attendu : **18 tests passants** couvrant :
1. Déploiement du contrat
2. Mint d'un NFT
3. Mise en vente d'un NFT
4. Achat d'un NFT
5. Distribution des royalties et des frais
6. Système d'offres (makeOffer / acceptOffer / withdrawOffer)
7. Isolation d'état multi-collection
8. Prévention des doublons de listing
9. Revert pour montant ETH incorrect
10. Vérifications de sécurité de la marketplace
11. **Upgrade SpaceMarketplace v1 -> v2** (conservation de l'état + système d'offres)

```bash
# Avec couverture de code (bonus) :
npx hardhat coverage
```

## Vérification

```bash
# Racine
npm run compile
npm test

# Frontend
cd frontend
npm run lint
npm run build
```

---

## Génération des assets NFT

```bash
# Générer 20 images PNG Space Invader
python3 generate_invaders.py   # modifier INVADER_COUNT = 20

# Extraire les attributs (graine, couleur) pour les métadonnées
python3 scripts/extract_attributes.py

# Téléverser images + métadonnées sur Pinata IPFS
npx hardhat run scripts/uploadToIPFS.ts
# Produit : scripts/imageCIDs.json, scripts/tokenURIs.json
```

---

## Déploiement

### Local (noeud Hardhat)

```bash
# Terminal 1 : démarrer le noeud local
npx hardhat node

# Terminal 2 : déployer
npx hardhat run scripts/deploy.ts --network localhost
npx hardhat run scripts/mintBatch.ts --network localhost
```

Après le déploiement local, mettre à jour `frontend/src/contracts/addresses.ts` avec l'adresse du proxy NFT et l'adresse de la marketplace (chainId 31337).

### Testnet Sepolia

```bash
npx hardhat run scripts/deploy.ts --network sepolia
npx hardhat run scripts/mintBatch.ts --network sepolia
```

Les adresses sont sauvegardées dans `deployments/sepolia.json`. Copier l'adresse du proxy NFT et l'adresse de la marketplace dans `frontend/src/contracts/addresses.ts` sous la clé `11155111`.

### Upgrade SpaceMarketplace v1 -> v2 (Sepolia)

```bash
npx hardhat run scripts/upgrade.ts --network sepolia
```

Cette commande upgrade le proxy UUPS `SpaceMarketplace` vers `SpaceMarketplaceV2`, qui ajoute le système d'offres (`makeOffer` / `acceptOffer` / `withdrawOffer`). Tous les listings existants et la configuration de la plateforme sont conservés. L'adresse du proxy reste la même ; seule l'adresse de l'implémentation change.

---

## Frontend

```bash
cd frontend
cp .env.example .env
# Remplir VITE_SEPOLIA_RPC_URL et VITE_WALLETCONNECT_PROJECT_ID

npm install
npm run lint
npm run dev
# Accessible sur http://localhost:5173
```

Obtenir un identifiant WalletConnect gratuit sur [cloud.walletconnect.com](https://cloud.walletconnect.com).

```bash
# Build de production :
npm run build
```

---

## Contrats déployés (Sepolia)

| Contrat | Proxy / Adresse | Implémentation | Explorateur |
|---|---|---|---|
| SpaceInvaderNFT (proxy) | `0x3a5d2721257a26DaBdD6A14b64C0634ffC8dCCD3` | `0x2e99f91DC50D704e3339ecdCC943821a54A33fA8` (V1) | [Etherscan](https://sepolia.etherscan.io/address/0x3a5d2721257a26DaBdD6A14b64C0634ffC8dCCD3) |
| SpaceMarketplace (proxy) | `0xAA5038Faf52ac76EebFaa8C3865D8110B6f9369B` | `0x04c3012dBc38945d1aBbC2cEAeEDC17dC9048a0a` (implémentation actuelle visible sur Etherscan) | [Etherscan](https://sepolia.etherscan.io/address/0xAA5038Faf52ac76EebFaa8C3865D8110B6f9369B) |

L'implémentation NFT est vérifiée sur Etherscan. Pour la marketplace, utiliser la page du proxy ci-dessus comme référence pour l'adresse d'implémentation actuelle.

---

## Notes de sécurité

- **Patron CEI** appliqué dans `buyNFT` et les fonctions d'offres : état mis à jour avant tout appel externe.
- **Protection contre la réentrance** via un flag inline (`uint256 _reentrancyStatus`) : OZ v5 a supprimé `ReentrancyGuardUpgradeable` - leur `ReentrancyGuard` de base utilise le stockage nommé ERC-7201 et n'a pas de variant upgradeable. Le flag inline est le patron canonique OZ v5 pour les contrats upgradeables.
- **Transferts ETH** via `.call{value:}("")` - pas `.transfer()` - pour supporter les wallets de type contrat intelligent.
- **Erreurs personnalisées** utilisées partout pour l'efficacité en gas.
- **Validation des entrées** sur tous les points d'entrée publics (`ZeroPrice`, `ZeroAddress`, `FeeTooHigh`).
- **Clé privée** jamais commitée - utiliser `.env` (dans le gitignore).
- **SpaceMarketplace est upgradeable via UUPS** : V1 déployé comme proxy, upgradé vers V2 (ajoute le système d'offres). `_authorizeUpgrade` protégé par `onlyOwner`.
- **Frais de plateforme** plafonnés à 10% (1000 bps) pour éviter le rug de l'owner.

---

## Procédure de démonstration

1. **Connecter le wallet** - ouvrir `http://localhost:5173` (ou l'URL déployée), cliquer sur "Connect Wallet", sélectionner MetaMask sur le testnet Sepolia. Le header affiche l'adresse tronquée.

2. **Parcourir la galerie** - l'onglet Gallery récupère tous les tokens mintés et affiche les listings actifs avec image, prix et adresse du vendeur.

3. **Acheter un NFT** - cliquer sur "Buy Now" sur n'importe quelle carte listée. MetaMask demande une transaction pour exactement le prix listé. Après 1 confirmation la carte disparaît des listings actifs.

4. **Lister un NFT possédé** - aller dans "List NFT", entrer un token ID possédé, approuver la marketplace (étape 1), puis fixer un prix et lister (étape 2). Deux transactions, chacune confirmée on-chain.

5. **Minter un NFT** - aller dans "Mint", entrer un numéro de graine (0-10000) pour générer un Space Invader unique. L'image est générée côté client, téléversée sur IPFS, puis mintée on-chain.

5b. **Poser / accepter / retirer une offre** - aller dans "Offers". Utiliser "Make Offer" pour enchérir sur n'importe quel token, "Accept Offer" pour accepter une offre (approuver d'abord), ou "Withdraw Offer" pour récupérer son ETH.

6. **Preuve de déploiement** - les adresses des contrats déployés sur Sepolia sont liées dans la section "Contrats déployés" ci-dessus. L'implémentation NFT et la marketplace sont vérifiées sur Etherscan.

7. **Preuve de l'upgrade v1 -> v2** - après avoir exécuté `npx hardhat run scripts/upgrade.ts --network sepolia`, l'adresse du proxy `SpaceMarketplace` reste la même mais l'adresse d'implémentation change. La nouvelle implémentation est visible sur Etherscan sous l'onglet "Read as Proxy" du proxy, tandis que tout l'état de la marketplace est intact.

---

## Structure du projet

```
contracts/
  SpaceInvaderNFT.sol - ERC-721 + ERC-2981, UUPS (v1)
  SpaceMarketplaceV1.sol - Marketplace à prix fixe, proxy UUPS (v1)
  SpaceMarketplaceV2.sol - Etend V1 avec le système d'offres (v2)
  TestMaliciousRoyaltyNFT.sol - Helper de test pour la validation des royalties
scripts/
  deploy.ts - Déploie le proxy NFT + proxy marketplace V1
  upgrade.ts - Upgrade le proxy SpaceMarketplace v1 -> v2
  mintBatch.ts - Minte 20 NFTs on-chain
  uploadToIPFS.ts - Téléverse images + métadonnées sur Pinata
  uploadToken21.ts - Téléverse les métadonnées d'un token supplémentaire
  extract_attributes.py - Extrait les attributs graine/couleur
  copyAbis.ts - Copie les ABIs vers le frontend
test/
  SpaceMarketplace.test.ts - 18 tests automatisés (dont upgrade v1->v2)
frontend/
  src/
    wagmi.config.ts - Config chaîne + connecteurs
    contracts/ - Adresses + ABIs
    components/ - Gallery, NFTCard, ConnectButton, formulaires List/Mint/Offer
    hooks/useNFTMarket.ts - Hooks wagmi read/write
    utils/ - ipfs, formatError
generate_invaders.py - Générateur d'images procédural
deployments/ - Adresses déployées (par réseau)
```
