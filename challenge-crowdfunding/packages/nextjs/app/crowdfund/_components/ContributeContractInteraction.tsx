"use client";

import { useState } from "react";
import { ETHToPrice } from "./EthToPrice";
import { Address } from "@scaffold-ui/components";
import { useWatchBalance } from "@scaffold-ui/hooks";
import humanizeDuration from "humanize-duration";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

export const ContributeContractInteraction = ({ address }: { address?: string }) => {
  const { address: connectedAddress } = useAccount();
  const [contributionAmount, setContributionAmount] = useState("0.01");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const validAmount = /^\d+(\.\d{1,18})?$/.test(contributionAmount) && parseEther(contributionAmount) > 0n;

  const { data: crowdFundContract } = useDeployedContractInfo({ contractName: "CrowdFund" });
  const { data: fundingRecipientContract } = useDeployedContractInfo({ contractName: "FundingRecipient" });

  const { data: crowdFundContractBalance } = useWatchBalance({ address: crowdFundContract?.address });
  const { data: fundingRecipientBalance } = useWatchBalance({ address: fundingRecipientContract?.address });

  const { targetNetwork } = useTargetNetwork();

  const { data: threshold } = useScaffoldReadContract({
    contractName: "CrowdFund",
    functionName: "threshold",
    watch: true,
  });

  const { data: timeLeft } = useScaffoldReadContract({
    contractName: "CrowdFund",
    functionName: "timeLeft",
    watch: true,
  });

  const { data: myContribution } = useScaffoldReadContract({
    contractName: "CrowdFund",
    functionName: "balances",
    args: [connectedAddress],
    watch: true,
  });

  const { data: isFundingCompleted } = useScaffoldReadContract({
    contractName: "FundingRecipient",
    functionName: "completed",
    watch: true,
  });

  const { data: openToWithdraw } = useScaffoldReadContract({
    contractName: "CrowdFund",
    functionName: "openToWithdraw",
    watch: true,
  });

  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "CrowdFund" });

  return (
    <div className="flex items-center flex-col flex-grow w-full px-4 gap-12">
      {isFundingCompleted && (
        <div className="flex flex-col items-center gap-2 bg-base-100 shadow-lg shadow-secondary border-8 border-secondary p-6 mt-12 w-full max-w-lg">
          <p className="block m-0 font-semibold">🎉 Crowdfunding contract triggered FundingRecipient 🎉</p>
          <div className="flex items-center">
            <ETHToPrice
              value={fundingRecipientBalance ? formatEther(fundingRecipientBalance.value) : undefined}
              className="text-[1rem]"
            />
            <p className="block m-0 text-lg -ml-1">received</p>
          </div>
        </div>
      )}

      <div
        className={`flex flex-col items-center space-y-8 bg-base-100 shadow-lg shadow-secondary border-8 border-secondary p-6 w-full max-w-lg ${
          !isFundingCompleted ? "mt-24" : ""
        }`}
      >
        <div className="flex flex-col w-full items-center">
          <p className="block text-2xl mt-0 mb-2 font-semibold">CrowdFund Contract</p>
          <Address address={address} size="xl" />
        </div>

        <div className="flex items-start justify-around w-full">
          <div className="flex flex-col items-center justify-center w-1/2">
            <p className="block text-xl mt-0 mb-1 font-semibold">Time Left</p>
            <p className="m-0 p-0">
              {timeLeft === undefined ? "Loading…" : timeLeft > 0n ? humanizeDuration(Number(timeLeft) * 1000) : "DONE"}
            </p>
          </div>

          <div className="flex flex-col items-center w-1/2">
            <p className="block text-xl mt-0 mb-1 font-semibold">You Contributed</p>
            <span>
              {myContribution ? formatEther(myContribution) : 0} {targetNetwork.nativeCurrency.symbol}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center shrink-0 w-full">
          <p className="block text-xl mt-0 mb-1 font-semibold">Total Contributed</p>
          <div className="flex space-x-2">
            <ETHToPrice value={crowdFundContractBalance ? formatEther(crowdFundContractBalance.value) : undefined} />
            <span>/</span>
            <ETHToPrice value={threshold ? formatEther(threshold) : undefined} />
          </div>
        </div>

        <div className="flex flex-col space-y-5">
          <div className="flex space-x-7">
            <button
              className="btn btn-primary uppercase"
              disabled={!connectedAddress || isSubmitting || timeLeft !== 0n || isFundingCompleted || openToWithdraw}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await writeContractAsync({ functionName: "execute" });
                } catch (err) {
                  console.error("Error calling execute function", err);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              Execute
            </button>

            <button
              className="btn btn-primary uppercase"
              disabled={!connectedAddress || isSubmitting || !openToWithdraw || !myContribution || isFundingCompleted}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  await writeContractAsync({ functionName: "withdraw" });
                } catch (err) {
                  console.error("Error calling withdraw function", err);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              Withdraw
            </button>
          </div>

          <label className="flex flex-col gap-2">
            <span>Contribution (ETH)</span>
            <input
              className="input input-bordered w-full"
              type="text"
              inputMode="decimal"
              value={contributionAmount}
              onChange={event => setContributionAmount(event.target.value)}
              disabled={isSubmitting}
            />
          </label>
          <button
            className="btn btn-primary uppercase"
            disabled={
              !connectedAddress ||
              isSubmitting ||
              !validAmount ||
              timeLeft === undefined ||
              timeLeft === 0n ||
              isFundingCompleted ||
              openToWithdraw
            }
            onClick={async () => {
              setIsSubmitting(true);
              try {
                await writeContractAsync({ functionName: "contribute", value: parseEther(contributionAmount) });
              } catch (err) {
                console.error("Error calling contribute function", err);
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            🤝 Contribute ETH
          </button>
          {openToWithdraw && <p className="m-0">Goal not reached. Contributors can withdraw their ETH.</p>}
        </div>
      </div>
    </div>
  );
};
