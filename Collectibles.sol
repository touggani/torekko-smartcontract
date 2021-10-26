// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

// DELETE ALL REVERT STRINGS BEFORE FINAL DEPLOYEMENT (?)

contract Collectibles is ERC721URIStorage, Ownable, Pausable {
    
    /// @dev compteur de l’id des tokens
    using Counters for Counters.Counter;
    Counters.Counter _tokenIds;
    
    mapping(uint => uint[3]) public boosterDetails;
    mapping(address => bool) public isWhitelisted;

    /// booster[id de la serie][id de la saison][nombre de nft][id du pack] = [NFTs dans le pack]
    mapping(uint => mapping(uint => mapping(uint => uint[][]))) private booster;
    
    string public baseURI;
    
    constructor() ERC721("Torekko", "TRKO") {
        isWhitelisted[msg.sender] = true;
    }
    
    //-------------- Override ERC721 functions ---------------------
    
    /// @dev Retourne le baseURI
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }
    
    //----------------- Standard functions -------------------------
    
    /// @dev Seul l’admin du contrat peut l’appeler, pour mettre en pause la plupart
    ///  des fonctions du contrat
    function pauseContract() external onlyOwner {
        _pause();
    }
    
    /// @dev Seul l’admin du contrat peut l’appeler, pour relancer la plupart
    ///  des fonctions du contrat
    function unpauseContract() external onlyOwner {
        _unpause();
    }
    
    /// @dev Seul l’admin du contrat peut l’appeler, pour changer le
    ///  baseURI
    function updateBaseURI(string memory newBaseURI) external onlyOwner {
        baseURI = newBaseURI;
    }
    
    /// @dev Retourne le nombre de Golden Goals NFT en émis
    function totalSupply() external view returns (uint256) {
        return _tokenIds.current();
    }
    
    /// @dev si l’utilisateur est sur la whitelist, il peut appeler cette fonction
    ///  et «mint» (créer) un NFT en renseignant ses métadonnées
    function mintNft(string memory metadatas) external whenNotPaused returns(uint256) {
        require(isWhitelisted[msg.sender]);
        _tokenIds.increment();
        _safeMint(msg.sender, _tokenIds.current());
        _setTokenURI(_tokenIds.current(), metadatas);
        return _tokenIds.current();
    }

    /// @dev Seul l’admin du contrat peut l’appeler, pour ajouter une adresse dans
    ///  la whitelist
    function addToWhitelist(address userAddress) external onlyOwner {
        isWhitelisted[userAddress] = true;
    }

    /// @dev Seul l’admin du contrat peut l’appeler, pour enlever une adresse de
    ///  la whitelist
    function removeFromWhitelist(address userAddress) external onlyOwner {
        isWhitelisted[userAddress] = false;
    }

    //--------------------- Boosters functions -----------------------
    
    function rand(uint interval) internal view returns(uint256)
    {
        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp + block.difficulty +
            ((uint256(keccak256(abi.encodePacked(block.coinbase)))) / (block.timestamp)) +
            block.gaslimit + 
            ((uint256(keccak256(abi.encodePacked(msg.sender)))) / (block.timestamp)) +
            block.number
        )));
        
        return (seed - ((seed / interval) * interval));
    }

    function assembleBooster(uint[] memory elements,
                            uint boosterId,
                            uint serieId,
                            uint seasonId) external onlyOwner {
        require(msg.sender != address(0));
        require(elements.length > 0);
        require(boosterDetails[boosterId][2] == 0, "Already engaged");
        booster[serieId][seasonId][elements.length].push(elements);
        boosterDetails[boosterId] = [serieId, seasonId, elements.length];
        for (uint i=0; i<elements.length; i++) {
            approve(address(this), elements[i]);
            boosterDetails[elements[i]] = [1000, 1000, 1000];
        }
    }

    function openBooster(uint boosterId) public virtual whenNotPaused {
        require(boosterDetails[boosterId][2] != 0 && boosterDetails[boosterId][2] != 1000, "Not a booster");
        require(msg.sender == ownerOf(boosterId), "It is not your token");
        require(msg.sender != address(0));
        uint elmtsId = rand(
            booster[boosterDetails[boosterId][0]][boosterDetails[boosterId][1]][boosterDetails[boosterId][2]]
            .length
            );
        _burn(boosterId);
        // Transfer the NFTs won
        for (uint i=0; i<booster[boosterDetails[boosterId][0]][boosterDetails[boosterId][1]][boosterDetails[boosterId][2]][elmtsId].length; i++) {
          uint wonNFT = booster[boosterDetails[boosterId][0]][boosterDetails[boosterId][1]][boosterDetails[boosterId][2]][elmtsId][i];
          this.safeTransferFrom(owner(), msg.sender, wonNFT);
        }
        // Delete the pack of NFTs IDs on the array
        for (uint i = elmtsId; i<booster[boosterDetails[boosterId][0]][boosterDetails[boosterId][1]][boosterDetails[boosterId][2]]
            .length-1; i++){
            booster[boosterDetails[boosterId][0]][boosterDetails[boosterId][1]][boosterDetails[boosterId][2]][i] 
            = booster[boosterDetails[boosterId][0]][boosterDetails[boosterId][1]][boosterDetails[boosterId][2]][i+1];
        }
        booster[boosterDetails[boosterId][0]][boosterDetails[boosterId][1]][boosterDetails[boosterId][2]].pop();
        delete boosterDetails[boosterId];
    }
}