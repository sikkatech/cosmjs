import Long from "long";

/* eslint-disable @typescript-eslint/naming-convention */
import { Bech32, fromBase64, toHex, fromUtf8, toAscii } from "@cosmjs/encoding";
import { coins, Secp256k1Wallet } from "@cosmjs/launchpad";
import { Client } from "@cosmjs/tendermint-rpc";
import { assert } from "@cosmjs/utils";
// import { Message } from "protobufjs";

// import { cosmosField, cosmosMessage } from "./decorator";
import { cosmos, google } from "./generated/codecimpl";
import { BaseAccount, Coin } from "./msgs";
import { Registry, TxBodyValue } from "./registry";

const { AuthInfo, SignDoc, Tx, TxBody } = cosmos.tx;
const { PublicKey } = cosmos.crypto;

export function pendingWithoutSimapp(): void {
  if (!process.env.SIMAPP_ENABLED) {
    return pending("Set SIMAPP_ENABLED to enable Simapp based tests");
  }
}

const faucet = {
  mnemonic:
    "economy stock theory fatal elder harbor betray wasp final emotion task crumble siren bottom lizard educate guess current outdoor pair theory focus wife stone",
  pubkey: {
    type: "tendermint/PubKeySecp256k1",
    value: "A08EGB7ro1ORuFhjOnZcSgwYlpe0DSFjVNUIkNNQxwKQ",
  },
  address: "cosmos1pkptre7fdkl6gfrzlesjjvhxhlc3r4gmmk8rs6",
};


fdescribe("query account", () => {
  it("decode account data for a genesis account", async () => {
    pendingWithoutSimapp();
    const tendermintUrl = "localhost:26657";
    const client = await Client.connect(tendermintUrl);
    const chainId = "simd-testing";

    const wallet = await Secp256k1Wallet.fromMnemonic(faucet.mnemonic);
    const [{ address }] = await wallet.getAccounts();
    const binAddress = Bech32.decode(address).data;

    // https://github.com/cosmos/cosmos-sdk/blob/8cab43c8120fec5200c3459cbf4a92017bb6f287/x/auth/types/keys.go#L29-L32
    const accountKey = Uint8Array.from([1, ...binAddress]);

    const resp = await client.abciQuery({
      // we need the StoreKey for the module, not the module name
      // https://github.com/cosmos/cosmos-sdk/blob/8cab43c8120fec5200c3459cbf4a92017bb6f287/x/auth/types/keys.go#L12
      path: "/store/acc/key",
      data: accountKey,
      prove: false,
    });

    assert(!resp.code);
    expect(resp.key).toEqual(accountKey);

    const envelope = google.protobuf.Any.decode(resp.value);
    expect(envelope.type_url).toEqual('/cosmos.auth.BaseAccount');
    const account = BaseAccount.decode(envelope.value);

    expect(account.address).toEqual(binAddress);
    expect(account.account_number).toEqual(Long.fromInt(1, true));
    expect(account.sequence).toEqual(Long.fromInt(0, true));
  })

  it("decode bank data for a genesis account", async () => {
    pendingWithoutSimapp();
    const tendermintUrl = "localhost:26657";
    const client = await Client.connect(tendermintUrl);
    const chainId = "simd-testing";

    const wallet = await Secp256k1Wallet.fromMnemonic(faucet.mnemonic);
    const [{ address }] = await wallet.getAccounts();
    const binAddress = Bech32.decode(address).data;

    // balance key is a bit tricker, using some prefix stores
    // https://github.com/cosmwasm/cosmos-sdk/blob/80f7ff62f79777a487d0c7a53c64b0f7e43c47b9/x/bank/keeper/view.go#L74-L77
    // ("balances", binAddress, denom)
    // it seem like prefix stores just do a dumb concat with the keys (no tricks to avoid overlap)
    // https://github.com/cosmos/cosmos-sdk/blob/2879c0702c87dc9dd828a8c42b9224dc054e28ad/store/prefix/store.go#L61-L64
    // https://github.com/cosmos/cosmos-sdk/blob/2879c0702c87dc9dd828a8c42b9224dc054e28ad/store/prefix/store.go#L37-L43
    const bankKey = Uint8Array.from([...toAscii("balances"), ...binAddress, ...toAscii("ucosm")]);

    const resp = await client.abciQuery({
      // we need the StoreKey for the module, in this case same as module name
      // https://github.com/cosmos/cosmos-sdk/blob/5a7e22022cc9dd2e2f9ea72742f3cf1444fe889a/x/bank/types/key.go#L14
      path: "/store/bank/key",
      data: bankKey,
      prove: false,
    });

    assert(!resp.code);
    expect(resp.key).toEqual(bankKey);
    expect(resp.value).toBeDefined();

    const balance = Coin.decode(resp.value);
    console.log(balance);
    expect(balance.denom).toEqual("ucosm");
    expect(balance.amount).toEqual("1000000000");
  })
});

describe("signing demo", () => {
  it("creates a SignDoc and a TxRaw", async () => {
    pendingWithoutSimapp();
    const tendermintUrl = "localhost:26657";
    const client = await Client.connect(tendermintUrl);
    const chainId = "simd-testing";

    const wallet = await Secp256k1Wallet.fromMnemonic(faucet.mnemonic);
    const [{ address, pubkey: pubkeyBytes }] = await wallet.getAccounts();
    const publicKey = PublicKey.create({
      secp256k1: pubkeyBytes,
    });

    const myRegistry = new Registry();

    const msgSendFields = {
      fromAddress: Bech32.decode(address).data,
      toAddress: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]),
      amount: coins(1234567, "ucosm"),
    };
    const txBodyFields: TxBodyValue = {
      messages: [{ typeUrl: "/cosmos.bank.MsgSend", value: msgSendFields }],
      memo: "Some memo",
      timeoutHeight: 9999,
      extensionOptions: [],
    };
    const txBodyBytes = myRegistry.encode({
      typeUrl: "/cosmos.tx.TxBody",
      value: txBodyFields,
    });
    const txBody = TxBody.decode(txBodyBytes);

    const authInfo = {
      signerInfos: [
        {
          publicKey: publicKey,
          modeInfo: {
            single: {
              mode: cosmos.tx.signing.SignMode.SIGN_MODE_DIRECT,
            },
          },
        },
      ],
      fee: {
        amount: coins(5000, "ucosm"),
        gasLimit: 890000,
      },
    };
    const authInfoBytes = Uint8Array.from(AuthInfo.encode(authInfo).finish());
    const accountNumber = 1;
    const sequence = 0;
    const signDoc = SignDoc.create({
      bodyBytes: txBodyBytes,
      authInfoBytes: authInfoBytes,
      chainId: chainId,
      accountNumber: accountNumber,
      accountSequence: sequence,
    });
    console.log(signDoc);

    const signDocBytes = SignDoc.encode(signDoc).finish();
    const signature = await wallet.sign(address, signDocBytes);
    const txRaw = Tx.create({
      body: txBody,
      authInfo: authInfo,
      signatures: [fromBase64(signature.signature)],
    });
    const txRawBytes = Tx.encode(txRaw).finish();
    console.log(txRawBytes);

    const response = await client.broadcastTxCommit({ tx: txRawBytes });
    expect(response.height).not.toEqual(0);
    console.log(signDoc);
    console.log(txRaw);
    console.log(txRaw.body!.messages);
    console.log(response);
  });

  // it("creates a SignDoc and a TxRaw with a custom msg", async () => {
  //   const tendermintUrl = "localhost:26657";
  //   const client = await Client.connect(tendermintUrl);
  //   const chainId = "testing";

  //   const wallet = await Secp256k1Wallet.fromMnemonic(faucet.mnemonic);

  //   const publicKey = {};

  //   const nestedTypeUrl = "/demo.MsgNestedRawDemo";
  //   const typeUrl = "/demo.MsgRawDemo";
  //   const myRegistry = new Registry();

  //   @cosmosMessage(myRegistry, nestedTypeUrl)
  //   class MsgNestedRawDemo extends Message<{}> {
  //     @cosmosField.string(1)
  //     public readonly foo?: string;
  //   }

  //   @cosmosMessage(myRegistry, typeUrl)
  //   /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  //   class MsgRawDemo extends Message<{}> {
  //     @cosmosField.boolean(1)
  //     public readonly booleanDemo?: boolean;

  //     @cosmosField.string(2)
  //     public readonly stringDemo?: string;

  //     @cosmosField.bytes(3)
  //     public readonly bytesDemo?: Uint8Array;

  //     @cosmosField.int64(4)
  //     public readonly int64Demo?: number;

  //     @cosmosField.uint64(5)
  //     public readonly uint64Demo?: number;

  //     @cosmosField.repeatedString(6)
  //     public readonly listDemo?: readonly string[];

  //     @cosmosField.message(7, MsgNestedRawDemo)
  //     public readonly nestedDemo?: MsgNestedRawDemo;
  //   }

  //   const msgNestedDemoFields = {
  //     foo: "bar",
  //   };
  //   const msgDemoFields = {
  //     booleanDemo: true,
  //     stringDemo: "example text",
  //     bytesDemo: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]),
  //     int64Demo: -123,
  //     uint64Demo: 123,
  //     listDemo: ["this", "is", "a", "list"],
  //     nestedDemo: msgNestedDemoFields,
  //   };
  //   const txBodyFields = {
  //     messages: [{ typeUrl: typeUrl, value: msgDemoFields }],
  //     memo: "Some memo",
  //     timeoutHeight: 9999,
  //     extensionOptions: [],
  //   };
  //   const txBodyBytes = myRegistry.encode({
  //     typeUrl: "/cosmos.tx.TxBody",
  //     value: txBodyFields,
  //   });
  //   const txBody = TxBody.decode(txBodyBytes);

  //   const authInfo = {
  //     signerInfos: [
  //       {
  //         publicKey: publicKey,
  //         modeInfo: {
  //           single: {
  //             mode: cosmos.tx.signing.v1.SignMode.SIGN_MODE_DIRECT,
  //           },
  //         },
  //       },
  //     ],
  //     fee: {
  //       amount: coins(5000, "ucosm"),
  //       gasLimit: 890000,
  //     },
  //   };
  //   const signDoc = SignDoc.create({
  //     body: txBody,
  //     authInfo: authInfo,
  //     chainId: chainId,
  //     accountNumber: 0,
  //     accountSequence: 0,
  //   });
  //   const txRaw = Tx.create({
  //     body: txBody,
  //     authInfo: authInfo,
  //     signatures: [],
  //   });
  //   const txRawBytes = Tx.encode(txRaw).finish();

  //   const response = await client.broadcastTxCommit({ tx: txRawBytes });
  //   expect(response.height).not.toEqual(0);
  //   console.log(signDoc);
  //   console.log(txRaw);
  //   console.log(response);
  // });
});
