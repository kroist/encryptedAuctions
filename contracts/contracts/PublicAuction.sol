// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PublicAuction {
    uint256 public constant SEQUENCER_STAKE = 1000;

    event AuctionCreated(
        address token,
        uint256 tokenAmount,
        address bidToken,
        address indexed bidSequencer,
        uint256 floorPrice,
        uint256 startTime,
        uint256 endTime,
        address indexed creator
    );

    error AlreadyClaimed();
    error AuctionNotActive();
    error AuctionAlreadyCreated();
    error AuctionNotEnded();
    error AuctionNotProcessed();
    error BidAlreadyPlaced();
    error BidNotHighEnough();
    error BidZeroAmount();
    error UnauthorizedAccount();
    error WrongBidOrder();
    error WrongArguments();

    struct AuctionData {
        address token;
        uint256 tokenAmount;
        address bidToken;
        address bidSequencer;
        uint256 floorPrice;
        uint256 startTime;
        uint256 endTime;
        uint256 bidIndex;
        uint256 processedBidIndex;
        uint256 slidingSum;
        uint256 lastProcessedBidId;
        uint256 finalPrice;
        address creator;
    }

    struct Bid {
        uint256 price;
        uint256 amount;
        uint256 wonAmount;
    }

    AuctionData public auctionData;

    mapping(uint256 => Bid) public bids;

    mapping(address => uint256) public bidId;

    mapping(uint256 => bool) public processedBids;

    mapping(address => bool) public claimed;

    // bool public sequencerStaked;
    bool public auctionCreated;

    constructor() {}

    function createAuction(
        address _token,
        uint256 _tokenAmount,
        address _bidToken,
        address _bidSequencer,
        uint256 _floorPrice,
        uint256 _startTime,
        uint256 _endTime
    ) public {
        if (auctionCreated) {
            revert AuctionAlreadyCreated();
        }
        // Create an auction
        auctionCreated = true;

        if (_startTime >= _endTime) {
            revert WrongArguments();
        }

        if (_tokenAmount == 0) {
            revert BidZeroAmount();
        }

        auctionData = AuctionData({
            token: _token,
            tokenAmount: _tokenAmount,
            bidToken: _bidToken,
            bidSequencer: _bidSequencer,
            floorPrice: _floorPrice,
            startTime: _startTime,
            endTime: _endTime,
            bidIndex: 1,
            processedBidIndex: 1,
            slidingSum: 0,
            lastProcessedBidId: 0,
            finalPrice: 0,
            creator: msg.sender
        });

        // Transfer the token to the auction contract
        IERC20(_token).transferFrom(msg.sender, address(this), _tokenAmount);

        emit AuctionCreated(
            _token,
            _tokenAmount,
            _bidToken,
            _bidSequencer,
            _floorPrice,
            _startTime,
            _endTime,
            msg.sender
        );
    }

    function placeBid(uint256 _price, uint256 _amount) public {
        // Bid on an auction

        if (!isAuctionActive()) {
            revert AuctionNotActive();
        }

        if (_amount == 0) {
            revert BidZeroAmount();
        }

        if (_price < auctionData.floorPrice) {
            revert BidNotHighEnough();
        }

        if (bidId[msg.sender] != 0) {
            revert BidAlreadyPlaced();
        }

        bids[auctionData.bidIndex] = Bid({ price: _price, amount: _amount, wonAmount: 0 });

        bidId[msg.sender] = auctionData.bidIndex;

        IERC20(auctionData.bidToken).transferFrom(msg.sender, address(this), _price * _amount);

        auctionData.bidIndex++;
    }

    function processNextBid(uint256 _bidId) public {
        if (auctionData.bidSequencer != msg.sender) {
            revert UnauthorizedAccount();
        }

        if (!isAuctionEnded()) {
            revert AuctionNotEnded();
        }

        if (processedBids[_bidId]) {
            revert BidAlreadyPlaced();
        }

        Bid memory bid = bids[_bidId];

        uint256 previousSlidingSum = auctionData.slidingSum;

        if (auctionData.processedBidIndex == 1) {
            auctionData.slidingSum = bid.amount;
            auctionData.lastProcessedBidId = _bidId;
        } else {
            Bid memory lastProcessedBid = bids[auctionData.lastProcessedBidId];
            // sort the bids in descending order by price, ascending order by bidId
            if (
                (lastProcessedBid.price > bid.price) ||
                (lastProcessedBid.price == bid.price && auctionData.lastProcessedBidId < _bidId)
            ) {
                auctionData.slidingSum += bid.amount;
                auctionData.lastProcessedBidId = _bidId;
            } else {
                revert WrongBidOrder();
            }
        }

        if (auctionData.slidingSum <= auctionData.tokenAmount) {
            bids[_bidId].wonAmount = bid.amount;
            auctionData.finalPrice = bid.price;
        } else if (previousSlidingSum < auctionData.tokenAmount) {
            bids[_bidId].wonAmount = auctionData.tokenAmount - previousSlidingSum;
            auctionData.finalPrice = bid.price;
        }

        processedBids[_bidId] = true;
        auctionData.processedBidIndex++;
    }

    function claim() public {
        // Claim the auction

        if (!isAuctionEnded()) {
            revert AuctionNotEnded();
        }

        if (auctionData.processedBidIndex < auctionData.bidIndex) {
            revert AuctionNotProcessed();
        }

        if (claimed[msg.sender]) {
            revert AlreadyClaimed();
        }

        Bid memory bid = bids[bidId[msg.sender]];

        claimed[msg.sender] = true;

        IERC20(auctionData.token).transfer(msg.sender, bid.wonAmount);

        // if won, finalPrice is always <= bid.price
        uint256 refund = bid.price * bid.amount - bid.wonAmount * auctionData.finalPrice;

        IERC20(auctionData.bidToken).transfer(msg.sender, refund);
    }

    function claimOwner() public {
        // Claim the auction as the owner

        if (!isAuctionEnded()) {
            revert AuctionNotEnded();
        }

        if (auctionData.processedBidIndex < auctionData.bidIndex) {
            revert AuctionNotProcessed();
        }

        if (claimed[auctionData.creator]) {
            revert AlreadyClaimed();
        }

        claimed[auctionData.creator] = true;

        // if not all tokens were sold, return them to the owner
        if (auctionData.slidingSum < auctionData.tokenAmount) {
            IERC20(auctionData.token).transfer(auctionData.creator, auctionData.tokenAmount - auctionData.slidingSum);
            IERC20(auctionData.bidToken).transfer(auctionData.creator, auctionData.slidingSum * auctionData.finalPrice);
        } else {
            IERC20(auctionData.bidToken).transfer(
                auctionData.creator,
                auctionData.tokenAmount * auctionData.finalPrice
            );
        }
    }

    function isAuctionStarted() internal view returns (bool) {
        return block.timestamp >= auctionData.startTime;
    }

    function isAuctionEnded() internal view returns (bool) {
        return block.timestamp >= auctionData.endTime;
    }

    function isAuctionActive() internal view returns (bool) {
        return isAuctionStarted() && !isAuctionEnded();
    }
}
