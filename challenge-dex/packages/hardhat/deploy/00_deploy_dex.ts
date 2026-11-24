import { isAddress, parseEther } from "viem";
import { artifacts, deployScript } from "../rocketh/deploy.js";

/**
 * Deploys "Balloons" and "DEX".
 *
 * On localhost, the deployer account is the one that comes with Hardhat, which is already funded.
 *
 * When deploying to live networks (e.g `yarn deploy --network sepolia`), the deployer account
 * should have sufficient balance to pay for the gas fees for contract creation.
 *
 * You can generate a random account with `yarn generate` which will fill DEPLOYER_PRIVATE_KEY_ENCRYPTED
 * in the .env file (used in hardhat.config.ts).
 * Run `yarn account` to check the deployer balance on every network.
 */
export default deployScript(
  async ({ deploy, execute, read, namedAccounts, network }) => {
    const { deployer } = namedAccounts;

    const balloons = await deploy("Balloons", {
      account: deployer,
      artifact: artifacts.Balloons,
      args: [],
    });

    const dex = await deploy("DEX", {
      account: deployer,
      artifact: artifacts.DEX,
      args: [balloons.address],
    });

    // Keep testnet seed small; both amounts can be overridden in packages/hardhat/.env.
    const local = Number(network.chain.id) === 31337;
    const initialEth = parseEther(process.env.DEX_INITIAL_ETH ?? (local ? "5" : "0.005"));
    const initialTokens = parseEther(process.env.DEX_INITIAL_TOKENS ?? "5");
    if (initialEth <= 0n || initialTokens <= 0n) throw new Error("DEX seed amounts must be positive");

    // Resume after a failed approve/init without reinitializing an active pool.
    const totalLiquidity = await read(dex, { functionName: "totalLiquidity" });
    if (totalLiquidity === 0n) {
      const approved = await read(balloons, { functionName: "allowance", args: [deployer, dex.address] });
      if (approved < initialTokens) {
        await execute(balloons, { functionName: "approve", args: [dex.address, initialTokens], account: deployer });
      }
      await execute(dex, { functionName: "init", args: [initialTokens], value: initialEth, account: deployer });
    }

    const frontendAddress = process.env.FRONTEND_ADDRESS?.trim();
    // Set the desired starter balance, instead of sending another 10 BAL on every rerun.
    if (frontendAddress) {
      if (!isAddress(frontendAddress)) throw new Error("Invalid FRONTEND_ADDRESS");
      if (frontendAddress.toLowerCase() === deployer.toLowerCase()) return;
      const balance = await read(balloons, { functionName: "balanceOf", args: [frontendAddress] });
      if (balance === 0n && balloons.newlyDeployed) {
        await execute(balloons, {
          functionName: "transfer",
          args: [frontendAddress, parseEther("10")],
          account: deployer,
        });
      }
    }
  },
  // Tags are useful if you have multiple deploy files and only want to run one of them.
  // e.g. yarn deploy --tags DEX
  { tags: ["Balloons", "DEX"] },
);
