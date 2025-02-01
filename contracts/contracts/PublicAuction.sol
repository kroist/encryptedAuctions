// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

contract PublicAuction {

    event AuctionCreated(
        uint256 indexed auctionId,
        address token,
        uint256 tokenAmount,
        address indexed bidToken,
        address indexed bidSequencer,
        uint256 floorPrice,
        uint256 startBlock,
        uint256 endBlock
    );

    error AuctionActive();
    error AuctionEnded();
    error AuctionNotStarted();
    error AuctionNotProcessed();
    error BidAlreadyPlaced();
    error BidNotHighEnough();
    error BidNotEnoughFunds();
    error BidZeroAmount();
    error WrongBidOrder();
    
    struct AuctionData {
        address token;
        uint256 tokenAmount;
        address bidToken;
        address bidSequencer;
        uint256 floorPrice;
        uint256 startBlock;
        uint256 endBlock;
        uint256 bidIndex;
        uint256 processedBidIndex;
        uint256 slidingSum;
        uint256 lastProcessedBidId;
        uint256 lastProcessedBidPrice;
        uint256 finalPrice;
    }

    struct Bid {
        uint256 price;
        uint256 amount;
        uint256 wonAmount;
    }

    mapping(uint256 => AuctionData) public auctions;

    mapping(uint256 => mapping(uint256 => Bid)) public bids;

    mapping(uint256 => mapping(address => uint256)) public bidId;

    mapping(uint256 => mapping(uint256 => bool)) public processedBids;

    mapping(uint256 => mapping(address => bool)) public claimed;

    uint256 public auctionIndex;

    constructor() {
        auctionIndex = 0;
    }

    function createAuction(
        address _token,
        uint256 _tokenAmount,
        address _bidToken,
        address _bidSequencer,
        uint256 _floorPrice,
        uint256 _startBlock,
        uint256 _endBlock
    ) public {
        // Create an auction

        auctions[auctionIndex] = AuctionData({
            token: _token,
            tokenAmount: _tokenAmount,
            bidToken: _bidToken,
            bidSequencer: _bidSequencer,
            floorPrice: _floorPrice,
            startBlock: _startBlock,
            endBlock: _endBlock,
            bidIndex: 1,
            processedBidIndex: 1,
            slidingSum: 0,
            lastProcessedBidId: 0,
            lastProcessedBidPrice: 0,
            finalPrice: 0
        });

        emit AuctionCreated(
            auctionIndex,
            _token,
            _tokenAmount,
            _bidToken,
            _bidSequencer,
            _floorPrice,
            _startBlock,
            _endBlock
        );

        auctionIndex++;
    }

    function placeBid(uint256 _auctionId, uint256 _price, uint256 _amount) public {
        // Bid on an auction

        AuctionData memory auction = auctions[_auctionId];

        if (block.number < auction.startBlock) {
            revert AuctionNotStarted();
        }

        if (block.number > auction.endBlock) {
            revert AuctionEnded();
        }

        if (_amount == 0) {
            revert BidZeroAmount();
        }

        if (_price < auction.floorPrice) {
            revert BidNotHighEnough();
        }

        if (bidId[_auctionId][msg.sender] != 0) {
            revert BidAlreadyPlaced();
        }


        bids[_auctionId][auction.bidIndex] = Bid({
            price: _price,
            amount: _amount,
            wonAmount: 0
        });

        bidId[_auctionId][msg.sender] = auctions[_auctionId].bidIndex;

        auctions[_auctionId].bidIndex++;
    }

    function processNextBid(uint256 _auctionId, uint256 _bidId) public {
        if (block.number < auctions[_auctionId].endBlock) {
            revert AuctionActive();
        }

        if (processedBids[_auctionId][_bidId]) {
            revert BidAlreadyPlaced();
        }

        AuctionData memory auction = auctions[_auctionId];

        Bid memory bid = bids[_auctionId][_bidId];

        uint256 previousSlidingSum = auction.slidingSum;

        if (auction.processedBidIndex == 1) {
            auction.slidingSum = bid.amount;
            auction.lastProcessedBidId = _bidId;
            auction.lastProcessedBidPrice = bid.price;
        } else {
            // sort the bids in descending order by price, ascending order by bidId
            if (
                (auction.lastProcessedBidPrice > bid.price) ||
                (auction.lastProcessedBidPrice == bid.price && auction.lastProcessedBidId < _bidId)
            ) {
                auction.slidingSum += bid.amount;
                auction.lastProcessedBidId = _bidId;
                auction.lastProcessedBidPrice = bid.price;
            } else {
                revert WrongBidOrder();
            }
        }

        if (auction.slidingSum <= auction.tokenAmount) {
            bids[_auctionId][_bidId].wonAmount = bid.amount;
            auction.finalPrice = bid.price;
        }
        else if (previousSlidingSum < auction.tokenAmount) {
            bids[_auctionId][_bidId].wonAmount = auction.tokenAmount - previousSlidingSum;
            auction.finalPrice = bid.price;
        }

        processedBids[_auctionId][_bidId] = true;
        auction.processedBidIndex++;
        auctions[_auctionId] = auction;
    }

    function claim(uint256 _auctionId) public {
        // Claim the auction

        // AuctionData memory auction = auctions[_auctionId];

        // if (auction.processedBidIndex < auction.bidIndex) {
        //     revert AuctionNotProcessed();
        // }

        // Bid memory bid = bids[_auctionId][bidId[_auctionId][msg.sender]];

        // uint256 amount = bid.wonAmount * auction.finalPrice;

        claimed[_auctionId][msg.sender] = true;
    }
}
