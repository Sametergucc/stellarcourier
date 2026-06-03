import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAU3L6VLBKVXNCHKLWPFDFP4QFFDTO7KSKRPAHUASIMGZCD4WEAFG7UF",
  }
} as const

export type Status = {tag: "Active", values: void} | {tag: "Released", values: void} | {tag: "Refunded", values: void};

export type DataKey = {tag: "State", values: void};


export interface EscrowState {
  amount: i128;
  courier: string;
  expiry_ledger: u32;
  secret_hash: Buffer;
  sender: string;
  status: Status;
  token: string;
}

export interface Client {
  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sender reclaims USDC after expiry if courier never delivered.
   */
  refund: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a release transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Courier submits the plain-text QR secret to release funds.
   */
  release: ({courier, secret}: {courier: string, secret: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_state: (options?: MethodOptions) => Promise<AssembledTransaction<EscrowState>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sender locks USDC and registers delivery.
   * Frontend must call token.approve(sender, contract, amount, expiry) first.
   */
  initialize: ({sender, courier, token, amount, secret_hash, expiry_ledger}: {sender: string, courier: string, token: string, amount: i128, secret_hash: Buffer, expiry_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAD1TZW5kZXIgcmVjbGFpbXMgVVNEQyBhZnRlciBleHBpcnkgaWYgY291cmllciBuZXZlciBkZWxpdmVyZWQuAAAAAAAABnJlZnVuZAAAAAAAAAAAAAA=",
        "AAAAAAAAADpDb3VyaWVyIHN1Ym1pdHMgdGhlIHBsYWluLXRleHQgUVIgc2VjcmV0IHRvIHJlbGVhc2UgZnVuZHMuAAAAAAAHcmVsZWFzZQAAAAACAAAAAAAAAAdjb3VyaWVyAAAAABMAAAAAAAAABnNlY3JldAAAAAAADgAAAAA=",
        "AAAAAgAAAAAAAAAAAAAABlN0YXR1cwAAAAAAAwAAAAAAAAAAAAAABkFjdGl2ZQAAAAAAAAAAAAAAAAAIUmVsZWFzZWQAAAAAAAAAAAAAAAhSZWZ1bmRlZA==",
        "AAAAAAAAAAAAAAAJZ2V0X3N0YXRlAAAAAAAAAAAAAAEAAAfQAAAAC0VzY3Jvd1N0YXRlAA==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAQAAAAAAAAAAAAAABVN0YXRlAAAA",
        "AAAAAAAAAHNTZW5kZXIgbG9ja3MgVVNEQyBhbmQgcmVnaXN0ZXJzIGRlbGl2ZXJ5LgpGcm9udGVuZCBtdXN0IGNhbGwgdG9rZW4uYXBwcm92ZShzZW5kZXIsIGNvbnRyYWN0LCBhbW91bnQsIGV4cGlyeSkgZmlyc3QuAAAAAAppbml0aWFsaXplAAAAAAAGAAAAAAAAAAZzZW5kZXIAAAAAABMAAAAAAAAAB2NvdXJpZXIAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAC3NlY3JldF9oYXNoAAAAA+4AAAAgAAAAAAAAAA1leHBpcnlfbGVkZ2VyAAAAAAAABAAAAAA=",
        "AAAAAQAAAAAAAAAAAAAAC0VzY3Jvd1N0YXRlAAAAAAcAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAHY291cmllcgAAAAATAAAAAAAAAA1leHBpcnlfbGVkZ2VyAAAAAAAABAAAAAAAAAALc2VjcmV0X2hhc2gAAAAD7gAAACAAAAAAAAAABnNlbmRlcgAAAAAAEwAAAAAAAAAGc3RhdHVzAAAAAAfQAAAABlN0YXR1cwAAAAAAAAAAAAV0b2tlbgAAAAAAABM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    refund: this.txFromJSON<null>,
        release: this.txFromJSON<null>,
        get_state: this.txFromJSON<EscrowState>,
        initialize: this.txFromJSON<null>
  }
}