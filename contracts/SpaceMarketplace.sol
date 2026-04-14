// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title SpaceMarketplace
 * @notice Fixed-price NFT marketplace with ERC-2981 royalty support and an
 *         ETH offer system for listed or unlisted tokens.
 */
contract SpaceMarketplace is Ownable {
    struct Listing {
        address payable seller;
        uint256 price;
        bool active;
    }

    uint256 public platformFeeBps;
    address payable public feeRecipient;

    mapping(address => mapping(uint256 => Listing)) public listings;
    mapping(address => mapping(uint256 => mapping(address => uint256)))
        public offers;

    uint256 private _reentrancyStatus;
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

    error ReentrantCall();
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
    error NoOfferToWithdraw();
    error OfferAlreadyExists();
    error NoOfferFromBidder();
    error NotNFTOwnerForOffer();
    error InvalidRoyaltyAmount();

    constructor(
        uint256 _platformFeeBps,
        address payable _feeRecipient
    ) Ownable(msg.sender) {
        if (_platformFeeBps > 1000) revert FeeTooHigh();
        if (_feeRecipient == address(0)) revert ZeroAddress();

        platformFeeBps = _platformFeeBps;
        feeRecipient = _feeRecipient;
        _reentrancyStatus = 1;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus == 2) revert ReentrantCall();
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

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

    function buyNFT(
        address nftContract,
        uint256 tokenId
    ) external payable nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];
        IERC721 nft = IERC721(nftContract);

        if (!listing.active) revert NotListed();
        if (msg.value != listing.price) revert IncorrectETHAmount();
        if (nft.ownerOf(tokenId) != listing.seller) revert NotNFTOwner();

        listings[nftContract][tokenId].active = false;

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

        offers[nftContract][tokenId][bidder] = 0;

        if (listings[nftContract][tokenId].active) {
            listings[nftContract][tokenId].active = false;
            emit NFTDelisted(nftContract, tokenId);
        }

        _executePayouts(nftContract, tokenId, offerAmount, payable(msg.sender));
        nft.safeTransferFrom(msg.sender, bidder, tokenId);

        emit OfferAccepted(
            nftContract,
            tokenId,
            msg.sender,
            bidder,
            offerAmount
        );
    }

    function withdrawOffer(
        address nftContract,
        uint256 tokenId
    ) external nonReentrant {
        uint256 offerAmount = offers[nftContract][tokenId][msg.sender];
        if (offerAmount == 0) revert NoOfferToWithdraw();

        offers[nftContract][tokenId][msg.sender] = 0;

        (bool ok, ) = payable(msg.sender).call{value: offerAmount}("");
        if (!ok) revert ETHTransferFailed();

        emit OfferWithdrawn(nftContract, tokenId, msg.sender, offerAmount);
    }

    function _executePayouts(
        address nftContract,
        uint256 tokenId,
        uint256 totalPrice,
        address payable seller
    ) private {
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
        if (royaltyAmount + platformFee > totalPrice) {
            revert InvalidRoyaltyAmount();
        }
        uint256 sellerAmount = totalPrice - royaltyAmount - platformFee;

        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool okRoyalty, ) = payable(royaltyReceiver).call{
                value: royaltyAmount
            }("");
            if (!okRoyalty) revert ETHTransferFailed();
        }

        if (platformFee > 0) {
            (bool okFee, ) = feeRecipient.call{value: platformFee}("");
            if (!okFee) revert ETHTransferFailed();
        }

        (bool okSeller, ) = seller.call{value: sellerAmount}("");
        if (!okSeller) revert ETHTransferFailed();
    }
}
