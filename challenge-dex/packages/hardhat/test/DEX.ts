//
// This script executes when you run 'yarn hardhat:test'
//
// NOTE: The README expects tests grouped by checkpoint so you can run:
//   yarn test --grep "Checkpoint2"
//   yarn test --grep "Checkpoint3"
//   yarn test --grep "Checkpoint4"
//   yarn test --grep "Checkpoint5"
//

import { network } from "hardhat";
import { expect } from "chai";
import { anyValue } from "@nomicfoundation/hardhat-ethers-chai-matchers/withArgs";
import type { Balloons, DEX } from "../types/ethers-contracts/index.js";

describe("🚩 Challenge: ⚖️ 🪙 DEX", function () {
  let ethers: Awaited<ReturnType<typeof network.create>>["ethers"];

  before(async function () {
    ({ ethers } = await network.create());
  });

  const contractAddress = process.env.CONTRACT_ADDRESS;
  const getDexArtifact = () => {
    if (contractAddress) return `contracts/download-${contractAddress}.sol:DEX`;
    return "contracts/DEX.sol:DEX";
  };

  async function deployFixture() {
    const [deployer, user2, user3] = await ethers.getSigners();

    const BalloonsFactory = await ethers.getContractFactory("Balloons");
    const balloons = (await BalloonsFactory.deploy()) as unknown as Balloons;
    await balloons.waitForDeployment();

    const DexFactory = await ethers.getContractFactory(getDexArtifact());
    const dex = (await DexFactory.deploy(await balloons.getAddress())) as unknown as DEX;
    await dex.waitForDeployment();

    return {
      deployer,
      user2,
      user3,
      balloons,
      dex,
      dexAddress: await dex.getAddress(),
    };
  }

  async function deployInitializedFixture() {
    const { deployer, user2, user3, balloons, dex, dexAddress } = await deployFixture();

    // Seed user2/user3 with tokens for later trading / liquidity.
    await balloons.transfer(user2.address, ethers.parseEther("10"));
    await balloons.transfer(user3.address, ethers.parseEther("10"));

    // Approve + init from deployer (deployer holds the initial 1000 BAL supply).
    await balloons.approve(dexAddress, ethers.parseEther("100"));
    await dex.init(ethers.parseEther("5"), { value: ethers.parseEther("5"), gasLimit: 200000 });

    return { deployer, user2, user3, balloons, dex, dexAddress };
  }

  describe("Checkpoint2: ⚖️ Reserves + init() + getLiquidity()", function () {
    it("Checkpoint2: totalLiquidity starts at 0 and init sets it to msg.value", async function () {
      const { dex, balloons, dexAddress } = await deployFixture();

      expect(await dex.totalLiquidity()).to.equal(0);

      await balloons.approve(dexAddress, ethers.parseEther("100"));
      await expect(dex.init(ethers.parseEther("5"), { value: ethers.parseEther("5"), gasLimit: 200000 })).to.not.revert(
        ethers,
      );

      expect(await dex.totalLiquidity()).to.equal(ethers.parseEther("5"));
    });

    it("Checkpoint2: init reverts on second call with DexAlreadyInitialized", async function () {
      const { dex, balloons, dexAddress } = await deployFixture();

      await balloons.approve(dexAddress, ethers.parseEther("100"));
      await dex.init(ethers.parseEther("5"), { value: ethers.parseEther("5"), gasLimit: 200000 });

      await expect(
        dex.init(ethers.parseEther("1"), { value: ethers.parseEther("1"), gasLimit: 200000 }),
      ).to.be.revertedWithCustomError(dex, "DexAlreadyInitialized");
    });

    it("Checkpoint2: getLiquidity returns the LP balance for an address", async function () {
      const { deployer, dex } = await deployInitializedFixture();

      // In this challenge, initial LP is equal to the ETH added in init.
      expect(await dex.getLiquidity(deployer.address)).to.equal(ethers.parseEther("5"));
    });
  });

  describe("Checkpoint3: 🤑 price()", function () {
    it("Checkpoint3: calculates price correctly (includes 0.3% fee)", async function () {
      const { dex } = await deployFixture();

      let xInput = ethers.parseEther("1");
      let xReserves = ethers.parseEther("5");
      let yReserves = ethers.parseEther("5");
      let yOutput = await dex.price(xInput, xReserves, yReserves);
      expect(
        yOutput.toString(),
        "Check your price function's calculations. Don't forget the 0.3% fee (997/1000).",
      ).to.equal("831248957812239453");

      xInput = ethers.parseEther("1");
      xReserves = ethers.parseEther("10");
      yReserves = ethers.parseEther("15");
      yOutput = await dex.price(xInput, xReserves, yReserves);
      expect(yOutput.toString()).to.equal("1359916340820223697");
    });
  });

  describe("Checkpoint4: 🤝 Trading (ethToToken + tokenToEth)", function () {
    it("Checkpoint4: ethToToken reverts on 0 ETH with InvalidEthAmount", async function () {
      const { dex } = await deployInitializedFixture();
      await expect(dex.ethToToken({ value: 0 })).to.be.revertedWithCustomError(dex, "InvalidEthAmount");
    });

    it("Checkpoint4: ethToToken emits EthToTokenSwap and transfers tokens", async function () {
      const { user2, balloons, dex, dexAddress } = await deployInitializedFixture();

      const xInput = ethers.parseEther("1");
      const xReserves = await ethers.provider.getBalance(dexAddress);
      const yReserves = await balloons.balanceOf(dexAddress);
      const expectedYOutput = await dex.price(xInput, xReserves, yReserves);

      const userBalBefore = await balloons.balanceOf(user2.address);
      const tx = dex.connect(user2).ethToToken({ value: xInput });
      await expect(tx).to.emit(dex, "EthToTokenSwap").withArgs(user2.address, expectedYOutput, xInput);
      await tx;

      const userBalAfter = await balloons.balanceOf(user2.address);
      expect(userBalAfter).to.equal(userBalBefore + expectedYOutput);

      expect(await ethers.provider.getBalance(dexAddress)).to.equal(xReserves + xInput);
    });

    it("Checkpoint4: tokenToEth reverts on 0 tokens with InvalidTokenAmount", async function () {
      const { dex } = await deployInitializedFixture();
      await expect(dex.tokenToEth(0)).to.be.revertedWithCustomError(dex, "InvalidTokenAmount");
    });

    it("Checkpoint4: tokenToEth emits TokenToEthSwap and transfers ETH out", async function () {
      const { deployer, balloons, dex, dexAddress } = await deployInitializedFixture();

      // Approve and swap 1 token from deployer.
      await balloons.approve(dexAddress, ethers.parseEther("1"));

      const dexEthBefore = await ethers.provider.getBalance(dexAddress);
      const tx = dex.tokenToEth(ethers.parseEther("1"));
      await expect(tx).to.emit(dex, "TokenToEthSwap").withArgs(deployer.address, ethers.parseEther("1"), anyValue);
      await tx;

      const dexEthAfter = await ethers.provider.getBalance(dexAddress);
      expect(dexEthAfter).to.be.lt(dexEthBefore);
    });
  });

  describe("Pool edge cases", function () {
    it("Rejects empty initialization and swaps before initialization", async function () {
      const { dex } = await deployFixture();
      await expect(dex.init(1n)).to.be.revertedWithCustomError(dex, "InvalidEthAmount");
      await expect(dex.init(0n, { value: 1n })).to.be.revertedWithCustomError(dex, "InvalidTokenAmount");
      await expect(dex.ethToToken({ value: 1n })).to.be.revertedWithCustomError(dex, "PoolNotInitialized");
      await expect(dex.deposit({ value: 1n })).to.be.revertedWithCustomError(dex, "PoolNotInitialized");
      await expect(dex.tokenToEth(1n)).to.be.revertedWithCustomError(dex, "PoolNotInitialized");
    });

    it("Rejects selling more tokens than owned or approved", async function () {
      const { dex, user2 } = await deployInitializedFixture();
      await expect(dex.connect(user2).tokenToEth(ethers.parseEther("11")))
        .to.be.revertedWithCustomError(dex, "InsufficientTokenBalance")
        .withArgs(ethers.parseEther("10"), ethers.parseEther("11"));
      await expect(dex.connect(user2).tokenToEth(ethers.parseEther("1")))
        .to.be.revertedWithCustomError(dex, "InsufficientTokenAllowance")
        .withArgs(0n, ethers.parseEther("1"));
    });

    it("Accrues fees to the pool across swaps in both directions", async function () {
      const { dex, balloons, dexAddress, user2 } = await deployInitializedFixture();
      const initialProduct = (await ethers.provider.getBalance(dexAddress)) * (await balloons.balanceOf(dexAddress));
      await dex.connect(user2).ethToToken({ value: ethers.parseEther("0.1") });
      const productAfterBuy = (await ethers.provider.getBalance(dexAddress)) * (await balloons.balanceOf(dexAddress));
      expect(productAfterBuy).to.be.greaterThan(initialProduct);
      await balloons.connect(user2).approve(dexAddress, ethers.parseEther("0.1"));
      await dex.connect(user2).tokenToEth(ethers.parseEther("0.1"));
      const productAfterSell = (await ethers.provider.getBalance(dexAddress)) * (await balloons.balanceOf(dexAddress));
      expect(productAfterSell).to.be.greaterThan(productAfterBuy);
    });

    it("Rounds the token deposit up by one wei and returns both assets on withdrawal", async function () {
      const { dex, balloons, dexAddress, user2 } = await deployInitializedFixture();
      const ethInput = ethers.parseEther("0.1");
      const requiredTokens = ethInput + 1n;
      await balloons.connect(user2).approve(dexAddress, requiredTokens);
      const tokensBefore = await balloons.balanceOf(user2.address);
      await expect(dex.connect(user2).deposit({ value: ethInput }))
        .to.emit(dex, "LiquidityProvided")
        .withArgs(user2.address, ethInput, ethInput, requiredTokens);
      expect(await balloons.balanceOf(user2.address)).to.equal(tokensBefore - requiredTokens);
      const total = await dex.totalLiquidity();
      const expectedEth = (ethInput * (await ethers.provider.getBalance(dexAddress))) / total;
      const expectedTokens = (ethInput * (await balloons.balanceOf(dexAddress))) / total;
      await expect(dex.connect(user2).withdraw(ethInput))
        .to.emit(dex, "LiquidityRemoved")
        .withArgs(user2.address, ethInput, expectedTokens, expectedEth);
      expect(await dex.getLiquidity(user2.address)).to.equal(0n);
      expect(await balloons.balanceOf(user2.address)).to.equal(tokensBefore - requiredTokens + expectedTokens);
    });

    it("Allows a full withdrawal without leaving reserves or double withdrawals", async function () {
      const { dex, balloons, dexAddress, deployer } = await deployInitializedFixture();
      await expect(dex.withdraw(0n)).to.be.revertedWithCustomError(dex, "InvalidLiquidityAmount");
      await dex.withdraw(await dex.getLiquidity(deployer.address));
      expect(await dex.totalLiquidity()).to.equal(0n);
      expect(await balloons.balanceOf(dexAddress)).to.equal(0n);
      expect(await ethers.provider.getBalance(dexAddress)).to.equal(0n);
      await expect(dex.withdraw(1n)).to.be.revertedWithCustomError(dex, "InsufficientLiquidity");
    });
  });

  describe("Checkpoint5: 🌊 Liquidity (deposit + withdraw)", function () {
    it("Checkpoint5: deposit reverts on 0 ETH with InvalidEthAmount", async function () {
      const { dex } = await deployInitializedFixture();
      await expect(dex.deposit({ value: 0 })).to.be.revertedWithCustomError(dex, "InvalidEthAmount");
    });

    it("Checkpoint5: deposit increases totalLiquidity and emits LiquidityProvided", async function () {
      const { user2, balloons, dex, dexAddress } = await deployInitializedFixture();

      await balloons.connect(user2).approve(dexAddress, ethers.parseEther("100"));

      const liquidityStart = await dex.totalLiquidity();
      const userLpStart = await dex.getLiquidity(user2.address);
      expect(userLpStart).to.equal(0);

      // Deposit 5 ETH. Tokens required depends on reserves, so we don't assert the exact tokenDeposit here.
      const tx = dex.connect(user2).deposit({ value: ethers.parseEther("5") });
      await expect(tx)
        .to.emit(dex, "LiquidityProvided")
        .withArgs(user2.address, ethers.parseEther("5"), ethers.parseEther("5"), anyValue);
      await tx;

      const liquidityEnd = await dex.totalLiquidity();
      expect(liquidityEnd).to.equal(liquidityStart + ethers.parseEther("5"));

      const userLpEnd = await dex.getLiquidity(user2.address);
      expect(userLpEnd).to.equal(ethers.parseEther("5"));
    });

    it("Checkpoint5: withdraw reverts if sender lacks liquidity (InsufficientLiquidity)", async function () {
      const { user2, dex } = await deployInitializedFixture();
      await expect(dex.connect(user2).withdraw(ethers.parseEther("1"))).to.be.revertedWithCustomError(
        dex,
        "InsufficientLiquidity",
      );
    });

    it("Checkpoint5: withdraw emits LiquidityRemoved and decreases totalLiquidity", async function () {
      const { deployer, dex } = await deployInitializedFixture();

      const totalLpBefore = await dex.totalLiquidity();
      const tx = dex.withdraw(ethers.parseEther("1.5"));

      await expect(tx)
        .to.emit(dex, "LiquidityRemoved")
        .withArgs(deployer.address, ethers.parseEther("1.5"), anyValue, anyValue);

      await tx;

      const totalLpAfter = await dex.totalLiquidity();
      expect(totalLpAfter).to.equal(totalLpBefore - ethers.parseEther("1.5"));
    });
  });
});
