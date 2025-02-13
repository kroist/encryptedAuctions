import { useAccount, useReadContract, useSignTypedData } from "wagmi";
import { tokenAbi } from "../lib/contracts/abi/token";
import { USDC_ADDRESS } from "../lib/constants";
import { useTokenMinting } from "./useTokenMinting";
import { useState } from "react";
import { useFhevmInstance } from "./fhevmSetup";

export function useUSDCToken(address: `0x${string}` | undefined) {
  const { signTypedDataAsync } = useSignTypedData();
  const { chain } = useAccount();
  const { data: fhevmInstance } = useFhevmInstance(
    chain?.rpcUrls.default.http[0] as string
  );
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  const { refetch } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const {
    error: mintError,
    isLoading: isMinting,
    isSuccess: mintSuccess,
    mintTokens,
  } = useTokenMinting(USDC_ADDRESS);

  const checkBalance = async () => {
    if (!fhevmInstance || !address) return;

    setIsBalanceLoading(true);
    try {
      const { publicKey, privateKey } = fhevmInstance.generateKeypair();
      const eip712 = fhevmInstance.createEIP712(publicKey, USDC_ADDRESS);
      const { data: balanceRaw } = await refetch();
      if (balanceRaw === undefined) {
        return;
      }
      if (balanceRaw === 0n) {
        setBalance(0n);
        setIsBalanceLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const signature = await signTypedDataAsync(eip712 as any);
      const decrypted = await fhevmInstance.reencrypt(
        balanceRaw,
        privateKey,
        publicKey,
        signature,
        USDC_ADDRESS,
        address
      );
      setBalance(decrypted);
    } catch (error) {
      console.error("Failed to decrypt balance:", error);
    } finally {
      setIsBalanceLoading(false);
    }
  };

  return {
    balance,
    isBalanceLoading,
    mintError,
    isMinting,
    mintSuccess,
    mintTokens,
    checkBalance,
    reset: () => {
      setBalance(null);
      setIsBalanceLoading(false);
    },
  };
}
