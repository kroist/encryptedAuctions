import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useEffect, useState } from "react";
import { tokenFactoryConfig } from "../lib/contracts/tokenFactory";

export function useTokenCreation() {
  const [tokenAddress, setTokenAddress] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    writeContract: createToken,
    data: createHash,
    isPending: isCreating,
  } = useWriteContract();

  const {
    isLoading: isWaitingForCreate,
    isSuccess: createSuccess,
    data: createReceipt,
  } = useWaitForTransactionReceipt({
    hash: createHash,
  });

  // Handle successful token creation
  useEffect(() => {
    if (createSuccess && createReceipt && !tokenAddress) {
      const newTokenAddress = createReceipt.logs[0].address;
      setTokenAddress(newTokenAddress);
      setError(null);
    }
  }, [createSuccess, createReceipt, tokenAddress, setTokenAddress]);

  const handleCreateToken = async (name: string) => {
    if (!name) {
      setError("Please enter a token name");
      return;
    }
    try {
      createToken({
        ...tokenFactoryConfig,
        functionName: "create",
        args: [name, name.slice(0, 3).toUpperCase()],
      });
      setError(null);
    } catch (err) {
      setError("Failed to create token: " + (err as Error).message);
    }
  };

  return {
    tokenAddress,
    error,
    isLoading: isCreating || isWaitingForCreate,
    isSuccess: createSuccess,
    createToken: handleCreateToken,
  };
}
