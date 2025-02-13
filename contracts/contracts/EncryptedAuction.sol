// SPDX-License-Identifier: BSD-3-Clause-Clear

pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/config/ZamaFHEVMConfig.sol";
import "fhevm/config/ZamaGatewayConfig.sol";
import "fhevm/gateway/GatewayCaller.sol";
import { IConfidentialERC20 } from "fhevm-contracts/contracts/token/ERC20/IConfidentialERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712Upgradeable } from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";

import { console } from "hardhat/console.sol";

contract EncryptedAuction is EIP712Upgradeable, GatewayCaller {
    uint256 public constant MAX_AUCTION_DURATION = 30 days;
    uint256 public constant SLASHING_DURATION = 7 days;
    bytes32 constant AUCTION_DATA_TYPEHASH =
        keccak256(
            "AuctionData(address token,uint64 tokenAmount,address bidToken,address bidSequencer,uint64 floorPrice,uint256 startTime,uint256 endTime,address stakeToken,uint256 stakeAmount)"
        );
    event AuctionCreated(
        address token,
        uint64 tokenAmount,
        address bidToken,
        address indexed bidSequencer,
        uint64 floorPrice,
        uint256 startTime,
        uint256 endTime,
        address indexed creator
    );

    error AlreadyClaimed();
    error AuctionNotActive();
    error AuctionAlreadyCreated();
    error AuctionNotEnded();
    error AuctionNotProcessed();
    error AuctionProcessed();
    error BidAlreadyPlaced();
    error BidNotHighEnough();
    error BidZeroAmount();
    error NotEnoughStake();
    error SlashingPeriod();
    error UnauthorizedAccount();
    error WrongBidOrder();
    error WrongArguments();

    struct AuctionData {
        address token;
        uint64 tokenAmount;
        address bidToken;
        address bidSequencer;
        uint64 floorPrice;
        uint256 startTime;
        uint256 endTime;
        uint256 bidIndex;
        uint256 processedBidIndex;
        euint128 slidingSum;
        uint256 lastProcessedBidId;
        euint64 finalPrice;
        address creator;
    }

    struct Bid {
        euint64 price;
        euint64 amount;
        euint64 wonAmount;
        address creator;
    }

    AuctionData public auctionData;

    mapping(uint256 => Bid) public bids;

    mapping(address => uint256) public bidId;

    mapping(uint256 => bool) public processedBids;

    mapping(address => bool) public claimed;

    mapping(address => uint256) public sequencerStake;

    bool public auctionCreated;

    address stakeToken;

    euint128 maxU64;
    euint64 zeroU64;

    address contractCreator;

    constructor() {
        // _disableInitializers();
    }

    function initialize(address _contractCreator) public initializer {
        TFHE.setFHEVM(ZamaFHEVMConfig.getSepoliaConfig());
        Gateway.setGateway(ZamaGatewayConfig.getSepoliaConfig());

        contractCreator = _contractCreator;
        auctionCreated = false;
        maxU64 = TFHE.asEuint128(2 ** 64 - 1);
        TFHE.allowThis(maxU64);
        zeroU64 = TFHE.asEuint64(0);
        TFHE.allowThis(zeroU64);
        __EIP712_init("EncryptedAuction", "1");
    }

    function createAuction(
        address _token,
        uint64 _tokenAmount,
        address _bidToken,
        address _bidSequencer,
        uint64 _floorPrice,
        uint256 _startTime,
        uint256 _endTime,
        address _stakeToken,
        uint256 _stakeAmount,
        bytes memory _sequencerSignature
    ) public {
        if (msg.sender != contractCreator) {
            revert UnauthorizedAccount();
        }
        // check sequencer signature
        bytes32 message = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    AUCTION_DATA_TYPEHASH,
                    _token,
                    _tokenAmount,
                    _bidToken,
                    _bidSequencer,
                    _floorPrice,
                    _startTime,
                    _endTime,
                    _stakeToken,
                    _stakeAmount
                )
            )
        );
        address recoveredAddress = ECDSA.recover(message, _sequencerSignature);
        if (recoveredAddress != _bidSequencer) {
            revert UnauthorizedAccount();
        }

        // transfer sequencer's stake
        stakeToken = _stakeToken;
        IERC20(_stakeToken).transferFrom(_bidSequencer, address(this), _stakeAmount);

        if (auctionCreated) {
            revert AuctionAlreadyCreated();
        }
        // Create an auction
        auctionCreated = true;

        if (_startTime >= _endTime) {
            revert WrongArguments();
        }

        if (_startTime + MAX_AUCTION_DURATION < _endTime) {
            revert WrongArguments();
        }

        if (_tokenAmount == 0) {
            revert BidZeroAmount();
        }

        euint128 _slidingSum = TFHE.asEuint128(0);
        TFHE.allowThis(_slidingSum);

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
            slidingSum: _slidingSum,
            lastProcessedBidId: 0,
            finalPrice: zeroU64,
            creator: msg.sender
        });

        // Transfer the token to the auction contract
        euint64 _eTokenAmount = TFHE.asEuint64(_tokenAmount);
        TFHE.allowTransient(_eTokenAmount, _token);
        IConfidentialERC20(_token).transferFrom(msg.sender, address(this), _eTokenAmount);

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

    function placeBid(einput _priceEncr, einput _amountEncr, bytes calldata inputProof) public {
        euint64 _price = TFHE.asEuint64(_priceEncr, inputProof);
        euint64 _amount = TFHE.asEuint64(_amountEncr, inputProof);

        euint128 _price128 = TFHE.asEuint128(_price);
        euint128 _amount128 = TFHE.asEuint128(_amount);

        euint128 _amount_bid = TFHE.mul(_price128, _amount128);
        // Bid on an auction

        if (!isAuctionActive()) {
            revert AuctionNotActive();
        }

        if (bidId[msg.sender] != 0) {
            revert BidAlreadyPlaced();
        }

        if (auctionData.creator == msg.sender) {
            revert UnauthorizedAccount();
        }

        ebool amountGreaterThanZero = TFHE.gt(_amount, 0);
        ebool priceGreaterThanFloor = TFHE.ge(_price, auctionData.floorPrice);
        ebool bidAmountNotOverflowing = TFHE.le(_amount_bid, maxU64);

        ebool inputsCorrect = TFHE.and(TFHE.and(amountGreaterThanZero, priceGreaterThanFloor), bidAmountNotOverflowing);

        // if checks pass, we work on the bid amount, otherwise we set it to 0
        euint64 _resolvedBidAmount = TFHE.select(inputsCorrect, TFHE.asEuint64(_amount_bid), zeroU64);

        // attempt to transfer the bid token to the auction contract
        // if at this moment inputs are:
        // - correct -> we transfer the bid amount
        // - incorrect -> we transfer 0

        euint64 prevBidBalance = IConfidentialERC20(auctionData.bidToken).balanceOf(address(this));
        TFHE.allowTransient(_resolvedBidAmount, auctionData.bidToken);
        IConfidentialERC20(auctionData.bidToken).transferFrom(msg.sender, address(this), _resolvedBidAmount);
        euint64 newBidBalance = IConfidentialERC20(auctionData.bidToken).balanceOf(address(this));

        // check if the balance was updated correctly
        // if inputs are correct, the new balance should be the previous balance + the bid amount
        // if inputs are incorrect, the new balance should be the previous balance, as we transferred 0
        ebool newBalanceIsCorrect = TFHE.eq(newBidBalance, TFHE.add(prevBidBalance, _resolvedBidAmount));

        // update the revert condition
        inputsCorrect = TFHE.and(inputsCorrect, newBalanceIsCorrect);

        euint64 _resolvedAmount = TFHE.select(inputsCorrect, _amount, zeroU64);
        euint64 _wonAmount = zeroU64;

        TFHE.allow(_price, msg.sender);
        TFHE.allow(_price, auctionData.bidSequencer);
        TFHE.allowThis(_price);
        TFHE.allow(_resolvedAmount, msg.sender);
        TFHE.allowThis(_resolvedAmount);
        TFHE.allow(_wonAmount, msg.sender);
        TFHE.allowThis(_wonAmount);

        bids[auctionData.bidIndex] = Bid({
            price: _price,
            amount: _resolvedAmount,
            wonAmount: _wonAmount,
            creator: msg.sender
        });

        bidId[msg.sender] = auctionData.bidIndex;

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

        ebool orderingCorrect = TFHE.asEbool(true);

        if (auctionData.processedBidIndex > 1) {
            Bid memory lastProcessedBid = bids[auctionData.lastProcessedBidId];
            // sort the bids in descending order by price, ascending order by bidId

            ebool lastPriceGreater = TFHE.gt(lastProcessedBid.price, bid.price);
            ebool lastPriceEqualAndLastBidIdSmaller = TFHE.and(
                TFHE.eq(lastProcessedBid.price, bid.price),
                TFHE.asEbool((auctionData.lastProcessedBidId < _bidId))
            );

            orderingCorrect = TFHE.or(lastPriceGreater, lastPriceEqualAndLastBidIdSmaller);
        }

        uint256[] memory decryptionArgs = new uint256[](1);
        decryptionArgs[0] = Gateway.toUint256(orderingCorrect);
        uint256 requestID = Gateway.requestDecryption(
            decryptionArgs,
            this.processNextBidCallback.selector,
            0,
            block.timestamp + 100,
            false
        );
        addParamsUint256(requestID, _bidId);
    }

    function processNextBidCallback(uint256 requestID, bool decryptedOrderingCorrect) public onlyGateway {
        if (!decryptedOrderingCorrect) {
            revert WrongBidOrder();
        }
        uint256[] memory params = getParamsUint256(requestID);

        uint256 _bidId = params[0];

        if (processedBids[_bidId]) {
            revert BidAlreadyPlaced();
        }

        Bid memory bid = bids[_bidId];

        euint128 previousSlidingSum = auctionData.slidingSum;

        auctionData.slidingSum = TFHE.add(previousSlidingSum, bid.amount);
        TFHE.allowThis(auctionData.slidingSum);
        auctionData.lastProcessedBidId = _bidId;

        euint128 enc128TokenAmount = TFHE.asEuint128(auctionData.tokenAmount);

        ebool slidingSumLessThanOrEqualTokenAmount = TFHE.le(auctionData.slidingSum, enc128TokenAmount);
        ebool previousSlidingSumLessThanTokenAmount = TFHE.lt(previousSlidingSum, enc128TokenAmount);

        euint64 wonAmount = TFHE.select(
            slidingSumLessThanOrEqualTokenAmount,
            bid.amount,
            TFHE.select(
                previousSlidingSumLessThanTokenAmount,
                // can be casted to euint64 as tokenAmount is uint64 and previousSlidingSum is less than tokenAmount
                TFHE.asEuint64(TFHE.sub(enc128TokenAmount, previousSlidingSum)),
                zeroU64
            )
        );

        euint64 finalPrice = TFHE.select(
            TFHE.or(slidingSumLessThanOrEqualTokenAmount, previousSlidingSumLessThanTokenAmount),
            bid.price,
            auctionData.finalPrice
        );

        TFHE.allowThis(wonAmount);
        TFHE.allow(wonAmount, bid.creator);
        bids[_bidId].wonAmount = wonAmount;

        TFHE.allowThis(finalPrice);
        auctionData.finalPrice = finalPrice;

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

        TFHE.allowTransient(bid.wonAmount, auctionData.token);
        IConfidentialERC20(auctionData.token).transfer(msg.sender, bid.wonAmount);

        // if won, finalPrice is always <= bid.price
        // would not overflow as bid.price * bid.amount <= MAX_UINT64
        euint64 refund = TFHE.sub(TFHE.mul(bid.price, bid.amount), TFHE.mul(bid.wonAmount, auctionData.finalPrice));

        TFHE.allowTransient(refund, auctionData.bidToken);
        IConfidentialERC20(auctionData.bidToken).transfer(msg.sender, refund);
    }

    function claimOwner() public {
        // Claim the auction as the owner

        if (!isAuctionEnded()) {
            revert AuctionNotEnded();
        }

        if (auctionData.creator != msg.sender) {
            revert UnauthorizedAccount();
        }

        if (auctionData.processedBidIndex < auctionData.bidIndex) {
            revert AuctionNotProcessed();
        }

        if (claimed[auctionData.creator]) {
            revert AlreadyClaimed();
        }

        claimed[auctionData.creator] = true;

        euint64 tokensSold = TFHE.asEuint64(TFHE.min(auctionData.slidingSum, TFHE.asEuint128(auctionData.tokenAmount)));
        euint64 tokensNotSold = TFHE.sub(auctionData.tokenAmount, tokensSold);

        TFHE.allowTransient(tokensNotSold, auctionData.token);
        IConfidentialERC20(auctionData.token).transfer(auctionData.creator, tokensNotSold);

        euint64 bidTokensEarned = TFHE.mul(tokensSold, auctionData.finalPrice);

        TFHE.allowTransient(bidTokensEarned, auctionData.bidToken);
        IConfidentialERC20(auctionData.bidToken).transfer(auctionData.creator, bidTokensEarned);
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

    function unstake() public {
        if (!isAuctionEnded()) {
            revert AuctionNotEnded();
        }
        if (auctionData.processedBidIndex < auctionData.bidIndex) {
            revert AuctionNotProcessed();
        }
        uint256 amount = sequencerStake[auctionData.bidSequencer];
        sequencerStake[auctionData.bidSequencer] = 0;
        IERC20(stakeToken).transfer(auctionData.bidSequencer, amount);
    }

    function slash() public {
        if (!isAuctionEnded()) {
            revert AuctionNotEnded();
        }
        if (auctionData.processedBidIndex == auctionData.bidIndex) {
            revert AuctionProcessed();
        }
        if (auctionData.endTime + SLASHING_DURATION > block.timestamp) {
            revert SlashingPeriod();
        }
        uint256 amount = sequencerStake[auctionData.bidSequencer];
        sequencerStake[auctionData.bidSequencer] = 0;
        IERC20(stakeToken).transfer(msg.sender, amount);
    }
}
