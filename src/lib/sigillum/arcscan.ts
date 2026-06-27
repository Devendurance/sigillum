export function getArcscanTransactionUrl(transactionHash: string) {
  return `https://testnet.arcscan.app/tx/${transactionHash}`;
}

export function isArcTransactionHash(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

export function formatSigillumNetworkLabel(network: string | null | undefined) {
  if (!network) {
    return null;
  }

  const normalized = network.trim().toLowerCase();
  if (normalized === "arctestnet" || normalized === "arc testnet") {
    return "Arc testnet";
  }

  if (normalized === "arcmainnet" || normalized === "arc mainnet") {
    return "Arc mainnet";
  }

  return network;
}
