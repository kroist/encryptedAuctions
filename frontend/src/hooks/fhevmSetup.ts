import { createInstance, initFhevm } from "fhevmjs/bundle";
import { useQuery } from "@tanstack/react-query";
import {
  ACL_CONTRACT,
  GATEWAY_URL,
  KMS_VERIFIER_CONTRACT,
} from "../lib/constants";

// Initialize FHEVM once when module loads
const fhevmPromise = initFhevm();

// Hook to track initialization status
export const useFhevmInitialization = () => {
  return useQuery({
    queryKey: ["fhevm-init"],
    queryFn: () => fhevmPromise,
    staleTime: Infinity,
    gcTime: Infinity,
  });
};

// Hook to get FHEVM instance for a specific network
export const useFhevmInstance = (networkUrl: string) => {
  return useQuery({
    queryKey: ["fhevm", networkUrl],
    queryFn: async () => {
      await fhevmPromise; // Wait for initialization
      return await createInstance({
        kmsContractAddress: KMS_VERIFIER_CONTRACT,
        aclContractAddress: ACL_CONTRACT,
        networkUrl,
        gatewayUrl: GATEWAY_URL,
      });
    },
  });
};
