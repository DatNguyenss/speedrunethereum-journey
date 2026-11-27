import { expect } from "chai";
import { network } from "hardhat";

describe("Oracle edge cases", function () {
  let connection: Awaited<ReturnType<typeof network.create>>;

  before(async function () {
    connection = await network.create();
    await connection.ethers.provider.send("evm_setAutomine", [true]);
    await connection.ethers.provider.send("evm_setIntervalMining", [0]);
  });

  async function optimisticFixture() {
    const { ethers } = connection;
    const [owner, asserter, proposer, disputer, caller] = await ethers.getSigners();
    const oracle = await (await ethers.getContractFactory("OptimisticOracle")).deploy(owner.address);
    const decider = await (await ethers.getContractFactory("Decider")).deploy(oracle.target);
    await oracle.setDecider(decider.target);
    const reward = ethers.parseEther("0.01");
    await oracle.connect(asserter).assertEvent("Did the event happen?", 0, 0, { value: reward });
    return { ethers, oracle, decider, reward, asserter, proposer, disputer, caller };
  }

  it("allows a third party to pay the winner and decider exactly once", async function () {
    const { ethers, oracle, decider, reward, proposer, disputer, caller } = await optimisticFixture();
    await oracle.connect(proposer).proposeOutcome(1, true, { value: reward * 2n });
    await oracle.connect(disputer).disputeOutcome(1, { value: reward * 2n });
    await decider.settleDispute(1, false);
    const before = await ethers.provider.getBalance(disputer.address);
    await oracle.connect(caller).claimDisputedReward(1);
    expect(await ethers.provider.getBalance(disputer.address)).to.equal(before + reward * 3n);
    expect(await ethers.provider.getBalance(decider.target)).to.equal(reward * 2n);
    expect(await ethers.provider.getBalance(oracle.target)).to.equal(0n);
    await expect(oracle.claimDisputedReward(1)).to.be.revertedWithCustomError(oracle, "AlreadyClaimed");
  });

  it("rolls back the decider fee and claimed flag when the winner rejects ETH", async function () {
    const { ethers, oracle, decider, reward, proposer, disputer } = await optimisticFixture();
    await oracle.connect(proposer).proposeOutcome(1, false, { value: reward * 2n });
    await oracle.connect(disputer).disputeOutcome(1, { value: reward * 2n });
    await decider.settleDispute(1, false);
    await ethers.provider.send("hardhat_setCode", [proposer.address, "0x60006000fd"]);
    try {
      await expect(oracle.claimDisputedReward(1)).to.be.revertedWithCustomError(oracle, "TransferFailed");
      expect((await oracle.getAssertion(1)).claimed).to.equal(false);
      expect(await ethers.provider.getBalance(decider.target)).to.equal(0n);
      expect(await ethers.provider.getBalance(oracle.target)).to.equal(reward * 5n);
    } finally {
      await ethers.provider.send("hardhat_setCode", [proposer.address, "0x"]);
    }
    await oracle.claimDisputedReward(1);
  });

  it("allows disputes at the deadline and refuses them one second later", async function () {
    const { ethers, oracle, reward, proposer, disputer } = await optimisticFixture();
    await oracle.connect(proposer).proposeOutcome(1, true, { value: reward * 2n });
    const { endTime } = await oracle.getAssertion(1);
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(endTime)]);
    await oracle.connect(disputer).disputeOutcome(1, { value: reward * 2n });
    await oracle.assertEvent("Second event", 0, 0, { value: reward });
    await oracle.connect(proposer).proposeOutcome(2, true, { value: reward * 2n });
    const second = await oracle.getAssertion(2);
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(second.endTime) + 1]);
    await expect(oracle.connect(disputer).disputeOutcome(2, { value: reward * 2n })).to.be.revertedWithCustomError(
      oracle,
      "InvalidTime",
    );
    await ethers.provider.send("evm_mine", []);
    expect(await oracle.getState(2)).to.equal(4n);
    expect(await oracle.getResolution(2)).to.equal(true);
  });

  it("does not resolve or settle a disputed assertion twice", async function () {
    const { oracle, decider, reward, proposer, disputer } = await optimisticFixture();
    await oracle.connect(proposer).proposeOutcome(1, true, { value: reward * 2n });
    await oracle.connect(disputer).disputeOutcome(1, { value: reward * 2n });
    await expect(oracle.getResolution(1)).to.be.revertedWithCustomError(oracle, "AwaitingDecider");
    await decider.settleDispute(1, false);
    expect(await oracle.getResolution(1)).to.equal(false);
    await expect(decider.settleDispute(1, true)).to.be.revertedWithCustomError(oracle, "AlreadySettled");
  });

  it("rejects unknown assertion IDs and invalid assertion windows", async function () {
    const { oracle, reward } = await optimisticFixture();
    await expect(oracle.claimRefund(0)).to.be.revertedWithCustomError(oracle, "AssertionNotFound");
    await expect(oracle.assertEvent("Too short", 0, 1, { value: reward })).to.be.revertedWithCustomError(
      oracle,
      "InvalidTime",
    );
  });

  it("excludes whitelist data exactly 24 seconds after its last update", async function () {
    const { ethers } = connection;
    const [owner] = await ethers.getSigners();
    const oracle = await (await ethers.getContractFactory("WhitelistOracle")).deploy();
    await oracle.addOracle(owner.address);
    expect(await oracle.getOracleCount()).to.equal(1n);
    const source = await ethers.getContractAt("SimpleOracle", await oracle.oracles(0));
    await source.setPrice(1000);
    const updatedAt = await source.timestamp();
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(updatedAt) + 24]);
    await ethers.provider.send("evm_mine", []);
    expect(await oracle.getActiveOracleNodes()).to.deep.equal([]);
    await expect(oracle.getPrice()).to.be.revertedWithCustomError(oracle, "NoOraclesAvailable");
  });

  it("preserves earned rewards when a node exits and registers again", async function () {
    const { ethers, networkHelpers } = connection;
    const [owner] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory("ORA")).deploy();
    const oracle = await (await ethers.getContractFactory("StakingOracle")).deploy(token.target);
    await token.transferOwnership(oracle.target);
    const stake = ethers.parseEther("200");
    await token.approve(oracle.target, stake * 2n);
    await oracle.registerNode(stake);
    await oracle.reportPrice(1000);
    await networkHelpers.mine(48);
    await oracle.exitNode(0);
    const before = await token.balanceOf(owner.address);
    await oracle.registerNode(stake);
    expect(await token.balanceOf(owner.address)).to.equal(before - stake + ethers.parseEther("1"));
    await expect(oracle.claimReward()).to.be.revertedWithCustomError(oracle, "NoRewardsAvailable");
  });
});
