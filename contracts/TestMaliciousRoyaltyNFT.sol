// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title TestMaliciousRoyaltyNFT
 * @notice TEST-ONLY contract, intentionally "malicious".
 *
 * This mock is used to verify that `SpaceMarketplace` correctly protects
 * itself against an ERC-721 / ERC-2981 contract that returns an absurd
 * royalty amount, or a royalty larger than the sale price, in `royaltyInfo()`.
 *
 * Why this matters:
 * - in production, the marketplace can receive listings from arbitrary NFT collections;
 * - an external NFT contract may implement ERC-2981 incorrectly or maliciously;
 * - this mock forces that edge case and checks that buying reverts cleanly with
 *   `InvalidRoyaltyAmount` instead of breaking seller payout accounting.
 *
 * Important:
 * - this contract is NOT part of the marketplace business logic;
 * - it must NOT be deployed as the official NFT collection;
 * - it only exists for Hardhat security tests.
 */
contract TestMaliciousRoyaltyNFT is ERC721, IERC2981, Ownable {
    uint256 private _forcedRoyaltyAmount;

    constructor(
        address initialOwner
    ) ERC721("Malicious Royalty NFT", "MRNFT") Ownable(initialOwner) {}

    function mint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
    }

    function setForcedRoyaltyAmount(uint256 forcedRoyaltyAmount) external {
        _forcedRoyaltyAmount = forcedRoyaltyAmount;
    }

    function royaltyInfo(
        uint256,
        uint256
    ) public view override returns (address, uint256) {
        return (owner(), _forcedRoyaltyAmount);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, IERC165) returns (bool) {
        return
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
