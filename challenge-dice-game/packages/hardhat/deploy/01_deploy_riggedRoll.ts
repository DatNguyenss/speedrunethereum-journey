import { artifacts, deployScript } from "../rocketh/deploy.js";
import { getAddress } from "viem";

export default deployScript(
  async env => {
    const diceGame = env.get("DiceGame");
    const diceGameAddress = diceGame.address;

    // Set RIGGED_ROLL_OWNER to your frontend wallet address before deploying.
    const owner = getAddress(process.env.RIGGED_ROLL_OWNER || env.namedAccounts.deployer);
    const riggedRoll = await env.deploy("RiggedRoll", {
      account: env.namedAccounts.deployer,
      artifact: artifacts.RiggedRoll,
      args: [diceGameAddress],
    });

    const currentOwner = await env.read(riggedRoll, { functionName: "owner" });
    if (getAddress(currentOwner) !== owner) {
      await env.execute(riggedRoll, {
        functionName: "transferOwnership",
        args: [owner],
        account: env.namedAccounts.deployer,
      });
    }
    console.log("RiggedRoll owner:", owner);
  },
  { tags: ["RiggedRoll"], dependencies: ["DiceGame"] },
);
