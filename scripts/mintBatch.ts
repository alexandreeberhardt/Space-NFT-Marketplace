/**
 * mintBatch.ts
 *
 * Mints 20 Space Invader NFTs on-chain using pre-uploaded token URIs.
 *
 * Prerequisites:
 *   1. deploy.ts run successfully (deployments/<network>.json must exist)
 *   2. uploadToIPFS.ts run successfully (scripts/tokenURIs.json must exist)
 */

import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";
import type { SpaceInvaderNFT } from "../typechain-types";

const INVADER_COUNT = 20;

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name === "hardhat" ? "localhost" : network.name;

  console.log(`Minting ${INVADER_COUNT} Space Invader NFTs`);
  console.log(`Network: ${networkName}`);
  console.log(`Minter:  ${deployer.address}\n`);

  // Load addresses and token URIs
  const deploymentsPath = path.join(
    __dirname,
    `../deployments/${networkName}.json`
  );
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`No deployment found for "${networkName}". Run deploy.ts first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const nftProxyAddress: string = deployment.nft.proxy;

  const tokenURIsPath = path.join(__dirname, "tokenURIs.json");
  if (!fs.existsSync(tokenURIsPath)) {
    throw new Error("scripts/tokenURIs.json not found. Run uploadToIPFS.ts first.");
  }
  const tokenURIs: Record<string, string> = JSON.parse(
    fs.readFileSync(tokenURIsPath, "utf-8")
  );

  // Connect to NFT contract
  const NFTFactory = await ethers.getContractFactory("SpaceInvaderNFT");
  const nft = NFTFactory.attach(nftProxyAddress) as SpaceInvaderNFT;

  // Mint each token
  for (let i = 1; i <= INVADER_COUNT; i++) {
    const uri = tokenURIs[String(i)];
    if (!uri) {
      console.warn(`No URI found for token #${i}, skipping.`);
      continue;
    }

    process.stdout.write(`Minting token #${i} (${uri.slice(0, 30)}...)... `);
    const tx = await nft.safeMint(deployer.address, uri);
    const receipt = await tx.wait();
    console.log(`txHash: ${receipt?.hash}`);
  }

  console.log(`\nAll ${INVADER_COUNT} NFTs minted to ${deployer.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
