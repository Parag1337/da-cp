export interface ProviderConfig { apiKey?: string; baseUrl: string; }
export function getProviderConfig() {
  return {
    mode: process.env.ETHERSCAN_API_KEY ? 'live' : 'demo',
    apiKeyPresent: !!process.env.ETHERSCAN_API_KEY,
    baseUrl: process.env.ETHERSCAN_BASE_URL ?? 'https://api.etherscan.io/api',
  };
}
export async function fetchAddressHistory(address: string) {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error('No API key configured; using demo data. Set ETHERSCAN_API_KEY to enable live data.');
  }
  // placeholder for real implementation
  return { address, transactions: [], source: 'etherscan' };
}