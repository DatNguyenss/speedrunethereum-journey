import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createPublicClient, http } from "viem";
import { hardhat } from "viem/chains";
const client = createPublicClient({ chain: hardhat, transport: http("http://127.0.0.1:8545") });
const load = name => JSON.parse(readFileSync(`deployments/default/${name}.json`, "utf8"));
const read = (name, functionName) => {
  const d = load(name);
  return client.readContract({ address: d.address, abi: d.abi, functionName });
};
assert.equal(await read("WhitelistOracle", "getOracleCount"), 10n);
assert.equal((await read("OptimisticOracle", "decider")).toLowerCase(), load("Decider").address.toLowerCase());
assert.equal((await read("Decider", "oracle")).toLowerCase(), load("OptimisticOracle").address.toLowerCase());
assert.equal((await read("ORA", "owner")).toLowerCase(), load("StakingOracle").address.toLowerCase());
assert.equal((await read("StakingOracle", "oracleToken")).toLowerCase(), load("ORA").address.toLowerCase());
for (const name of ["WhitelistOracle", "ORA", "StakingOracle", "OptimisticOracle", "Decider"]) {
  const code = await client.getCode({ address: load(name).address });
  assert.ok(code && code !== "0x", `${name} has no deployed bytecode`);
}
console.log("Local deployment: 10 sources, contract wiring and bytecode OK");
