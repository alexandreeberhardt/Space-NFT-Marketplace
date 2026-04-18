// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title SpaceInvaderNFTV2
 * @notice V2 upgrade of SpaceInvaderNFT.
 *         Adds an optional max-supply cap controllable by the owner.
 *         All V1 state (tokenIds, tokenURIs, royalties, ownership) is preserved.
 *
 * Storage layout (must match V1 exactly for existing slots):
 *   slot 0 : _nextTokenId (V1)
 *   slot 1 : _totalMinted (V1)
 *   slot 2 : maxSupply (V2 - taken from __gap)
 *   slots 3-49 : __gap[47] (reduced from V1's __gap[48])
 */
contract SpaceInvaderNFTV2 is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ERC2981Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // V1 storage - DO NOT reorder or remove
    uint256 private _nextTokenId;
    uint256 private _totalMinted;

    // V2 storage - appended (consumes one slot from __gap)
    uint256 public maxSupply;

    uint256[47] private __gap;

    // Errors (V1)
    error ZeroAddress();
    error RoyaltyTooHigh();
    error EmptyTokenURI();

    // Errors (V2)
    error MaxSupplyReached();
    error MaxSupplyTooLow();

    // Events (V1)
    event NFTMinted(
        uint256 indexed tokenId,
        address indexed minter,
        address indexed recipient,
        string uri
    );

    // Events (V2)
    event MaxSupplyUpdated(uint256 newMaxSupply);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // -------------------------------------------------------------------------
    // V2 initializer (called once during upgrade)
    // -------------------------------------------------------------------------

    /**
     * @dev Upgrade initializer - called once during the v1->v2 proxy upgrade.
     *      Parent contracts are already initialized from V1; calling them again
     *      here is intentionally omitted (they are no-ops after first init).
     *      maxSupply defaults to 0 (no cap) - no new state to set.
     * @custom:oz-upgrades-unsafe-allow missing-initializer
     */
    function initializeV2() external reinitializer(2) {}

    // -------------------------------------------------------------------------
    // V2 feature: optional max-supply cap
    // -------------------------------------------------------------------------

    /**
     * @notice Sets the maximum number of tokens that can ever be minted.
     *         Pass 0 to remove the cap.
     * @param _maxSupply New cap. Must be >= current total supply (or 0).
     */
    function setMaxSupply(uint256 _maxSupply) external onlyOwner {
        if (_maxSupply != 0 && _maxSupply < _totalMinted) revert MaxSupplyTooLow();
        maxSupply = _maxSupply;
        emit MaxSupplyUpdated(_maxSupply);
    }

    // -------------------------------------------------------------------------
    // Minting (same interface as V1, now cap-aware)
    // -------------------------------------------------------------------------

    function mint(string calldata uri) external returns (uint256 tokenId) {
        return safeMint(msg.sender, uri);
    }

    function safeMint(
        address to,
        string calldata uri
    ) public returns (uint256 tokenId) {
        if (bytes(uri).length == 0) revert EmptyTokenURI();
        if (maxSupply != 0 && _totalMinted >= maxSupply) revert MaxSupplyReached();

        tokenId = _nextTokenId++;
        _totalMinted += 1;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit NFTMinted(tokenId, msg.sender, to, uri);
    }

    function totalSupply() external view returns (uint256) {
        return _totalMinted;
    }

    // -------------------------------------------------------------------------
    // Upgrade authorisation
    // -------------------------------------------------------------------------

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // -------------------------------------------------------------------------
    // Required overrides
    // -------------------------------------------------------------------------

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
