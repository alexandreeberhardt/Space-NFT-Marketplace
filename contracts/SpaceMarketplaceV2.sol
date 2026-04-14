// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./SpaceMarketplaceV1.sol";

/**
 * @title SpaceMarketplaceV2
 * @notice Extends V1 with an offer system: buyers can make ETH offers on any
 *         tokenId (listed or not). The NFT owner accepts an offer to complete
 *         the sale.
 *
 * Upgrade notes:
 *  - Inherits all V1 storage. `offers` mapping is appended after V1's __gap.
 *  - `initializeV2` is a no-op reinitializer required by the OZ upgrades plugin.
 *  - CEI order in acceptOffer: NFT transferred before ETH distributed.
 */
contract SpaceMarketplaceV2 is SpaceMarketplaceV1 {

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // Storage (appended after V1)
    // nftContract => tokenId => bidder => offered ETH
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public offers;

    // Events
    event OfferMade(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 amount
    );
    event OfferAccepted(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        address bidder,
        uint256 amount
    );
    event OfferWithdrawn(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed bidder,
        uint256 amount
    );

    // Errors
    error NoOfferToWithdraw();
    error OfferAlreadyExists();
    error NoOfferFromBidder();
    error NotNFTOwnerForOffer();

    // Reinitializer

    /**
     * @notice Called once during the V1→V2 upgrade via upgradeProxy.
     *         Parent contracts are already initialized from V1 — no re-init needed.
     * @custom:oz-upgrades-unsafe-allow missing-initializer
     */
    function initializeV2() external reinitializer(2) {}

    // Offer functions

    /**
     * @notice Make an ETH offer on any NFT (listed or not).
     *         The offered ETH is held by the contract until accepted or withdrawn.
     */
    function makeOffer(
        address nftContract,
        uint256 tokenId
    ) external payable nonReentrant {
        if (msg.value == 0) revert ZeroPrice();
        if (offers[nftContract][tokenId][msg.sender] != 0)
            revert OfferAlreadyExists();

        offers[nftContract][tokenId][msg.sender] = msg.value;
        emit OfferMade(nftContract, tokenId, msg.sender, msg.value);
    }

    /**
     * @notice Accept an offer from a specific bidder.
     * @dev CEI order: zero out offer, cancel listing, transfer NFT, then distribute ETH.
     */
    function acceptOffer(
        address nftContract,
        uint256 tokenId,
        address bidder
    ) external nonReentrant {
        IERC721 nft = IERC721(nftContract);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotNFTOwnerForOffer();
        if (
            nft.getApproved(tokenId) != address(this) &&
            !nft.isApprovedForAll(msg.sender, address(this))
        ) revert MarketplaceNotApproved();

        uint256 offerAmount = offers[nftContract][tokenId][bidder];
        if (offerAmount == 0) revert NoOfferFromBidder();

        // Effects
        offers[nftContract][tokenId][bidder] = 0;
        if (listings[nftContract][tokenId].active) {
            listings[nftContract][tokenId].active = false;
            emit NFTDelisted(nftContract, tokenId);
        }

        // Interactions — NFT transfer first, then ETH
        nft.safeTransferFrom(msg.sender, bidder, tokenId);

        _executePayouts(nftContract, tokenId, offerAmount, payable(msg.sender));

        emit OfferAccepted(nftContract, tokenId, msg.sender, bidder, offerAmount);
    }

    /**
     * @notice Withdraw a previously made offer and reclaim the ETH.
     */
    function withdrawOffer(
        address nftContract,
        uint256 tokenId
    ) external nonReentrant {
        uint256 offerAmount = offers[nftContract][tokenId][msg.sender];
        if (offerAmount == 0) revert NoOfferToWithdraw();

        // Effects
        offers[nftContract][tokenId][msg.sender] = 0;

        // Interactions
        (bool ok, ) = payable(msg.sender).call{value: offerAmount}("");
        if (!ok) revert ETHTransferFailed();

        emit OfferWithdrawn(nftContract, tokenId, msg.sender, offerAmount);
    }
}
