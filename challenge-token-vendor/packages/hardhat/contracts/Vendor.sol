// SPDX-License-Identifier: MIT
pragma solidity 0.8.20; //Do not change the solidity version as it negatively impacts submission grading

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { YourToken } from "./YourToken.sol";

contract Vendor is Ownable {
    /////////////////
    /// Errors //////
    /////////////////

    error InvalidEthAmount();
    error InsufficientVendorTokenBalance(uint256 available, uint256 required);
    error InvalidTokenAmount();
    error InsufficientVendorEthBalance(uint256 available, uint256 required);
    error EthTransferFailed(address to, uint256 amount);

    //////////////////////
    /// State Variables //
    //////////////////////

    YourToken public immutable yourToken;
    uint256 public constant tokensPerEth = 100;

    ////////////////
    /// Events /////
    ////////////////

    event BuyTokens(address indexed buyer, uint256 amountOfETH, uint256 amountOfTokens);
    event SellTokens(address indexed seller, uint256 amountOfTokens, uint256 amountOfETH);

    ///////////////////
    /// Constructor ///
    ///////////////////

    constructor(address tokenAddress) Ownable(msg.sender) {
        yourToken = YourToken(tokenAddress);
    }

    ///////////////////
    /// Functions /////
    ///////////////////

    function buyTokens() external payable {
        if (msg.value == 0) revert InvalidEthAmount();
        uint256 amount = msg.value * tokensPerEth;
        uint256 available = yourToken.balanceOf(address(this));
        if (available < amount) revert InsufficientVendorTokenBalance(available, amount);
        yourToken.transfer(msg.sender, amount);
        emit BuyTokens(msg.sender, msg.value, amount);
    }

    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        address recipient = owner();
        (bool success, ) = recipient.call{ value: amount }("");
        if (!success) revert EthTransferFailed(recipient, amount);
    }

    function sellTokens(uint256 amount) external {
        if (amount == 0) revert InvalidTokenAmount();
        uint256 ethAmount = amount / tokensPerEth;
        uint256 available = address(this).balance;
        if (available < ethAmount) revert InsufficientVendorEthBalance(available, ethAmount);
        yourToken.transferFrom(msg.sender, address(this), amount);
        (bool success, ) = msg.sender.call{ value: ethAmount }("");
        if (!success) revert EthTransferFailed(msg.sender, ethAmount);
        emit SellTokens(msg.sender, amount, ethAmount);
    }
}
