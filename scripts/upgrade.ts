import { ethers, upgrades, network } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Upgrades the SpaceInvaderNFT UUPS proxy from V1 to V2.
 *
 * Usage:
 *   npx hardhat run scripts/upgrade.ts --network sepolia
 *   npx hardhat run scripts/upgrade.ts --network localhost
 *
 * Prerequisites:
 *   - contracts/SpaceInvaderNFTV2.sol must be compiled
 *   - deployments/<network>.json must exist (run deploy.ts first)
 *   - the deployer account must be the proxy owner
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name === "hardhat" ? "localhost" : network.name;

  console.log(`Upgrading SpaceInvaderNFT to V2`);
  console.log(`Network  : ${networkName}`);
  console.log(`Deployer : ${deployer.address}\n`);

  // Read current deployment
  const deploymentsDir = path.join(__dirname, "../deployments");
  const deploymentsPath = path.join(deploymentsDir, `${networkName}.json`);

  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(
      `No deployment found at ${deploymentsPath}. Run scripts/deploy.ts first.`
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const proxyAddress: string = deployment.nft.proxy;

  if (!proxyAddress) {
    throw new Error("deployment.nft.proxy is missing in the deployment file.");
  }

  console.log(`Current proxy      : ${proxyAddress}`);
  console.log(`Current impl (V1)  : ${deployment.nft.implementation}`);

  // Upgrade proxy to V2
  const V2Factory = await ethers.getContractFactory("SpaceInvaderNFTV2");
  const upgraded = await upgrades.upgradeProxy(proxyAddress, V2Factory, {
    kind: "uups",
  });
  await upgraded.waitForDeployment();

  const newImplAddress = await upgrades.erc1967.getImplementationAddress(
    proxyAddress
  );

  console.log(`\nUpgrade successful.`);
  console.log(`Proxy (unchanged)  : ${proxyAddress}`);
  console.log(`New impl (V2)      : ${newImplAddress}`);

  // Persist updated deployment record
  deployment.nft.implementation = newImplAddress;
  deployment.nft.version = "V2";
  deployment.upgradedAt = new Date().toISOString();

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployment, null, 2));
  console.log(`\nDeployment record updated: ${deploymentsPath}`);

  if (networkName === "sepolia") {
    console.log(
      `\nVerify V2 impl:\n  npx hardhat verify --network sepolia ${newImplAddress}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
