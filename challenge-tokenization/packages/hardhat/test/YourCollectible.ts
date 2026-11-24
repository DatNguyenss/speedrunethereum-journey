//
// This script executes when you run 'yarn test'
//

import { network } from "hardhat";
import { expect } from "chai";
import type { YourCollectible } from "../types/ethers-contracts/index.js";

describe("🚩 Challenge: 🎟 Tokenization 🤓", function () {
  let myContract: YourCollectible;
  let ethers: Awaited<ReturnType<typeof network.create>>["ethers"];

  before(async function () {
    ({ ethers } = await network.create());
  });

  describe("YourCollectible", function () {
    const contractAddress = process.env.CONTRACT_ADDRESS;

    let contractArtifact: string;
    if (contractAddress) {
      // For the autograder
      contractArtifact = `contracts/download-${contractAddress}.sol:YourCollectible`;
    } else {
      contractArtifact = "contracts/YourCollectible.sol:YourCollectible";
    }

    it("Should deploy the contract", async function () {
      const YourCollectibleFactory = await ethers.getContractFactory(contractArtifact);
      myContract = (await YourCollectibleFactory.deploy()) as YourCollectible;
      console.log("\t", " 🛰  Contract deployed on", await myContract.getAddress());
    });

    describe("mintItem()", function () {
      it("Should be able to mint an NFT", async function () {
        const [owner] = await ethers.getSigners();

        console.log("\t", " 🧑‍🏫 Tester Address: ", owner.address);

        const startingBalance = await myContract.balanceOf(owner.address);
        console.log("\t", " ⚖️ Starting balance: ", Number(startingBalance));

        console.log("\t", " 🔨 Minting...");
        const mintResult = await myContract.mintItem(owner.address, "QmfVMAmNM1kDEBYrC2TPzQDoCRFH6F5tE1e9Mr4FkkR5Xr");
        console.log("\t", " 🏷  mint tx: ", mintResult.hash);

        console.log("\t", " ⏳ Waiting for confirmation...");
        const txResult = await mintResult.wait();
        expect(txResult?.status).to.equal(1);

        console.log("\t", " 🔎 Checking new balance: ", Number(startingBalance));
        expect(await myContract.balanceOf(owner.address)).to.equal(startingBalance + 1n);
      });

      it("Should track tokens of owner by index", async function () {
        const [owner] = await ethers.getSigners();
        const startingBalance = await myContract.balanceOf(owner.address);
        const token = await myContract.tokenOfOwnerByIndex(owner.address, startingBalance - 1n);
        expect(token).to.greaterThan(0);
      });

      it("Should transfer ownership and update owner enumeration", async function () {
        const [owner, recipient] = await ethers.getSigners();
        const tokenId = await myContract.tokenOfOwnerByIndex(owner.address, 0n);
        const balanceBefore = await myContract.balanceOf(owner.address);
        const recipientBalanceBefore = await myContract.balanceOf(recipient.address);
        const uriBefore = await myContract.tokenURI(tokenId);

        await expect(myContract.transferFrom(owner.address, recipient.address, tokenId))
          .to.emit(myContract, "Transfer")
          .withArgs(owner.address, recipient.address, tokenId);

        expect(await myContract.ownerOf(tokenId)).to.equal(recipient.address);
        expect(await myContract.balanceOf(owner.address)).to.equal(balanceBefore - 1n);
        expect(await myContract.balanceOf(recipient.address)).to.equal(recipientBalanceBefore + 1n);
        expect(await myContract.tokenOfOwnerByIndex(recipient.address, recipientBalanceBefore)).to.equal(tokenId);
        expect(await myContract.tokenURI(tokenId)).to.equal(uriBefore);
      });

      it("Should reject transfers by an account without approval", async function () {
        const [owner, recipient, outsider] = await ethers.getSigners();
        const tokenId = await myContract.tokenOfOwnerByIndex(recipient.address, 0n);

        await expect(myContract.connect(outsider).transferFrom(recipient.address, owner.address, tokenId))
          .to.be.revertedWithCustomError(myContract, "ERC721InsufficientApproval")
          .withArgs(outsider.address, tokenId);
      });
    });
  });
});
