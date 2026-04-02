// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title SpaceInvaderNFT
 * @notice ERC-721 collection of procedurally generated Space Invader NFTs.
 *         Supports ERC-2981 royalties. Deployed behind a UUPS proxy.
 */
contract SpaceInvaderNFT is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ERC2981Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // Storage

    uint256 private _nextTokenId;
    uint256 private _totalMinted;
    uint256[48] private __gap;

    // Errors

    error ZeroAddress();
    error RoyaltyTooHigh();
    error EmptyTokenURI();

    // Events

    event NFTMinted(
        uint256 indexed tokenId,
        address indexed minter,
        address indexed recipient,
        string uri
    );

    // Initializer

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @param initialOwner Address that receives ownership and royalties.
     * @param royaltyFraction Royalty in basis points (e.g. 500 = 5%).
     */
    function initialize(
        address initialOwner,
        uint96 royaltyFraction
    ) external initializer {
        if (initialOwner == address(0)) revert ZeroAddress();
        if (royaltyFraction > 1000) revert RoyaltyTooHigh(); // cap at 10%

        __ERC721_init("Space Invader", "SINV");
        __ERC721URIStorage_init();
        __ERC2981_init();
        __Ownable_init(initialOwner);

        _nextTokenId = 1;
        _setDefaultRoyalty(initialOwner, royaltyFraction);
    }

    // Minting

    /**
     * @notice Mints a new Space Invader NFT to the caller with the given IPFS metadata URI.
     * @return tokenId The newly minted token ID.
     */
    function mint(string calldata uri) external returns (uint256 tokenId) {
        return safeMint(msg.sender, uri);
    }

    /**
     * @notice Mints a new Space Invader NFT to `to` with the given IPFS metadata URI.
     * @dev Public minting lets end users pay gas for their own minting flow.
     * @return tokenId The newly minted token ID.
     */
    function safeMint(
        address to,
        string calldata uri
    ) public returns (uint256 tokenId) {
        if (bytes(uri).length == 0) revert EmptyTokenURI();

        tokenId = _nextTokenId++;
        _totalMinted += 1;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit NFTMinted(tokenId, msg.sender, to, uri);
    }

    /**
     * @notice Returns the number of minted NFTs in the collection.
     * @dev This replaces ERC721Enumerable's `totalSupply` without paying its transfer overhead.
     */
    function totalSupply() external view returns (uint256) {
        return _totalMinted;
    }

    // Upgrade authorisation

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(
            ERC721Upgradeable,
            ERC721URIStorageUpgradeable,
            ERC2981Upgradeable
        )
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
