import { BID_SERVER_URL } from "./constants";

export async function getSequencerAddress() {
  const bidSequencerAddress = await fetch(BID_SERVER_URL + "/address");
  const body = await bidSequencerAddress.json();
  if (!body.address) {
    throw new Error("Failed to fetch bid sequencer address");
    return;
  }
  const bidSequencer = body.address;
  return bidSequencer;
}

export async function getSequencerSignature(
  contractAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  tokenAmount: bigint,
  bidToken: `0x${string}`,
  bidSequencer: `0x${string}`,
  floorPrice: bigint,
  startTime: bigint,
  endTime: bigint,
  stakeToken: `0x${string}`,
  stakeAmount: bigint
) {
  const params = {
    contractAddress,
    token: tokenAddress,
    tokenAmount,
    bidToken,
    bidSequencer,
    floorPrice,
    startTime,
    endTime,
    stakeToken,
    stakeAmount,
  };

  const response = await fetch(BID_SERVER_URL + "/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params, (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    }),
  });

  const body = await response.json();
  if (!body.signature) {
    throw new Error("Failed to fetch sequencer signature");
    return;
  }
  return body.signature;
}
