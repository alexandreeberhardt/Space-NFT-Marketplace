import { ethers, upgrades, network } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  console.log(`Network: ${network.name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Deploy SpaceInvaderNFT (UUPS proxy)
  // 5% default royalty (500 bps) to the deployer address
  console.log("Deploying SpaceInvaderNFT...");
  const NFTFactory = await ethers.getContractFactory("SpaceInvaderNFT");
  const nft = await upgrades.deployProxy(
    NFTFactory,
    [deployer.address, 500],
    { kind: "uups" }
  );
  await nft.waitForDeployment();

  const nftProxyAddress = await nft.getAddress();
  const nftImplAddress = await upgrades.erc1967.getImplementationAddress(nftProxyAddress);
  console.log(`  Proxy:          ${nftProxyAddress}`);
  console.log(`  Implementation: ${nftImplAddress}`);

  // Deploy SpaceMarketplaceV1 (UUPS proxy)
  // 2.5% platform fee (250 bps), fee recipient = deployer
  console.log("\nDeploying SpaceMarketplaceV1 (UUPS proxy)...");
  const MarketFactory = await ethers.getContractFactory("SpaceMarketplaceV1");
  const market = await upgrades.deployProxy(
    MarketFactory,
    [250, deployer.address],
    { kind: "uups" }
  );
  await market.waitForDeployment();

  const marketAddress = await market.getAddress();
  const marketImplAddress = await upgrades.erc1967.getImplementationAddress(marketAddress);
  console.log(`  Proxy:          ${marketAddress}`);
  console.log(`  Implementation: ${marketImplAddress}`);

  // Persist addresses to deployments/<network>.json
  const networkName = network.name === "hardhat" ? "localhost" : network.name;
  const chainId = (await ethers.provider.getNetwork()).chainId.toString();

  const explorerBase =
    networkName === "sepolia"
      ? "https://sepolia.etherscan.io/address/"
      : "";

  const deployment = {
    network: networkName,
    chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    nft: {
      proxy: nftProxyAddress,
      implementation: nftImplAddress,
      explorer: explorerBase ? `${explorerBase}${nftProxyAddress}` : "",
    },
    marketplace: {
      proxy: marketAddress,
      implementation: marketImplAddress,
      version: "V1",
      explorer: explorerBase ? `${explorerBase}${marketAddress}` : "",
    },
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const outPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment saved to ${outPath}`);

  console.log(`NFT proxy: ${nftProxyAddress}`);
  console.log(`Market address: ${marketAddress}`);
  if (networkName === "sepolia") {
    console.log(`\nVerify NFT impl: npx hardhat verify --network sepolia ${nftImplAddress}`);
    console.log(`Verify Market: npx hardhat verify --network sepolia ${marketAddress} 250 ${deployer.address}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
