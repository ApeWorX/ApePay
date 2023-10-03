// Override this config in your downstream implementations as needed

const config = {
  streamManagerAddress: "0x3543Faeeddb7bAbCbBB216B3627f9c5E0C39CE41",
  tokens: [
    {
      chainId: 10,
      address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      name: "USDCoin",
      decimals: 6,
      symbol: "USDC.e",
    },
    {
      chainId: 42161,
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      name: "USDCoin",
      decimals: 6,
      symbol: "USDC",
    },
    {
      chainId: 11155111,
      address: "0x0579FC0e764E7CC10c7175533B1330B184B8D505",
      name: "ChaosnetToken",
      decimals: 18,
      symbol: "CHAOS",
    },
  ],
};

export default config;
