/**
 * copyAbis.ts
 * Copies compiled ABI arrays from Hardhat artifacts to frontend/src/contracts/abis/.
 * Run after `npx hardhat compile`.
 */
import fs from "fs";
import path from "path";

const artifacts = [
  {
    src: "artifacts/contracts/SpaceInvaderNFT.sol/SpaceInvaderNFT.json",
    dest: "frontend/src/contracts/abis/SpaceInvaderNFT.json",
  },
  {
    src: "artifacts/contracts/SpaceMarketplace.sol/SpaceMarketplace.json",
    dest: "frontend/src/contracts/abis/SpaceMarketplace.json",
  },
];

const root = path.join(__dirname, "..");

for (const { src, dest } of artifacts) {
  const artifact = JSON.parse(fs.readFileSync(path.join(root, src), "utf-8"));
  fs.writeFileSync(
    path.join(root, dest),
    JSON.stringify(artifact.abi, null, 2)
  );
  console.log(`Copied ABI: ${dest}`);
}

console.log("Done.");
