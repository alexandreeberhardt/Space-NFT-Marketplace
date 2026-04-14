/**
 * uploadToIPFS.ts
 *
 * Uploads Space Invader images and ERC-721 metadata to IPFS via Pinata.
 *
 * Prerequisites:
 *   1. python3 generate_invaders.py  (with INVADER_COUNT = 20)
 *   2. python3 scripts/extract_attributes.py
 *   3. PINATA_JWT set in .env
 *
 * Outputs:
 *   - scripts/imageCIDs.json     { "1": "QmXxx...", ... }
 *   - scripts/tokenURIs.json     { "1": "ipfs://QmMeta.../1.json", ... }
 */

import fs from "fs";
import path from "path";
import FormData from "form-data";
import fetch from "node-fetch";
import "dotenv/config";

const PINATA_JWT = process.env.PINATA_JWT;
if (!PINATA_JWT) {
  throw new Error("PINATA_JWT not set in .env");
}

const PINATA_API = "https://api.pinata.cloud";
const INVADER_COUNT = 20;
const INVADERS_DIR = path.join(__dirname, "../invaders");
const SCRIPTS_DIR = __dirname;

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

async function pinFile(filePath: string, name: string): Promise<string> {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), { filename: name });
  form.append(
    "pinataMetadata",
    JSON.stringify({ name })
  );

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata file upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as PinataResponse;
  return data.IpfsHash;
}

async function pinJSON(obj: object, name: string): Promise<string> {
  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataMetadata: { name },
      pinataContent: obj,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata JSON upload failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as PinataResponse;
  return data.IpfsHash;
}

async function main() {
  // Load attributes from extract_attributes.py output
  const attributesPath = path.join(SCRIPTS_DIR, "attributes.json");
  if (!fs.existsSync(attributesPath)) {
    throw new Error(
      "scripts/attributes.json not found. Run: python3 scripts/extract_attributes.py"
    );
  }
  const attributes: Record<
    string,
    { seed: number; bodyColor: string }
  > = JSON.parse(fs.readFileSync(attributesPath, "utf-8"));

  // Step 1: Upload images
  console.log("=== Step 1: Uploading images to Pinata ===");
  const imageCIDs: Record<string, string> = {};

  for (let i = 1; i <= INVADER_COUNT; i++) {
    const filename = `invader_${String(i).padStart(2, "0")}.png`;
    const filePath = path.join(INVADERS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Image not found: ${filePath}. Run: python3 generate_invaders.py`
      );
    }

    console.log(`  Uploading ${filename}...`);
    const cid = await pinFile(filePath, `space-invader-${i}`);
    imageCIDs[String(i)] = cid;
    console.log(`  -> ipfs://${cid}`);
  }

  const imageCIDsPath = path.join(SCRIPTS_DIR, "imageCIDs.json");
  fs.writeFileSync(imageCIDsPath, JSON.stringify(imageCIDs, null, 2));
  console.log(`\nImage CIDs saved to ${imageCIDsPath}`);

  // Step 2: Build and upload metadata JSON
  console.log("\n=== Step 2: Uploading metadata JSON to Pinata ===");
  const tokenURIs: Record<string, string> = {};

  for (let i = 1; i <= INVADER_COUNT; i++) {
    const tokenId = String(i);
    const attr = attributes[tokenId];
    const imageCid = imageCIDs[tokenId];

    const metadata = {
      name: `Space Invader #${i}`,
      description: `A procedurally generated Space Invader NFT. Seed: ${attr.seed}.`,
      image: `ipfs://${imageCid}`,
      attributes: [
        { trait_type: "Seed", value: attr.seed },
        { trait_type: "Body Color", value: attr.bodyColor },
      ],
    };

    console.log(`  Uploading metadata for token #${i}...`);
    const metaCid = await pinJSON(metadata, `space-invader-metadata-${i}`);
    tokenURIs[tokenId] = `ipfs://${metaCid}`;
    console.log(`  -> ipfs://${metaCid}`);
  }

  const tokenURIsPath = path.join(SCRIPTS_DIR, "tokenURIs.json");
  fs.writeFileSync(tokenURIsPath, JSON.stringify(tokenURIs, null, 2));
  console.log(`\nToken URIs saved to ${tokenURIsPath}`);
  console.log("\nDone! Run mintBatch.ts to mint all NFTs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
