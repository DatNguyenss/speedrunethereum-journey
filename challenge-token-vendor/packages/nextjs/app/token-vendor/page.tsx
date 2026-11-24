"use client";

import { useState } from "react";
import { AddressInput, Balance } from "@scaffold-ui/components";
import { IntegerInput } from "@scaffold-ui/debug-contracts";
import { useWatchBalance } from "@scaffold-ui/hooks";
import type { NextPage } from "next";
import { formatEther, isAddress, zeroAddress } from "viem";
import { useAccount } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { getTokenPrice, multiplyTo1e18 } from "~~/utils/scaffold-eth/priceInWei";

const TokenVendor: NextPage = () => {
  const [toAddress, setToAddress] = useState("");
  const [tokensToSend, setTokensToSend] = useState("");
  const [tokensToBuy, setTokensToBuy] = useState<string | bigint>("");
  const [tokensToSell, setTokensToSell] = useState<string>("");

  const { address } = useAccount();
  const { data: yourTokenSymbol } = useScaffoldReadContract({
    contractName: "YourToken",
    functionName: "symbol",
  });

  const { data: yourTokenBalance } = useScaffoldReadContract({
    contractName: "YourToken",
    functionName: "balanceOf",
    args: [address],
  });

  const { data: vendorContractData } = useDeployedContractInfo({ contractName: "Vendor" });
  const { writeContractAsync: writeVendorAsync, isMining: vendorPending } = useScaffoldWriteContract({
    contractName: "Vendor",
  });
  const { writeContractAsync: writeYourTokenAsync, isMining: tokenPending } = useScaffoldWriteContract({
    contractName: "YourToken",
  });

  const { data: vendorTokenBalance } = useScaffoldReadContract({
    contractName: "YourToken",
    functionName: "balanceOf",
    args: [vendorContractData?.address],
  });

  const { data: vendorEthBalance } = useWatchBalance({ address: vendorContractData?.address });

  const { data: tokensPerEth } = useScaffoldReadContract({
    contractName: "Vendor",
    functionName: "tokensPerEth",
  });

  const { data: allowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "YourToken",
    functionName: "allowance",
    args: [address, vendorContractData?.address],
  });
  const { data: owner } = useScaffoldReadContract({ contractName: "Vendor", functionName: "owner" });
  const sellAmount = multiplyTo1e18(tokensToSell);
  const buyAmount = multiplyTo1e18(tokensToBuy);
  const buyPrice = getTokenPrice(tokensToBuy, tokensPerEth);
  const sellPrice = tokensPerEth ? sellAmount / tokensPerEth : 0n;
  const sendAmount = multiplyTo1e18(tokensToSend);
  const isApproved = sellAmount > 0n && (allowance ?? 0n) >= sellAmount;
  const busy = vendorPending || tokenPending;
  const ready = !!address && !!vendorContractData && !busy;
  const canSell =
    ready && sellPrice > 0n && sellAmount <= (yourTokenBalance ?? 0n) && sellPrice <= (vendorEthBalance?.value ?? 0n);

  return (
    <>
      <div className="flex items-center flex-col flex-grow px-4 py-10 gap-2">
        <div className="flex flex-col items-center bg-base-100 shadow-lg shadow-secondary border-8 border-secondary p-6 mt-4 w-full max-w-lg">
          <div className="text-xl">
            Your token balance:{" "}
            <div className="inline-flex items-center justify-center">
              {parseFloat(formatEther(yourTokenBalance || 0n)).toFixed(4)}
              <span className="font-bold ml-1">{yourTokenSymbol}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            Your ETH balance: <Balance address={address} />
          </div>
          {/* Vendor Balances */}
          <hr className="w-full border-secondary my-3" />
          <div>
            Vendor token balance:{" "}
            <div className="inline-flex items-center justify-center">
              {Number(formatEther(vendorTokenBalance || 0n)).toFixed(4)}
              <span className="font-bold ml-1">{yourTokenSymbol}</span>
            </div>
          </div>
          <div>
            Vendor eth balance: {Number(formatEther(vendorEthBalance?.value || 0n)).toFixed(4)}
            <span className="font-bold ml-1">ETH</span>
          </div>
        </div>

        {/* Buy Tokens */}
        <div className="flex flex-col items-center space-y-4 bg-base-100 shadow-lg shadow-secondary border-8 border-secondary p-6 mt-8 w-full max-w-lg">
          <h1 className="text-xl font-bold">Buy Gold tokens</h1>
          <div>{tokensPerEth?.toString() || 0} tokens per ETH</div>

          <div className="w-full flex flex-col space-y-2">
            <IntegerInput
              placeholder="amount of tokens to buy"
              value={tokensToBuy.toString()}
              onChange={value => setTokensToBuy(value)}
              disableMultiplyBy1e18
            />
          </div>

          <p>Cost: {formatEther(buyPrice)} ETH</p>
          <button
            disabled={
              !ready ||
              buyAmount <= 0n ||
              !tokensPerEth ||
              buyAmount % tokensPerEth !== 0n ||
              buyAmount > (vendorTokenBalance ?? 0n)
            }
            className="btn btn-secondary mt-2"
            onClick={async () => {
              try {
                await writeVendorAsync({ functionName: "buyTokens", value: getTokenPrice(tokensToBuy, tokensPerEth) });
              } catch (err) {
                console.error("Error calling buyTokens function", err);
              }
            }}
          >
            Buy Tokens
          </button>
        </div>

        {!!yourTokenBalance && (
          <div className="flex flex-col items-center space-y-4 bg-base-100 shadow-lg shadow-secondary border-8 border-secondary p-6 mt-8 w-full max-w-lg">
            <div className="text-xl">Transfer tokens</div>
            <div className="w-full flex flex-col space-y-2">
              <AddressInput placeholder="to address" value={toAddress} onChange={value => setToAddress(value)} />
              <IntegerInput
                placeholder="amount of tokens to send"
                value={tokensToSend}
                onChange={value => setTokensToSend(value as string)}
                disableMultiplyBy1e18
              />
            </div>

            <button
              disabled={
                !ready ||
                !isAddress(toAddress) ||
                toAddress === zeroAddress ||
                sendAmount <= 0n ||
                sendAmount > (yourTokenBalance ?? 0n)
              }
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  await writeYourTokenAsync({
                    functionName: "transfer",
                    args: [toAddress, multiplyTo1e18(tokensToSend)],
                  });
                } catch (err) {
                  console.error("Error calling transfer function", err);
                }
              }}
            >
              Send Tokens
            </button>
          </div>
        )}

        {/* Sell Tokens */}
        {!!yourTokenBalance && (
          <div className="flex flex-col items-center space-y-4 bg-base-100 shadow-lg shadow-secondary border-8 border-secondary p-6 mt-8 w-full max-w-lg">
            <div className="text-xl">Sell tokens</div>
            <div>{tokensPerEth?.toString() || 0} tokens per ETH</div>

            <div className="w-full flex flex-col space-y-2">
              <IntegerInput
                placeholder="amount of tokens to sell"
                value={tokensToSell}
                onChange={value => setTokensToSell(value as string)}
                disabled={busy}
                disableMultiplyBy1e18
              />
            </div>

            <p>Receive: {formatEther(sellPrice)} ETH</p>
            <p className="text-sm">Approve the Vendor to spend your tokens, then confirm the sale.</p>
            <div className="flex gap-4">
              <button
                className="btn btn-secondary"
                disabled={!canSell || isApproved}
                onClick={async () => {
                  try {
                    await writeYourTokenAsync({
                      functionName: "approve",
                      args: [vendorContractData?.address, multiplyTo1e18(tokensToSell)],
                    });
                    await refetchAllowance();
                  } catch (err) {
                    console.error("Error calling approve function", err);
                  }
                }}
              >
                Approve Tokens
              </button>

              <button
                className="btn btn-secondary"
                disabled={!canSell || !isApproved}
                onClick={async () => {
                  try {
                    await writeVendorAsync({ functionName: "sellTokens", args: [multiplyTo1e18(tokensToSell)] });
                    await refetchAllowance();
                  } catch (err) {
                    console.error("Error calling sellTokens function", err);
                  }
                }}
              >
                Sell Tokens
              </button>
            </div>
          </div>
        )}
        {address && owner?.toLowerCase() === address.toLowerCase() && (
          <div className="card bg-base-100 p-6 mt-8 w-full max-w-lg gap-3">
            <h2 className="text-xl font-bold">Vendor treasury</h2>
            <p>Withdrawing removes the ETH available for token buybacks.</p>
            <button
              className="btn btn-secondary"
              disabled={!ready || !vendorEthBalance?.value}
              onClick={async () => {
                try {
                  await writeVendorAsync({ functionName: "withdraw" });
                } catch (error) {
                  console.error("Withdraw failed", error);
                }
              }}
            >
              Withdraw ETH
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default TokenVendor;
