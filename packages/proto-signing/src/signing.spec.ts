/* eslint-disable @typescript-eslint/naming-convention */
import { Bech32, fromBase64 } from "@cosmjs/encoding";
import { coins, Secp256k1Wallet } from "@cosmjs/launchpad";
import { Client } from "@cosmjs/tendermint-rpc";
// import { Message } from "protobufjs";

// import { cosmosField, cosmosMessage } from "./decorator";
import { cosmos } from "./generated/codecimpl";
import { Registry, TxBodyValue } from "./registry";

const { AuthInfo, SignDoc, Tx, TxBody } = cosmos.tx;
const { PublicKey } = cosmos.crypto;

export function pendingWithoutSimapp(): void {
  if (!process.env.SIMAPP_ENABLED) {
    return pending("Set WASMD_ENABLED to enable Simapp based tests");
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

fdescribe("signing demo", () => {
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
