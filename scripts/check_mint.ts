import { ethers } from "hardhat";
async function main() {
  const [signer] = await ethers.getSigners();
  const nft = await ethers.getContractAt("SpaceInvaderNFTV2", "0x3a5d2721257a26DaBdD6A14b64C0634ffC8dCCD3", signer);
  const total = await nft.totalSupply();
  console.log("totalSupply:", total.toString());
  // Try calling maxSupply - if it works, contract is V2
  try {
    const max = await nft.maxSupply();
    console.log("maxSupply:", max.toString());
    if (max > 0n && total >= max) {
      console.log("-> MAX SUPPLY REACHED, removing cap...");
      const tx = await nft.setMaxSupply(0);
      await tx.wait();
      console.log("maxSupply set to 0 (no cap)");
    }
  } catch(e: any) {
    console.log("maxSupply() failed (V1 contract):", e.message.slice(0,80));
  }
}
main().catch(console.error);
