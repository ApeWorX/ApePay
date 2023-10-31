import {
  Abi,
  Address,
  ByteArray,
  PublicClient,
  stringToHex,
  WalletClient,
  Log,
} from "viem";
import StreamManagerContractType from "./.build/StreamManager.json";


export interface StreamInfo {
  token: Address;
  amount_per_second: bigint;
  max_stream_life: bigint;
  funded_amount: bigint;
  start_time: bigint;
  last_pull: bigint;
  reason: ByteArray;
}

interface StreamCreated extends Log {
  args: {
    token: Address;
    creator: Address;
    stream_id: number;
    amount_per_second: number;
    start_time: number;
    reason: string;
  };
}

export class Stream {
  streamManager: StreamManager;
  creator: Address;
  streamId: number;
  token: Address;
  amountPerSecond: bigint;
  publicClient: PublicClient;
  walletClient?: WalletClient;

  constructor(
    streamManager: StreamManager,
    creator: Address,
    streamId: number,
    token: Address,
    amountPerSecond: bigint,
    publicClient: PublicClient,
    walletClient?: WalletClient
  ) {
    this.streamManager = streamManager;
    this.creator = creator;
    this.streamId = streamId;
    this.token = token;
    this.amountPerSecond = amountPerSecond;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  static async fromEventLog(
    streamManager: StreamManager,
    log: Log,
    publicClient: PublicClient,
    walletClient?: WalletClient
  ): Promise<Stream> {
    const creator = ("0x" + (log.topics[2] as string).slice(-40)) as Address;
    const streamId = Number(log.topics[3]);
    const token = ("0x" + (log.topics[1] as string).slice(-40)) as Address;

    const streamInfo: StreamInfo = (await publicClient.readContract({
      address: streamManager.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "streams",
      args: [creator, streamId],
    })) as StreamInfo;

    return new Stream(
      streamManager,
      creator,
      streamId,
      token,
      // amount_per_second can't be changed once the stream has been created
      BigInt(streamInfo.amount_per_second),
      publicClient,
      walletClient
    );
  }

  async timeLeft(): Promise<bigint> {
    return BigInt(
      (await this.publicClient.readContract({
        address: this.streamManager.address,
        abi: StreamManagerContractType.abi as Abi,
        functionName: "time_left",
        args: [this.creator, this.streamId],
      })) as bigint
    );
  }

  async streamInfo(): Promise<StreamInfo> {
    return (await this.publicClient.readContract({
      address: this.streamManager.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "streams",
      args: [this.creator, this.streamId],
    })) as StreamInfo;
  }

  async totalTime(): Promise<bigint> {
    const streamInfo = await this.streamInfo();
    return (
      streamInfo.funded_amount / BigInt(streamInfo.amount_per_second) +
      (streamInfo.last_pull - streamInfo.start_time)
    );
  }

  async addTime(amount: bigint): Promise<string> {
    if (!this.walletClient || !this.walletClient.account)
      throw new Error("Error funding stream: no wallet client set");

    return this.walletClient.writeContract({
      chain: null,
      address: this.streamManager.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "add_funds",
      args: [this.creator, this.streamId, amount],
      account: this.walletClient.account.address,
    });
  }

  async cancel(reason?: string): Promise<string> {
    if (!this.walletClient || !this.walletClient.account)
      throw new Error("Error cancelling stream: wallet client is not set");

    if (
      this.walletClient.account.address != this.creator &&
      this.walletClient.account.address != (await this.streamManager.owner())
    )
      // Both the owner and the creator of the stream can cancel it
      throw new Error(
        "Error cancelling stream: you are neither the creator nor the owner of the stream."
      );

    // pass args depending on each situation; reason is optional but must be provided
    // if not using the caller as the creator arg
    const args =
      this.walletClient.account.address != this.creator
        ? [this.streamId, reason || "", this.creator]
        : reason
        ? [this.streamId, reason]
        : [this.streamId];

    return this.walletClient.writeContract({
      chain: null,
      address: this.streamManager.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "cancel_stream",
      args: args,
      account: this.walletClient.account.address,
    });
  }

  async isCancelable(): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.streamManager.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "stream_is_cancelable",
      args: [this.creator, this.streamId],
    })) as boolean;
  }
}

export default class StreamManager {
  address: Address;
  MIN_STREAM_LIFE: bigint;
  publicClient: PublicClient;
  walletClient?: WalletClient;

  private constructor(
    address: Address,
    MIN_STREAM_LIFE: bigint,
    publicClient: PublicClient,
    walletClient?: WalletClient
  ) {
    this.address = address;
    this.MIN_STREAM_LIFE = MIN_STREAM_LIFE;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  static async fromAddress(
    address: Address,
    publicClient: PublicClient,
    walletClient?: WalletClient
  ): Promise<StreamManager> {
    const MIN_STREAM_LIFE: bigint = (await publicClient.readContract({
      address: address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "MIN_STREAM_LIFE",
    })) as bigint;

    return new StreamManager(
      address,
      MIN_STREAM_LIFE,
      publicClient,
      walletClient
    );
  }

  async owner(): Promise<Address> {
    return (await this.publicClient.readContract({
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "owner",
    })) as Address;
  }

  async isAccepted(token: Address): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "token_is_accepted",
      args: [token],
    })) as boolean;
  }

  async create(
    token: Address,
    amountPerSecond: bigint,
    reason?: string,
    startTime?: number,
    accountOverride?: Address
  ): Promise<Stream> {
    if (!accountOverride && !this.walletClient?.account)
      throw new Error("Error on create: no account");

    const account =
      accountOverride || (this.walletClient?.account?.address ?? "0x0");
    // NOTE: 0x0 shouldn't ever be the value of `account` because of the above error

    const args: Array<number | string | bigint | Address | ByteArray> = [
      token,
      amountPerSecond,
    ];
    if (startTime) {
      args.push(reason ? stringToHex(reason) : ""); // NOTE: Needs to make sure to have 4 args
      args.push(startTime);
    } else if (reason) {
      args.push(stringToHex(reason));
    }

    // NOTE: Must be before transaction since it increments `num_streams`
    const streamId = Number(
      (await this.publicClient.readContract({
        address: this.address,
        abi: StreamManagerContractType.abi as Abi,
        functionName: "num_streams",
        args: [account],
      })) as bigint
    );

    const hash = await this.walletClient?.writeContract({
      chain: null,
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "create_stream",
      args,
      account,
    });

    if (hash === undefined)
      throw new Error("Error while processing transaction; hash undefined");

    return new Stream(
      this,
      account,
      streamId,
      token,
      amountPerSecond,
      this.publicClient,
      this.walletClient
    );
  }

  onStreamCreated(
    handleStream: (stream: Stream) => void,
    creator?: Address
  ): void {
    this.publicClient.watchContractEvent({
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      eventName: "StreamCreated",
      args: creator ? { creator } : {},
      onLogs: (logs: StreamCreated[]) => {
        logs
          .map((log) => {
            return new Stream(
              this,
              log.args.creator,
              log.args.stream_id as number,
              log.args.token,
              BigInt(log.args.amount_per_second),
              this.publicClient,
              this.walletClient
            );
          })
          .forEach(handleStream);
      },
      onError: (error) => console.log(error),
    });
  }

  async fetchAllLogs(callback: (logs: Log[]) => void) {
    try {
      const logs = await this.publicClient.getContractEvents({
        address: this.address,
        abi: StreamManagerContractType.abi as Abi,
        eventName: "StreamCreated",
        fromBlock: 4596186n,
      });
      callback(logs);
    } catch (error) {
      console.error("Error fetching past logs:", error);
    }
  }
}
