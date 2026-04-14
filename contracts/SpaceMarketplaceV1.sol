// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title SpaceMarketplaceV1
 * @notice Fixed-price NFT marketplace with ERC-2981 royalty support.
 *         Deployed behind a UUPS proxy. V2 adds an offer system.
 *
 * Security:
 *  - Checks-Effects-Interactions pattern: listing deactivated, NFT transferred,
 *    then ETH distributed.
 *  - Reentrancy guard implemented inline (avoids OZ base constructor conflict).
 *  - ETH sent via .call to support smart-contract wallets.
 *  - Platform fee capped at 10%.
 */
contract SpaceMarketplaceV1 is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    struct Listing {
        address payable seller;
        uint256 price;
        bool active;
    }

    // Storage (order must never change for upgrade safety)
    uint256 public platformFeeBps;
    address payable public feeRecipient;
    mapping(address => mapping(uint256 => Listing)) public listings;
    uint256 private _reentrancyStatus; // 1 = not entered, 2 = entered

    // Storage gap: 44 slots reserved for future versions.
    uint256[44] private __gap;

    // Reentrancy guard
    error ReentrantCall();

    modifier nonReentrant() {
        if (_reentrancyStatus == 2) revert ReentrantCall();
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    // Events
    event NFTListed(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );
    event NFTSold(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        address buyer,
        uint256 price
    );
    event NFTDelisted(address indexed nftContract, uint256 indexed tokenId);

    // Errors
    error ZeroPrice();
    error NotNFTOwner();
    error MarketplaceNotApproved();
    error AlreadyListed();
    error NotListed();
    error IncorrectETHAmount();
    error NotSeller();
    error FeeTooHigh();
    error ZeroAddress();
    error ETHTransferFailed();
    error InvalidRoyaltyAmount();

    // Initializer
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        uint256 _platformFeeBps,
        address payable _feeRecipient
    ) external initializer {
        if (_platformFeeBps > 1000) revert FeeTooHigh();
        if (_feeRecipient == address(0)) revert ZeroAddress();

        __Ownable_init(msg.sender);

        platformFeeBps = _platformFeeBps;
        feeRecipient = _feeRecipient;
        _reentrancyStatus = 1;
    }

    // Listing

    function listNFT(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external nonReentrant {
        if (price == 0) revert ZeroPrice();

        IERC721 nft = IERC721(nftContract);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotNFTOwner();
        if (
            nft.getApproved(tokenId) != address(this) &&
            !nft.isApprovedForAll(msg.sender, address(this))
        ) revert MarketplaceNotApproved();
        if (listings[nftContract][tokenId].active) revert AlreadyListed();

        listings[nftContract][tokenId] = Listing({
            seller: payable(msg.sender),
            price: price,
            active: true
        });

        emit NFTListed(nftContract, tokenId, msg.sender, price);
    }

    function cancelListing(
        address nftContract,
        uint256 tokenId
    ) external nonReentrant {
        Listing storage listing = listings[nftContract][tokenId];
        if (!listing.active) revert NotListed();
        if (msg.sender != listing.seller && msg.sender != owner())
            revert NotSeller();

        listing.active = false;
        emit NFTDelisted(nftContract, tokenId);
    }

    // Purchase

    /**
     * @notice Buy a listed NFT at the exact listed price.
     * @dev CEI order: checks → deactivate listing → transfer NFT → distribute ETH.
     *      Transferring the NFT before ETH payouts prevents any ETH receiver from
     *      re-entering while the token is still in the seller's wallet.
     */
    function buyNFT(
        address nftContract,
        uint256 tokenId
    ) external payable nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];
        IERC721 nft = IERC721(nftContract);

        // Checks
        if (!listing.active) revert NotListed();
        if (msg.value != listing.price) revert IncorrectETHAmount();
        if (nft.ownerOf(tokenId) != listing.seller) revert NotNFTOwner();

        // Effects
        listings[nftContract][tokenId].active = false;

        // Interactions — NFT transfer first, then ETH
        nft.safeTransferFrom(listing.seller, msg.sender, tokenId);

        _executePayouts(nftContract, tokenId, listing.price, listing.seller);

        emit NFTSold(
            nftContract,
            tokenId,
            listing.seller,
            msg.sender,
            listing.price
        );
    }

    // Admin

    function updatePlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 1000) revert FeeTooHigh();
        platformFeeBps = newFeeBps;
    }

    function updateFeeRecipient(
        address payable newRecipient
    ) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;
    }

    // Internal helpers

    function _executePayouts(
        address nftContract,
        uint256 tokenId,
        uint256 totalPrice,
        address payable seller
    ) internal {
        uint256 royaltyAmount = 0;
        address royaltyReceiver = address(0);

        try IERC2981(nftContract).royaltyInfo(tokenId, totalPrice) returns (
            address receiver,
            uint256 amount
        ) {
            royaltyReceiver = receiver;
            royaltyAmount = amount;
        } catch {}

        uint256 platformFee = (totalPrice * platformFeeBps) / 10_000;
        if (royaltyAmount + platformFee > totalPrice) revert InvalidRoyaltyAmount();
        uint256 sellerAmount = totalPrice - royaltyAmount - platformFee;

        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool okRoyalty, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            if (!okRoyalty) revert ETHTransferFailed();
        }
        if (platformFee > 0) {
            (bool okFee, ) = feeRecipient.call{value: platformFee}("");
            if (!okFee) revert ETHTransferFailed();
        }
        (bool okSeller, ) = seller.call{value: sellerAmount}("");
        if (!okSeller) revert ETHTransferFailed();
    }

    // Upgrade authorisation
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
