import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { parseEther, ZeroAddress } from "ethers";
import type { SpaceInvaderNFT, SpaceInvaderNFTV2, SpaceMarketplaceV2 } from "../typechain-types";

// Fixture

async function deployFixture() {
  const [owner, seller, buyer, feeRecipient, stranger] =
    await ethers.getSigners();

  // Deploy NFT proxy (UUPS)
  const NFTFactory = await ethers.getContractFactory("SpaceInvaderNFT");
  const nft = (await upgrades.deployProxy(
    NFTFactory,
    [owner.address, 500], // 5% royalty
    { kind: "uups" }
  )) as unknown as SpaceInvaderNFT;
  await nft.waitForDeployment();

  // Deploy Marketplace as UUPS proxy (V2 directly for the main test suite).
  // V2 inherits V1's initialize() which calls all parent initializers.
  // unsafeAllow needed because OZ validator does not traverse inheritance for this check.
  const MarketFactory = await ethers.getContractFactory("SpaceMarketplaceV2");
  const market = (await upgrades.deployProxy(
    MarketFactory,
    [250, feeRecipient.address],
    { kind: "uups", unsafeAllow: ["missing-initializer"] }
  )) as unknown as SpaceMarketplaceV2;
  await market.waitForDeployment();

  // Mint token #1 to seller
  await nft.connect(owner).safeMint(seller.address, "ipfs://QmTest/1.json");

  return { nft, market, owner, seller, buyer, feeRecipient, stranger };
}

async function deploySecondCollection(ownerAddress: string) {
  const NFTFactory = await ethers.getContractFactory("SpaceInvaderNFT");
  const secondNft = (await upgrades.deployProxy(
    NFTFactory,
    [ownerAddress, 500],
    { kind: "uups" }
  )) as unknown as SpaceInvaderNFT;
  await secondNft.waitForDeployment();
  return secondNft;
}

async function deployMaliciousRoyaltyCollection(ownerAddress: string) {
  const NFTFactory = await ethers.getContractFactory("TestMaliciousRoyaltyNFT");
  const maliciousNft = await NFTFactory.deploy(ownerAddress);
  await maliciousNft.waitForDeployment();
  return maliciousNft;
}

// Test 1 - Contract deployment

describe("1 - Contract deployment", () => {
  it("deploys with non-zero addresses and correct initial state", async () => {
    const { nft, market, owner, feeRecipient } =
      await loadFixture(deployFixture);

    expect(await nft.getAddress()).to.not.equal(ZeroAddress);
    expect(await market.getAddress()).to.not.equal(ZeroAddress);
    expect(await market.platformFeeBps()).to.equal(250n);
    expect(await market.feeRecipient()).to.equal(feeRecipient.address);
    expect(await nft.owner()).to.equal(owner.address);
    expect(await market.owner()).to.equal(owner.address);
  });
});

// Test 2 - NFT minting

describe("2 - NFT minting", () => {
  it("mints an NFT to the correct owner with the correct URI", async () => {
    const { nft, seller } = await loadFixture(deployFixture);

    expect(await nft.ownerOf(1n)).to.equal(seller.address);
    expect(await nft.tokenURI(1n)).to.equal("ipfs://QmTest/1.json");
    expect(await nft.totalSupply()).to.equal(1n);
  });

  it("allows any user to mint and emits the metadata URI", async () => {
    const { nft, seller } = await loadFixture(deployFixture);

    await expect(
      nft.connect(seller).safeMint(seller.address, "ipfs://Qm/2.json")
    )
      .to.emit(nft, "NFTMinted")
      .withArgs(2n, seller.address, seller.address, "ipfs://Qm/2.json");

    expect(await nft.ownerOf(2n)).to.equal(seller.address);
    expect(await nft.tokenURI(2n)).to.equal("ipfs://Qm/2.json");
    expect(await nft.totalSupply()).to.equal(2n);
  });

  it("supports self-service minting through mint()", async () => {
    const { nft, buyer } = await loadFixture(deployFixture);

    await expect(nft.connect(buyer).mint("ipfs://Qm/3.json"))
      .to.emit(nft, "NFTMinted")
      .withArgs(2n, buyer.address, buyer.address, "ipfs://Qm/3.json");

    expect(await nft.ownerOf(2n)).to.equal(buyer.address);
  });

  it("reverts when minting with an empty URI", async () => {
    const { nft, buyer } = await loadFixture(deployFixture);

    await expect(nft.connect(buyer).mint("")).to.be.revertedWithCustomError(
      nft,
      "EmptyTokenURI"
    );
  });
});

// Test 3 - NFT listing

describe("3 - NFT listing", () => {
  it("lists an NFT and emits NFTListed event", async () => {
    const { nft, market, seller } = await loadFixture(deployFixture);

    await nft.connect(seller).approve(await market.getAddress(), 1n);

    await expect(
      market
        .connect(seller)
        .listNFT(await nft.getAddress(), 1n, parseEther("1"))
    )
      .to.emit(market, "NFTListed")
      .withArgs(
        await nft.getAddress(),
        1n,
        seller.address,
        parseEther("1")
      );

    const listing = await market.listings(await nft.getAddress(), 1n);
    expect(listing.active).to.be.true;
    expect(listing.price).to.equal(parseEther("1"));
    expect(listing.seller).to.equal(seller.address);
  });

  it("reverts when listing with zero price", async () => {
    const { nft, market, seller } = await loadFixture(deployFixture);

    await nft.connect(seller).approve(await market.getAddress(), 1n);

    await expect(
      market.connect(seller).listNFT(await nft.getAddress(), 1n, 0n)
    ).to.be.revertedWithCustomError(market, "ZeroPrice");
  });
});

// Test 4 - NFT purchase

describe("4 - NFT purchase", () => {
  async function listedFixture() {
    const base = await loadFixture(deployFixture);
    const { nft, market, seller } = base;

    await nft.connect(seller).approve(await market.getAddress(), 1n);
    await market
      .connect(seller)
      .listNFT(await nft.getAddress(), 1n, parseEther("1"));

    return base;
  }

  it("transfers NFT ownership to buyer and emits NFTSold", async () => {
    const { nft, market, seller, buyer } = await listedFixture();

    await expect(
      market
        .connect(buyer)
        .buyNFT(await nft.getAddress(), 1n, { value: parseEther("1") })
    )
      .to.emit(market, "NFTSold")
      .withArgs(
        await nft.getAddress(),
        1n,
        seller.address,
        buyer.address,
        parseEther("1")
      );

    expect(await nft.ownerOf(1n)).to.equal(buyer.address);
    const listing = await market.listings(await nft.getAddress(), 1n);
    expect(listing.active).to.be.false;
  });
});

// Test 5 - Royalties and fee distribution

describe("5 - Royalties and fee distribution", () => {
  it("splits payment correctly between creator, platform and seller", async () => {
    const { nft, market, owner, seller, buyer, feeRecipient } =
      await loadFixture(deployFixture);

    await nft.connect(seller).approve(await market.getAddress(), 1n);
    await market
      .connect(seller)
      .listNFT(await nft.getAddress(), 1n, parseEther("1"));

    // Price: 1 ETH
    // Royalty: 5% = 0.05 ETH  -> owner (royalty receiver)
    // Platform fee: 2.5% = 0.025 ETH -> feeRecipient
    // Seller: 92.5% = 0.925 ETH

    const tx = market
      .connect(buyer)
      .buyNFT(await nft.getAddress(), 1n, { value: parseEther("1") });

    await expect(tx).to.changeEtherBalance(
      feeRecipient,
      parseEther("0.025")
    );
    await expect(tx).to.changeEtherBalance(owner, parseEther("0.05"));
    await expect(tx).to.changeEtherBalance(seller, parseEther("0.925"));
    await expect(
      market
        .connect(buyer)
        .buyNFT(await nft.getAddress(), 1n, { value: parseEther("1") })
    ).to.be.revertedWithCustomError(market, "NotListed"); // already bought
  });

  it("seller receives 92.5% after royalty and platform fee", async () => {
    const { nft, market, seller, buyer } = await loadFixture(deployFixture);

    await nft.connect(seller).approve(await market.getAddress(), 1n);
    await market
      .connect(seller)
      .listNFT(await nft.getAddress(), 1n, parseEther("1"));

    await expect(
      market
        .connect(buyer)
        .buyNFT(await nft.getAddress(), 1n, { value: parseEther("1") })
    ).to.changeEtherBalance(seller, parseEther("0.925"));
  });
});

// Test 6 - Offer system

describe("6 - Offer system", () => {

  it("buyer can make an offer and seller can accept it", async () => {
    const { nft, market, seller, buyer } = await loadFixture(deployFixture);

    // buyer makes offer
    await expect(
      market
        .connect(buyer)
        .makeOffer(await nft.getAddress(), 1n, { value: parseEther("0.5") })
    )
      .to.emit(market, "OfferMade")
      .withArgs(await nft.getAddress(), 1n, buyer.address, parseEther("0.5"));

    expect(
      await market.offers(await nft.getAddress(), 1n, buyer.address)
    ).to.equal(
      parseEther("0.5")
    );

    // seller approves and accepts offer
    await nft.connect(seller).approve(await market.getAddress(), 1n);

    await expect(
      market
        .connect(seller)
        .acceptOffer(await nft.getAddress(), 1n, buyer.address)
    )
      .to.emit(market, "OfferAccepted")
      .withArgs(
        await nft.getAddress(),
        1n,
        seller.address,
        buyer.address,
        parseEther("0.5")
      );

    expect(await nft.ownerOf(1n)).to.equal(buyer.address);
    expect(
      await market.offers(await nft.getAddress(), 1n, buyer.address)
    ).to.equal(0n);
  });

  it("buyer can withdraw an offer and reclaim ETH", async () => {
    const { nft, market, buyer } = await loadFixture(deployFixture);

    await market
      .connect(buyer)
      .makeOffer(await nft.getAddress(), 1n, { value: parseEther("0.5") });

    await expect(
      market.connect(buyer).withdrawOffer(await nft.getAddress(), 1n)
    )
      .to.emit(market, "OfferWithdrawn")
      .withArgs(await nft.getAddress(), 1n, buyer.address, parseEther("0.5"));

    expect(
      await market.offers(await nft.getAddress(), 1n, buyer.address)
    ).to.equal(0n);
  });
});

// Test 8b - Multi-collection state isolation

describe("8b - Multi-collection state isolation", () => {
  it("keeps listings and offers isolated by nft contract address", async () => {
    const { nft, market, seller, buyer, owner } = await loadFixture(deployFixture);
    const secondNft = await deploySecondCollection(owner.address);

    await secondNft
      .connect(owner)
      .safeMint(seller.address, "ipfs://QmTest/second-1.json");

    await nft.connect(seller).approve(await market.getAddress(), 1n);
    await secondNft.connect(seller).approve(await market.getAddress(), 1n);

    await market
      .connect(seller)
      .listNFT(await nft.getAddress(), 1n, parseEther("1"));
    await market
      .connect(seller)
      .listNFT(await secondNft.getAddress(), 1n, parseEther("2"));

    expect((await market.listings(await nft.getAddress(), 1n)).price).to.equal(
      parseEther("1")
    );
    expect(
      (await market.listings(await secondNft.getAddress(), 1n)).price
    ).to.equal(parseEther("2"));

    await market
      .connect(buyer)
      .makeOffer(await nft.getAddress(), 1n, { value: parseEther("0.5") });
    await market
      .connect(buyer)
      .makeOffer(await secondNft.getAddress(), 1n, { value: parseEther("0.75") });

    expect(
      await market.offers(await nft.getAddress(), 1n, buyer.address)
    ).to.equal(parseEther("0.5"));
    expect(
      await market.offers(await secondNft.getAddress(), 1n, buyer.address)
    ).to.equal(parseEther("0.75"));
  });
});

// Test 8 - Duplicate listing prevention

describe("8 - Duplicate listing prevention", () => {
  it("reverts when trying to list an already-listed NFT", async () => {
    const { nft, market, seller } = await loadFixture(deployFixture);

    await nft
      .connect(seller)
      .setApprovalForAll(await market.getAddress(), true);

    await market
      .connect(seller)
      .listNFT(await nft.getAddress(), 1n, parseEther("1"));

    await expect(
      market
        .connect(seller)
        .listNFT(await nft.getAddress(), 1n, parseEther("2"))
    ).to.be.revertedWithCustomError(market, "AlreadyListed");
  });
});

// Test 9 - Incorrect ETH amount revert

// Test 11 - Upgrade marketplace v1 -> v2

describe("11 - Upgrade marketplace v1 -> v2 (state preservation + offer system)", () => {
  it("preserves V1 listings after upgrade and unlocks the offer system in V2", async () => {
    const [owner, seller, buyer, feeRecipient] = await ethers.getSigners();

    // --- Deploy NFT proxy ---
    const NFTFactory = await ethers.getContractFactory("SpaceInvaderNFT");
    const nft = (await upgrades.deployProxy(
      NFTFactory,
      [owner.address, 500],
      { kind: "uups" }
    )) as unknown as SpaceInvaderNFT;
    await nft.waitForDeployment();
    await nft.connect(owner).safeMint(seller.address, "ipfs://QmTest/1.json");

    // 1. Deploy SpaceMarketplaceV1 via UUPS proxy
    const V1Factory = await ethers.getContractFactory("SpaceMarketplaceV1");
    const marketV1 = await upgrades.deployProxy(
      V1Factory,
      [250, feeRecipient.address],
      { kind: "uups" }
    );
    await marketV1.waitForDeployment();
    const proxyAddress = await marketV1.getAddress();

    expect(await marketV1.platformFeeBps()).to.equal(250n);
    expect(await marketV1.feeRecipient()).to.equal(feeRecipient.address);

    // 2. Modify state in V1: create a listing
    await nft.connect(seller).approve(proxyAddress, 1n);
    await marketV1
      .connect(seller)
      .listNFT(await nft.getAddress(), 1n, parseEther("1"));

    const listingV1 = await marketV1.listings(await nft.getAddress(), 1n);
    expect(listingV1.active).to.be.true;
    expect(listingV1.price).to.equal(parseEther("1"));

    // 3. Upgrade proxy to V2 (adds offer system)
    const V2Factory = await ethers.getContractFactory("SpaceMarketplaceV2");
    const marketV2 = (await upgrades.upgradeProxy(
      proxyAddress,
      V2Factory,
      { kind: "uups", call: "initializeV2", unsafeAllow: ["missing-initializer"] }
    )) as unknown as SpaceMarketplaceV2;
    await marketV2.waitForDeployment();

    // 4. Verify proxy address unchanged and V1 state preserved
    expect(await marketV2.getAddress()).to.equal(proxyAddress);
    expect(await marketV2.platformFeeBps()).to.equal(250n);
    expect(await marketV2.feeRecipient()).to.equal(feeRecipient.address);
    expect(await marketV2.owner()).to.equal(owner.address);

    const listingAfterUpgrade = await marketV2.listings(await nft.getAddress(), 1n);
    expect(listingAfterUpgrade.active).to.be.true;
    expect(listingAfterUpgrade.price).to.equal(parseEther("1"));
    expect(listingAfterUpgrade.seller).to.equal(seller.address);

    // 5. V2 new feature: offer system - make an offer
    await expect(
      marketV2
        .connect(buyer)
        .makeOffer(await nft.getAddress(), 1n, { value: parseEther("0.5") })
    )
      .to.emit(marketV2, "OfferMade")
      .withArgs(await nft.getAddress(), 1n, buyer.address, parseEther("0.5"));

    expect(
      await marketV2.offers(await nft.getAddress(), 1n, buyer.address)
    ).to.equal(parseEther("0.5"));

    // 6. Seller accepts the offer - verifies full payout flow post-upgrade
    await expect(
      marketV2
        .connect(seller)
        .acceptOffer(await nft.getAddress(), 1n, buyer.address)
    )
      .to.emit(marketV2, "OfferAccepted")
      .withArgs(
        await nft.getAddress(),
        1n,
        seller.address,
        buyer.address,
        parseEther("0.5")
      );

    expect(await nft.ownerOf(1n)).to.equal(buyer.address);
    expect(
      await marketV2.offers(await nft.getAddress(), 1n, buyer.address)
    ).to.equal(0n);
  });
});

// Test 12 - Upgrade NFT SpaceInvaderNFT v1 -> v2

describe("12 - Upgrade NFT v1 -> v2 (state preservation + max-supply cap)", () => {
  it("preserves V1 tokens after upgrade and unlocks setMaxSupply in V2", async () => {
    const [owner, minter] = await ethers.getSigners();

    // 1. Deploy SpaceInvaderNFT V1 via UUPS proxy
    const NFTv1Factory = await ethers.getContractFactory("SpaceInvaderNFT");
    const nftV1 = (await upgrades.deployProxy(
      NFTv1Factory,
      [owner.address, 500],
      { kind: "uups" }
    )) as unknown as SpaceInvaderNFT;
    await nftV1.waitForDeployment();
    const proxyAddress = await nftV1.getAddress();

    // 2. Mint two tokens in V1
    await nftV1.connect(minter).mint("ipfs://QmV1/1.json");
    await nftV1.connect(minter).mint("ipfs://QmV1/2.json");
    expect(await nftV1.totalSupply()).to.equal(2n);
    expect(await nftV1.ownerOf(1n)).to.equal(minter.address);
    expect(await nftV1.tokenURI(1n)).to.equal("ipfs://QmV1/1.json");

    // 3. Upgrade proxy to V2
    const NFTv2Factory = await ethers.getContractFactory("SpaceInvaderNFTV2");
    const nftV2 = (await upgrades.upgradeProxy(proxyAddress, NFTv2Factory, {
      kind: "uups",
      call: "initializeV2",
    })) as unknown as SpaceInvaderNFTV2;
    await nftV2.waitForDeployment();

    // 4. Proxy address must be unchanged
    expect(await nftV2.getAddress()).to.equal(proxyAddress);

    // 5. All V1 state preserved
    expect(await nftV2.totalSupply()).to.equal(2n);
    expect(await nftV2.ownerOf(1n)).to.equal(minter.address);
    expect(await nftV2.tokenURI(1n)).to.equal("ipfs://QmV1/1.json");
    expect(await nftV2.owner()).to.equal(owner.address);

    // 6. V2 new feature: set a max-supply cap
    await nftV2.connect(owner).setMaxSupply(4n);
    expect(await nftV2.maxSupply()).to.equal(4n);

    // Mint up to the cap
    await nftV2.connect(minter).mint("ipfs://QmV2/3.json");
    await nftV2.connect(minter).mint("ipfs://QmV2/4.json");
    expect(await nftV2.totalSupply()).to.equal(4n);

    // 7. Exceeding the cap reverts
    await expect(
      nftV2.connect(minter).mint("ipfs://QmV2/5.json")
    ).to.be.revertedWithCustomError(nftV2, "MaxSupplyReached");
  });
});

describe("9 - Incorrect ETH amount", () => {
  it("reverts buyNFT when msg.value does not match price", async () => {
    const { nft, market, seller, buyer } = await loadFixture(deployFixture);

    await nft.connect(seller).approve(await market.getAddress(), 1n);
    await market
      .connect(seller)
      .listNFT(await nft.getAddress(), 1n, parseEther("1"));

    await expect(
      market
        .connect(buyer)
        .buyNFT(await nft.getAddress(), 1n, { value: parseEther("0.5") })
    ).to.be.revertedWithCustomError(market, "IncorrectETHAmount");

    await expect(
      market
        .connect(buyer)
        .buyNFT(await nft.getAddress(), 1n, { value: parseEther("1.5") })
    ).to.be.revertedWithCustomError(market, "IncorrectETHAmount");
  });
});

describe("10 - Marketplace safety checks", () => {
  it("reverts buyNFT when the listed seller no longer owns the token", async () => {
    const { nft, market, seller, buyer, stranger } = await loadFixture(deployFixture);

    await nft.connect(seller).approve(await market.getAddress(), 1n);
    await market
      .connect(seller)
      .listNFT(await nft.getAddress(), 1n, parseEther("1"));

    await nft.connect(seller).transferFrom(seller.address, stranger.address, 1n);

    await expect(
      market
        .connect(buyer)
        .buyNFT(await nft.getAddress(), 1n, { value: parseEther("1") })
    ).to.be.revertedWithCustomError(market, "NotNFTOwner");
  });

  it("reverts when ERC2981 royalty exceeds the sale price after platform fee", async () => {
    const { market, owner, seller, buyer } = await loadFixture(deployFixture);
    const maliciousNft = await deployMaliciousRoyaltyCollection(owner.address);

    await maliciousNft.connect(owner).mint(seller.address, 1n);
    await maliciousNft.connect(owner).setForcedRoyaltyAmount(parseEther("0.99"));

    await maliciousNft.connect(seller).approve(await market.getAddress(), 1n);
    await market
      .connect(seller)
      .listNFT(await maliciousNft.getAddress(), 1n, parseEther("1"));

    await expect(
      market
        .connect(buyer)
        .buyNFT(await maliciousNft.getAddress(), 1n, { value: parseEther("1") })
    ).to.be.revertedWithCustomError(market, "InvalidRoyaltyAmount");
  });
});
