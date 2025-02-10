import { useAccount } from "wagmi";
import { useFhevmInstance } from "./fhevmSetup";

export const useFhevmReady = () => {
  const { chain } = useAccount();
  const { data: fhevmInstance } = useFhevmInstance(
    chain?.rpcUrls.default.http[0] as string
  );
  console.log(fhevmInstance);
  return !!fhevmInstance;
};
