// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Collectibles.sol";

contract TorekkoEngine is Ownable, Pausable {
    
    using SafeERC20 for IERC20;

    IERC20 public TRK;
    
    /// @dev adresse du compte d’torekkoAddr
    address payable public _torekkoAddr;

    // contient toutes les informations d’une enchère à savoir l’adresse du créateur,
    // de l’enchérisseur ayant la plus grosse mise, la durée de l’enchère, le nombre d’enchères,
    // l’id du token concerné, la date de début, le montant de la mise la plus importante et si
    // l’enchère a finalement été claimed et donc terminée par son créateur. 
    enum Status { pending, active, finished }
    struct Auction {
        address payable creator;
        address payable currentBidOwner;
        uint128 duration;
        uint128 bidCount;
        uint256 assetId;
        uint256 startTime;
        uint256 currentBidAmount;
        bool claimed;
    }
    
    // map tel que auctions[adresse du SC][ID de l’auction] = une «Auction»
    mapping(address => Auction[]) private auctions;
    
    // whitelist, map d’adresse de smart contracts à «true» si autorisés à intéragir avec engine
    mapping(address => bool) public authorizedSC;
    
    // map tel que selling[adresse du SC][ID du token] = prix de vente,
    // avec prix de vente = 0 si le token n’est pas à vendre
    mapping(address => mapping(uint => uint)) private selling;
    
    uint128 public royalties;
    
    event SellingSuccess(uint price, uint id, address seller, address buyer);
    
    constructor(address payable torekkoAddr, address _TRK) {
        royalties = 10;
        _torekkoAddr = torekkoAddr;
        TRK = IERC20(_TRK);
    }
    
    function registerAuthorizedSC(address sc) external onlyOwner {
        require(!authorizedSC[sc], "SC already registered");
        authorizedSC[sc] = true;
    }
    
    function cancelAuthorizedSC(address sc) external onlyOwner {
        authorizedSC[sc] = false;
    }
    
    function pauseContract() external onlyOwner {
        _pause();
    }
    
    function unpauseContract() external onlyOwner {
        _unpause();
    }
    
    function updateTRKContract(address _TRK) external onlyOwner {
        TRK = IERC20(_TRK);
    }
    
    function updateTeamAddress(address payable torekkoAddr) external onlyOwner {
        _torekkoAddr = torekkoAddr;
    }
    
    function updateRoyalties(uint128 _royalties) external onlyOwner {
        royalties = _royalties;
    }
    
    //--------------------- Booster selling functions ------------------------
    
    function putBoosterToSell(uint id, uint price) public virtual whenNotPaused {
        require(authorizedSC[msg.sender]);
        require(price > 0, "Price invalid");
        require(msg.sender != address(0));
        require(!isToSell(id) && !isInAuction(id), "This NFT is already to trade");
        selling[msg.sender][id] = price * 1000000000000000000;
    }
    
    function cancelBoosterSelling(uint id) public virtual {
        require(authorizedSC[msg.sender]);
        require(isToSell(id), "This token is not to sell");
        require(msg.sender != address(0));
        require(!isInAuction(id), "This NFT is in auction");
        selling[msg.sender][id] = 0;
    }
    
    function buyBooster(uint id, address BoosterSC) public virtual {
        require(authorizedSC[BoosterSC]);
        Collectibles boosterSC = Collectibles(BoosterSC);
        require(boosterSC.isBooster(id), "Not a booster");
        require(selling[BoosterSC][id] != 0, "This token is not to sell");
        require(msg.sender != address(0));
        TRK.safeTransferFrom(msg.sender, _torekkoAddr, selling[BoosterSC][id]);
        IERC721 NFT = IERC721(BoosterSC);
        selling[BoosterSC][id] = 0;
        /// safeTransfer to the buyer address
        NFT.safeTransferFrom(NFT.ownerOf(id), msg.sender, id);
    }
    
    //--------------------- Selling functions ------------------------
    
    function putToSell(uint id, uint price) public virtual whenNotPaused {
        require(authorizedSC[msg.sender]);
        require(price > 0, "Price invalid");
        require(msg.sender != address(0));
        require(!isToSell(id) && !isInAuction(id), "This NFT is already to trade");
        selling[msg.sender][id] = price * 1000000000000;
    }
    
    function cancelSelling(uint id) public virtual {
        require(authorizedSC[msg.sender]);
        require(isToSell(id), "This token is not to sell");
        require(msg.sender != address(0));
        require(!isInAuction(id), "This NFT is in auction");
        selling[msg.sender][id] = 0;
    }
    
    function buyNFT(uint id, address buyer) public payable virtual {
        require(authorizedSC[msg.sender]);
        require(isToSell(id), "This token is not to sell");
        require(msg.sender != address(0));
        require(!isInAuction(id), "This NFT is in auction");
        require(msg.value == getPrice(id), "Not the price");
        IERC721 NFT = IERC721(msg.sender);
        /// Bought-amount is transferred into a seller wallet and the fee to torekkoAddr
        payable(NFT.ownerOf(id)).transfer(msg.value * (100 - royalties) / 100);
        _torekkoAddr.transfer(msg.value * royalties / 100);
        selling[msg.sender][id] = 0;
        emit SellingSuccess(msg.value, id, NFT.ownerOf(id), buyer);
        /// safeTransfer to the buyer address
        NFT.safeTransferFrom(NFT.ownerOf(id), buyer, id);
    }
    
    function isToSell(uint256 id) public view virtual returns (bool) {
        return selling[msg.sender][id] != 0;
    }
    
    function getPrice(uint id) public view returns (uint) {
        return selling[msg.sender][id];
    }
    
    //--------------------- Auction part -----------------------
    
    function createAuction(uint256 _assetId,
                           uint256 _startPrice,
                           uint128 _duration,
                           address owner) external virtual whenNotPaused returns (uint256) {
        require(authorizedSC[msg.sender]);
        require(!isToSell(_assetId) && !isInAuction(_assetId), "This NFT is already to trade");
        
        Auction memory auction = Auction({
            creator: payable(owner),
            currentBidOwner: payable(address(0)),
            duration: _duration,
            bidCount: 0,
            assetId: _assetId,
            startTime: block.timestamp,
            currentBidAmount: _startPrice*1000000000000,
            claimed: false
        });
        auctions[msg.sender].push(auction);

        return auctions[msg.sender].length;
    }
    
    function bid(uint256 auctionIndex, address bidder) public payable virtual whenNotPaused {
        require(authorizedSC[msg.sender]);
        Auction storage auction = auctions[msg.sender][auctionIndex];
        require(bidder != auction.creator, "It is your NFT");
        require(isActive(auctionIndex), "Auction not active");
        require(msg.value > auction.currentBidAmount);

        // we got a better bid. Return tokens to the previous best bidder
        // and register the sender as `currentBidOwner`
        if (auction.bidCount != 0) {
            // return funds to the previous bidder
            auction.currentBidOwner.transfer(auction.currentBidAmount);
        }
        // register new bidder
        auction.currentBidAmount = msg.value;
        auction.currentBidOwner = payable(bidder);
        auction.bidCount++;
    }
    
    function isActive(uint256 index) internal view virtual returns (bool) { return getStatus(index) == Status.active; }
    
    function isPending(uint256 index) internal view virtual returns (bool) { return getStatus(index) == Status.pending; }

    function isFinished(uint256 index) internal view virtual returns (bool) { return getStatus(index) == Status.finished; }
    
    function isInAuction(uint256 auctionID) public view virtual returns (bool) {
        if(auctions[msg.sender].length == 0) {
            return false;
        }
        if(auctionID != 0) {
            return isActive(auctionID - 1) || isPending(auctionID - 1);
        }
        return false;
    }

    function getStatus(uint256 index) public view virtual returns (Status) {
        Auction storage auction = auctions[msg.sender][index];
        if (block.timestamp < auction.startTime + auction.duration * 1 minutes) {
            return Status.active;
        } else if (!auction.claimed) {
            return Status.pending;
        } else {
            return Status.finished;
        }
    }

    function getCurrentBidOwner(uint256 auctionIndex) public view virtual returns (address) {
        return auctions[msg.sender][auctionIndex].currentBidOwner;
    }

    function getCurrentBidAmount(uint256 auctionIndex) public view virtual returns (uint256) {
        return auctions[msg.sender][auctionIndex].currentBidAmount;
    }

    function getBidCount(uint256 auctionIndex) public view virtual returns (uint256) {
        return auctions[msg.sender][auctionIndex].bidCount;
    }
    
    function getAssetID(uint256 auctionIndex) public view virtual returns (uint256) {
        return auctions[msg.sender][auctionIndex].assetId;
    }

    function getWinner(uint256 auctionIndex) public view virtual returns (address) {
        require(isPending(auctionIndex) || isFinished(auctionIndex));
        return auctions[msg.sender][auctionIndex].currentBidOwner;
    }
    
    function getCreator(uint256 auctionIndex) public view virtual returns (address) {
        return auctions[msg.sender][auctionIndex].creator;
    }
    
    function acceptAuction(uint256 auctionIndex, address caller) public virtual {
        require(authorizedSC[msg.sender]);
        require(isPending(auctionIndex), "Can't finalize auction yet");
        Auction storage auction = auctions[msg.sender][auctionIndex];
        require(auction.creator == caller || owner() == caller, "Not your auction");
        IERC721 NFT = IERC721(msg.sender);
        auction.claimed = true;
        if(auction.currentBidOwner != address(0)) {
            // Process selling            
            auction.creator.transfer(auction.currentBidAmount * (100 - royalties) / 100);
            _torekkoAddr.transfer(auction.currentBidAmount * royalties / 100);
            NFT.safeTransferFrom(auction.creator, auction.currentBidOwner, auction.assetId);
            emit SellingSuccess(auction.currentBidAmount, auction.assetId, auction.creator, auction.currentBidOwner);
        } else {
            // No bet, no winner
            NFT.approve(address(0), auction.assetId);
        }
    }
}