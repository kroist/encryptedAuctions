import { bytesToHex } from "viem";

export function getRandomBytes(): `0x${string}` {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToHex(randomBytes);
}
