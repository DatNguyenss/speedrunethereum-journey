// SPDX-License-Identifier: MIT
pragma solidity 0.8.20; //Do not change the solidity version as it negatively impacts submission grading

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DEX is ReentrancyGuard {
    /////////////////
    /// Errors //////
    /////////////////

    error DexAlreadyInitialized();
    error TokenTransferFailed();
    error InvalidEthAmount();
    error InvalidTokenAmount();
    error InsufficientTokenBalance(uint256 available, uint256 required);
    error InsufficientTokenAllowance(uint256 available, uint256 required);
    error EthTransferFailed(address to, uint256 amount);
    error InsufficientLiquidity(uint256 available, uint256 required);
    error PoolNotInitialized();
    error InvalidLiquidityAmount();

    //////////////////////
    /// State Variables //
    //////////////////////

    IERC20 public immutable token;
    uint256 public totalLiquidity;
    mapping(address => uint256) public liquidity;

    ////////////////
    /// Events /////
    ////////////////

    event EthToTokenSwap(address swapper, uint256 tokenOutput, uint256 ethInput);
    event TokenToEthSwap(address swapper, uint256 tokensInput, uint256 ethOutput);
    event LiquidityProvided(address liquidityProvider, uint256 liquidityMinted, uint256 ethInput, uint256 tokensInput);
    event LiquidityRemoved(
        address liquidityRemover,
        uint256 liquidityWithdrawn,
        uint256 tokensOutput,
        uint256 ethOutput
    );

    ///////////////////
    /// Constructor ///
    ///////////////////

    constructor(address tokenAddr) {
        token = IERC20(tokenAddr);
    }

    ///////////////////
    /// Functions /////
    ///////////////////

    function init(uint256 tokens) public payable nonReentrant returns (uint256 initialLiquidity) {
        if (totalLiquidity != 0) revert DexAlreadyInitialized();
        if (msg.value == 0) revert InvalidEthAmount();
        if (tokens == 0) revert InvalidTokenAmount();
        initialLiquidity = address(this).balance;
        totalLiquidity = initialLiquidity;
        liquidity[msg.sender] = initialLiquidity;
        if (!token.transferFrom(msg.sender, address(this), tokens)) revert TokenTransferFailed();
    }

    function price(uint256 xInput, uint256 xReserves, uint256 yReserves) public pure returns (uint256 yOutput) {
        uint256 xInputWithFee = xInput * 997;
        return (xInputWithFee * yReserves) / (xReserves * 1000 + xInputWithFee);
    }

    function getLiquidity(address lp) public view returns (uint256 lpLiquidity) {
        return liquidity[lp];
    }

    function ethToToken() public payable nonReentrant returns (uint256 tokenOutput) {
        if (msg.value == 0) revert InvalidEthAmount();
        if (totalLiquidity == 0) revert PoolNotInitialized();
        tokenOutput = price(msg.value, address(this).balance - msg.value, token.balanceOf(address(this)));
        if (tokenOutput == 0) revert InvalidTokenAmount();
        if (!token.transfer(msg.sender, tokenOutput)) revert TokenTransferFailed();
        emit EthToTokenSwap(msg.sender, tokenOutput, msg.value);
    }

    function tokenToEth(uint256 tokenInput) public nonReentrant returns (uint256 ethOutput) {
        if (tokenInput == 0) revert InvalidTokenAmount();
        if (totalLiquidity == 0) revert PoolNotInitialized();
        _checkTokens(tokenInput);
        ethOutput = price(tokenInput, token.balanceOf(address(this)), address(this).balance);
        if (ethOutput == 0) revert InvalidEthAmount();
        if (!token.transferFrom(msg.sender, address(this), tokenInput)) revert TokenTransferFailed();
        (bool sent, ) = payable(msg.sender).call{ value: ethOutput }("");
        if (!sent) revert EthTransferFailed(msg.sender, ethOutput);
        emit TokenToEthSwap(msg.sender, tokenInput, ethOutput);
    }

    function deposit() public payable nonReentrant returns (uint256 tokensDeposited) {
        if (msg.value == 0) revert InvalidEthAmount();
        if (totalLiquidity == 0) revert PoolNotInitialized();
        uint256 ethReserve = address(this).balance - msg.value;
        tokensDeposited = ((msg.value * token.balanceOf(address(this))) / ethReserve) + 1;
        _checkTokens(tokensDeposited);
        uint256 minted = (msg.value * totalLiquidity) / ethReserve;
        if (minted == 0) revert InvalidLiquidityAmount();
        liquidity[msg.sender] += minted;
        totalLiquidity += minted;
        if (!token.transferFrom(msg.sender, address(this), tokensDeposited)) revert TokenTransferFailed();
        emit LiquidityProvided(msg.sender, minted, msg.value, tokensDeposited);
    }

    function withdraw(uint256 amount) public nonReentrant returns (uint256 ethAmount, uint256 tokenAmount) {
        if (amount == 0) revert InvalidLiquidityAmount();
        uint256 available = liquidity[msg.sender];
        if (amount > available) revert InsufficientLiquidity(available, amount);
        ethAmount = (amount * address(this).balance) / totalLiquidity;
        tokenAmount = (amount * token.balanceOf(address(this))) / totalLiquidity;
        liquidity[msg.sender] -= amount;
        totalLiquidity -= amount;
        if (!token.transfer(msg.sender, tokenAmount)) revert TokenTransferFailed();
        (bool sent, ) = payable(msg.sender).call{ value: ethAmount }("");
        if (!sent) revert EthTransferFailed(msg.sender, ethAmount);
        emit LiquidityRemoved(msg.sender, amount, tokenAmount, ethAmount);
    }

    function _checkTokens(uint256 amount) internal view {
        uint256 balance = token.balanceOf(msg.sender);
        if (balance < amount) revert InsufficientTokenBalance(balance, amount);
        uint256 allowance = token.allowance(msg.sender, address(this));
        if (allowance < amount) revert InsufficientTokenAllowance(allowance, amount);
    }
}
