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
const tokenId = 21;
const seed = 20;
const bodyColor = "rgb(188,249,174)";
const imagePath = path.join(__dirname, "../invaders/invader_21.png");

interface PinataResponse {
  IpfsHash: string;
}

async function pinFile(filePath: string, name: string): Promise<string> {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath), { filename: name });
  form.append("pinataMetadata", JSON.stringify({ name }));

  const res = await fetch(`${PINATA_API}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Pinata file upload failed (${res.status}): ${await res.text()}`);
  }

  return ((await res.json()) as PinataResponse).IpfsHash;
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
    throw new Error(`Pinata JSON upload failed (${res.status}): ${await res.text()}`);
  }

  return ((await res.json()) as PinataResponse).IpfsHash;
}

async function main() {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image not found: ${imagePath}`);
  }

  console.log(`Uploading image for token #${tokenId}...`);
  const imageCid = await pinFile(imagePath, `space-invader-${tokenId}`);
  console.log(`Image URI: ipfs://${imageCid}`);

  const metadata = {
    name: `Space Invader #${tokenId}`,
    description: `A procedurally generated Space Invader NFT. Seed: ${seed}.`,
    image: `ipfs://${imageCid}`,
    attributes: [
      { trait_type: "Seed", value: seed },
      { trait_type: "Body Color", value: bodyColor },
    ],
  };

  console.log(`Uploading metadata for token #${tokenId}...`);
  const metaCid = await pinJSON(metadata, `space-invader-metadata-${tokenId}`);
  const tokenURI = `ipfs://${metaCid}`;
  console.log(`Token URI: ${tokenURI}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
