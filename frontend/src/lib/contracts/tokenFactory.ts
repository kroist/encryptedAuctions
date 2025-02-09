import { TOKEN_FACTORY } from "../constants";
import { tokenFactoryAbi } from "./abi/tokenFactory";

export const tokenFactoryConfig = {
  address: TOKEN_FACTORY,
  abi: tokenFactoryAbi,
} as const;
