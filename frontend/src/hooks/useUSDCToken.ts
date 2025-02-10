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

  const { data: balanceRaw } = useReadContract({
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
    if (!balanceRaw || !fhevmInstance || !address) return;

    setIsBalanceLoading(true);
    try {
      const { publicKey, privateKey } = fhevmInstance.generateKeypair();
      const eip712 = fhevmInstance.createEIP712(publicKey, address);
      const signature = await signTypedDataAsync({
        primaryType: "Reencrypt",
        domain: {
          chainId: eip712.domain.chainId,
          name: eip712.domain.name,
          verifyingContract: eip712.domain.verifyingContract
            ? (eip712.domain.verifyingContract as `0x${string}`)
            : undefined,
          version: eip712.domain.version,
        },
        types: {
          Reencrypt: [{ name: "publicKey", type: "bytes" }],
        },
        message: {
          publicKey: publicKey as `0x${string}`,
        },
      });

      const decrypted = await fhevmInstance.reencrypt(
        balanceRaw,
        privateKey,
        publicKey,
        signature,
        address,
        USDC_ADDRESS
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
  };
}
