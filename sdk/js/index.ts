import {
  Abi,
  Address,
  ByteArray,
  Hash,
  Log,
  PublicClient,
  stringToHex,
  WalletClient,
} from "viem";
import StreamManagerContractType from "../../.build/StreamManager.json";

export interface StreamInfo {
  token: Address;
  amount_per_second: bigint;
  max_stream_life: bigint;
  funded_amount: bigint;
  start_time: bigint;
  last_pull: bigint;
  reason: ByteArray;
}

export class Stream {
  address: Address;
  creator: Address;
  streamId: number;

  publicClient: PublicClient;
  walletClient?: WalletClient;

  constructor(
    address: Address,
    creator: Address,
    streamId: number,
    publicClient: PublicClient,
    walletClient?: WalletClient,
  ) {
    this.address = address;
    this.creator = creator;
    this.streamId = streamId;

    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  async timeLeft(): Promise<number> {
    return Number(
      (await this.publicClient.readContract({
        address: this.address,
        abi: StreamManagerContractType.abi as Abi,
        functionName: "time_left",
        args: [this.creator, this.streamId],
      })) as bigint,
    );
  }

  async streamInfo(): Promise<StreamInfo> {
    return (await this.publicClient.readContract({
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      functionName: "streams",
      args: [this.creator, this.streamId],
    })) as StreamInfo;
  }

  async token(): Promise<Address> {
    return (await this.streamInfo()).token;
  }

  async totalTime(): Promise<number> {
    const streamInfo = await this.streamInfo();
    return (
      Number(streamInfo.funded_amount / streamInfo.amount_per_second) +
      Number(streamInfo.last_pull - streamInfo.start_time)
    );
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

  async MIN_STREAM_LIFE(): Promise<number> {
    return Number(
      (await this.publicClient.readContract({
        address: this.address,
        abi: StreamManagerContractType.abi as Abi,
        functionName: "MIN_STREAM_LIFE",
      })) as bigint,
    );
  }

  async create(
    token: Address,
    amountPerSecond: number,
    reason?: string,
    startTime?: number,
    accountOverride?: Address,
  ): Promise<Stream> {
    if (!accountOverride && !this.walletClient?.account)
      throw new Error("No account");

    const account =
      accountOverride || (this.walletClient?.account?.address ?? "0x0");
    // NOTE: 0x0 shouldn't ever be the value of `account` because of the above error

    const args: Array<number | string | Address | ByteArray> = [token, amountPerSecond];
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
      })) as bigint,
    );
      
    // const hash = await this.walletClient?.writeContract({
    //   chain: null,
    //   address: this.address,
    //   abi: StreamManagerContractType.abi as Abi,
    //   functionName: "create_stream",
    //   args,
    //   account,
    // });

    // if (hash === undefined)
    //   throw new Error("Error while processing trasactions");

    return new Stream(
      this.address,
      account,
      streamId,
      this.publicClient,
      this.walletClient,
    );
  }

  onStreamCreated(
    handleStream: (stream: Stream) => null,
    creator?: Address,
  ): void {
    const onLogs = (logs: Log[]) => {
      logs
        .map(
          // Log is StreamCreated
          (log: Log) =>
            new Stream(
              log.address,
              log.topics[2] as Address, // creator
              Number(log.topics[3]), // streamId
              this.publicClient,
              this.walletClient,
            ),
        )
        .forEach(handleStream);
    };

    this.publicClient.watchContractEvent({
      address: this.address,
      abi: StreamManagerContractType.abi as Abi,
      eventName: "StreamCreated",
      args: creator ? { creator } : {},
      onLogs,
    });
  }
}
