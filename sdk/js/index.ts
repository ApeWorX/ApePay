import {
  getContract,
  Address,
  GetContractReturnType,
  PublicClient,
  WalletClient,
  Abi,
} from "viem";
import StreamManagerContractType from "../../.build/StreamManager.json";

export class StreamManager {
  contract: GetContractReturnType;

  constructor(
    address: Address,
    publicClient: PublicClient,
    walletClient?: WalletClient,
  ) {
    this.contract = getContract({
      address,
      abi: StreamManagerContractType.abi as Abi,
      publicClient,
      walletClient, // NOTE: Optional
    });
  }
}
