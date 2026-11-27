import { artifacts, deployScript } from "../rocketh/deploy.js";

export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;

    console.log("Deploying OptimisticOracle...");
    // Deploy the OptimisticOracle contract with deployer as temporary decider
    const optimisticOracle = await env.deploy("OptimisticOracle", {
      account: deployer,
      artifact: artifacts.OptimisticOracle,
      args: [deployer],
    });

    // Deploy the Decider contract
    const decider = await env.deploy("Decider", {
      account: deployer,
      artifact: artifacts.Decider,
      args: [optimisticOracle.address],
    });

    // Wire the actual deployment, including when Rocketh reuses an existing contract.
    const currentDecider = await env.read(optimisticOracle, { functionName: "decider", args: [] });
    if (currentDecider.toLowerCase() !== decider.address.toLowerCase()) {
      await env.execute(optimisticOracle, {
        functionName: "setDecider",
        args: [decider.address],
        account: deployer,
      });
    }

    console.log("OptimisticOracle deployed to:", optimisticOracle.address);
    console.log("Decider deployed to:", decider.address);
  },
  { tags: ["OptimisticOracle"] },
);
