import {
  Abi,
  Address,
  Log,
  PublicClient,
  TransactionReceipt,
  WalletClient,
} from "viem";
import StreamManagerContractType from "../../.build/StreamManager.json";

export class Stream {
  address: Address;
  transaction: TransactionReceipt;

  publicClient: PublicClient;
  walletClient?: WalletClient;

  constructor(
    address: Address,
    transaction: TransactionReceipt,
    publicClient: PublicClient,
    walletClient?: WalletClient,
  ) {
    this.address = address;
    this.transaction = transaction;

    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }
}

export default class StreamManager {
  address: Address;

  publicClient: PublicClient;
  walletClient?: WalletClient;

  constructor(
    address: Address,
    publicClient: PublicClient,
    walletClient?: WalletClient,
  ) {
    this.address = address;

    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  async owner() {
    return await this.publicClient.readContract({
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "owner",
    });
  }

  async isAccepted(token: Address) {
    return await this.publicClient.readContract({
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "token_is_accepted",
      args: [token],
    });
  }

  async MIN_STREAM_LIFE() {
    return await this.publicClient.readContract({
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "MIN_STREAM_LIFE",
    });
  }

  async create(
    token: Address,
    amountPerSecond: number,
    reason?: string,
    startTime?: number,
    account?: Address,
  ) {
    if (!account && !this.walletClient?.account) throw new Error("No account");

    const args: Array<number | string | Address> = [token, amountPerSecond];

    if (startTime) {
      args.push(reason || ""); // NOTE: Needs to make sure to have 4 args
      args.push(startTime);
    } else if (reason) {
      args.push(reason);
    }

    const hash = await this.walletClient?.writeContract({
      chain: null,
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "create_stream",
      args,
      account: account || (this.walletClient?.account ?? "0x0"),
    });

    if (hash === undefined)
      throw new Error("Error while processing trasactions");

    const transaction = await this.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 10, // NOTE: 10 confs just to be extra careful
    });

    return new Stream(
      this.address,
      transaction,
      this.publicClient,
      this.walletClient,
    );
  }

  onStreamCreated(onLogs: (logs: Log[]) => null, creator?: Address) {
    return this.publicClient.watchContractEvent({
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      eventName: "StreamCreated",
      args: creator ? { creator } : {},
      onLogs,
    });
  }
}
