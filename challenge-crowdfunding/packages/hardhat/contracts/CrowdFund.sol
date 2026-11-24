// SPDX-License-Identifier: MIT
pragma solidity 0.8.20; // Do not change the solidity version as it negatively impacts submission grading

import "./FundingRecipient.sol";

contract CrowdFund {
    /////////////////
    /// Errors //////
    /////////////////

    error NotOpenToWithdraw();
    error WithdrawTransferFailed(address to, uint256 amount);
    error TooEarly(uint256 deadline, uint256 currentTimestamp);
    error FundingCompleted();
    error FundingClosed();

    //////////////////////
    /// State Variables //
    //////////////////////

    FundingRecipient public fundingRecipient;

    mapping(address => uint256) public balances;
    bool public openToWithdraw;
    uint256 public deadline;
    uint256 public constant threshold = 1 ether;

    ////////////////
    /// Events /////
    ////////////////

    // Events go here...
    event Contribution(address, uint256);
    ///////////////////
    /// Modifiers /////
    ///////////////////

    modifier notCompleted() {
        if (fundingRecipient.completed()) revert FundingCompleted();
        _;
    }

    ///////////////////
    /// Constructor ///
    ///////////////////

    constructor(address fundingRecipientAddress) {
        fundingRecipient = FundingRecipient(fundingRecipientAddress);
        deadline = block.timestamp + (block.chainid == 31337 ? 30 seconds : 1 days);
    }

    ///////////////////
    /// Functions /////
    ///////////////////

    function contribute() public payable notCompleted {
        if (block.timestamp >= deadline || openToWithdraw) revert FundingClosed();
        balances[msg.sender] += msg.value;
        emit Contribution(msg.sender, msg.value);
    }

    function withdraw() public notCompleted {
        if (!openToWithdraw) revert NotOpenToWithdraw();
        uint256 amount = balances[msg.sender];
        balances[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{ value: amount }("");
        if (!success) revert WithdrawTransferFailed(msg.sender, amount);
    }

    function execute() public notCompleted {
        if (block.timestamp < deadline) revert TooEarly(deadline, block.timestamp);
        if (openToWithdraw) return;
        uint256 amount = address(this).balance;
        if (amount >= threshold) {
            fundingRecipient.complete{ value: amount }();
        } else {
            openToWithdraw = true;
        }
    }

    receive() external payable {
        contribute();
    }

    ////////////////////////
    /// View Functions /////
    ////////////////////////

    function timeLeft() public view returns (uint256) {
        return block.timestamp < deadline ? deadline - block.timestamp : 0;
    }
}
