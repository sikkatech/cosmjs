/* eslint-disable @typescript-eslint/naming-convention */
import { Bech32, fromBase64, fromHex, toHex } from "@cosmjs/encoding";
import { coins, Secp256k1Wallet } from "@cosmjs/launchpad";
import { Client } from "@cosmjs/tendermint-rpc";
import { assert } from "@cosmjs/utils";

import { cosmos } from "./generated/codecimpl";
import { defaultRegistry } from "./msgs";
import { DecodeObject, Registry, TxBodyValue } from "./registry";

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

// Test Vectors
// simd tx bank send --sign-mode direct --chain-id simd-testing testgen cosmos1qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lzv7xu 1234567ucosm -b block
// (with my custom fork with Printfs)
//
const signedTxBytesSeq0 =
  "0a580a560a142f636f736d6f732e62616e6b2e4d736753656e64123e0a140d82b1e7c96dbfa42462fe612932e6bff111d51b12140102030405060708090a0b0c0d0e0f10111213141a100a0575636f736d12073132333435363712330a2b0a230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801120410c09a0c1a40692d88f681d5d69924a53668e8ecec535ca0ca170d1febfb1dd87de9959b07340427d6bba22526d6c30cc622f27dc5eb1ce04cfc0ff98716154066ec69db62e5";
const signBytesSeq0 =
  "0a580a560a142f636f736d6f732e62616e6b2e4d736753656e64123e0a140d82b1e7c96dbfa42462fe612932e6bff111d51b12140102030405060708090a0b0c0d0e0f10111213141a100a0575636f736d12073132333435363712330a2b0a230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801120410c09a0c1a0c73696d642d74657374696e672001";
const signatureSeq0 =
  "692d88f681d5d69924a53668e8ecec535ca0ca170d1febfb1dd87de9959b07340427d6bba22526d6c30cc622f27dc5eb1ce04cfc0ff98716154066ec69db62e5";

const signedTxBytesSeq1 =
  "0a580a560a142f636f736d6f732e62616e6b2e4d736753656e64123e0a140d82b1e7c96dbfa42462fe612932e6bff111d51b12140102030405060708090a0b0c0d0e0f10111213141a100a0575636f736d12073132333435363712330a2b0a230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801120410c09a0c1a40811c3c7dd85b1478b15e3cc710503045559d805d2bf538e5015dbcd868a440a94c7fc0b12b755a838cc3f9b8245d9f926e0432d07ee97557cff7c50c73f64a58";
const signBytesSeq1 =
  "0a580a560a142f636f736d6f732e62616e6b2e4d736753656e64123e0a140d82b1e7c96dbfa42462fe612932e6bff111d51b12140102030405060708090a0b0c0d0e0f10111213141a100a0575636f736d12073132333435363712330a2b0a230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801120410c09a0c1a0c73696d642d74657374696e6720012801";
const signatureSeq1 =
  "811c3c7dd85b1478b15e3cc710503045559d805d2bf538e5015dbcd868a440a94c7fc0b12b755a838cc3f9b8245d9f926e0432d07ee97557cff7c50c73f64a58";

const signedTxBytesSeq2 =
  "0a580a560a142f636f736d6f732e62616e6b2e4d736753656e64123e0a140d82b1e7c96dbfa42462fe612932e6bff111d51b12140102030405060708090a0b0c0d0e0f10111213141a100a0575636f736d12073132333435363712330a2b0a230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801120410c09a0c1a405e2e11567c181db4f38788ff6d417b1f7d147f3d6bd8274989bf181c35b3fb97218f64172030dd5a84dd38933765609d70771cbba60168d8ded611f14ec4fb12";
const signBytesSeq2 =
  "0a580a560a142f636f736d6f732e62616e6b2e4d736753656e64123e0a140d82b1e7c96dbfa42462fe612932e6bff111d51b12140102030405060708090a0b0c0d0e0f10111213141a100a0575636f736d12073132333435363712330a2b0a230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801120410c09a0c1a0c73696d642d74657374696e6720012802";
const signatureSeq2 =
  "5e2e11567c181db4f38788ff6d417b1f7d147f3d6bd8274989bf181c35b3fb97218f64172030dd5a84dd38933765609d70771cbba60168d8ded611f14ec4fb12";

fdescribe("signing demo", () => {
  const chainId = "simd-testing";
  const toAddress = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

  const sendAmount = "1234567";
  const sendDenom = "ucosm";
  const gasLimit = 200000;

  it("document generate test vectors", async () => {
    const wallet = await Secp256k1Wallet.fromMnemonic(faucet.mnemonic);
    const [{ address }] = await wallet.getAccounts();

    const msgSendFields = {
      fromAddress: Bech32.decode(address).data,
      toAddress: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]),
      amount: coins(1234567, "ucosm"),
    };

    // To generate the test tx from cosmos-SDK
    console.log("To generate test vectors:");
    console.log("Unsigned tx with exact same accounts:");
    console.log(
      `simd tx bank send --generate-only --offline --chain-id ${chainId} ${address} ${Bech32.encode(
        "cosmos",
        msgSendFields.toAddress,
      )} 1234567ucosm`,
    );
    console.log("");
    console.log("Signed tx with local account:");
    console.log("simd keys add -i testgen");
    console.log(faucet.mnemonic);
    console.log("");
    console.log("simd keys show -a testgen");
    console.log(`Should give ${address}`);
    console.log("");
    console.log("This doesn't seem to work.... but should sign without broadcast");
    console.log(
      `simd tx bank send --offline --chain-id ${chainId} -a 1 testgen ${Bech32.encode(
        "cosmos",
        msgSendFields.toAddress,
      )} 1234567ucosm`,
    );
  });

  fit("correctly parses test vectors", async () => {
    const myRegistry = new Registry();
    const wallet = await Secp256k1Wallet.fromMnemonic(faucet.mnemonic);
    const [{ address, pubkey: pubkeyBytes }] = await wallet.getAccounts();
    const publicKey = PublicKey.create({
      secp256k1: pubkeyBytes,
    });

    const parsedTestTx = Tx.decode(fromHex(signedTxBytesSeq0));
    console.log(JSON.stringify(parsedTestTx));
    console.log(parsedTestTx);
    console.log(Uint8Array.from(AuthInfo.encode(parsedTestTx.authInfo!).finish()));
    expect(parsedTestTx.signatures.length).toEqual(1);
    expect(parsedTestTx.authInfo?.signerInfos?.length).toEqual(1);
    expect(parsedTestTx.authInfo?.signerInfos![0].publicKey!.secp256k1).toEqual(pubkeyBytes);
    expect(parsedTestTx.authInfo?.signerInfos![0].modeInfo!.single!.mode).toEqual(1);
    expect(parsedTestTx.authInfo?.fee!.amount).toEqual([]);
    expect(parsedTestTx.authInfo?.fee!.gasLimit!.toString()).toEqual(gasLimit.toString());
    expect(parsedTestTx.body?.extensionOptions).toEqual([]);
    expect(parsedTestTx.body?.nonCriticalExtensionOptions).toEqual([]);
    expect(parsedTestTx.body!.messages!.length).toEqual(1);

    const parsedTestTxMsg = defaultRegistry.decode({
      typeUrl: parsedTestTx.body!.messages![0].type_url!,
      value: parsedTestTx.body!.messages![0].value!,
    });
    expect(parsedTestTxMsg.from_address).toEqual(Bech32.decode(address).data);
    expect(parsedTestTxMsg.to_address).toEqual(
      Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]),
    );
    expect(parsedTestTxMsg.amount.length).toEqual(1);
    expect(parsedTestTxMsg.amount[0].denom).toEqual(sendDenom);
    expect(parsedTestTxMsg.amount[0].amount).toEqual(sendAmount);
  });

  fit("correctly generates test vectors", async () => {
    const myRegistry = new Registry();
    const wallet = await Secp256k1Wallet.fromMnemonic(faucet.mnemonic);
    const [{ address, pubkey: pubkeyBytes }] = await wallet.getAccounts();
    const publicKey = PublicKey.create({
      secp256k1: pubkeyBytes,
    });

    const txBodyFields: TxBodyValue = {
      messages: [
        {
          typeUrl: "/cosmos.bank.MsgSend",
          value: {
            fromAddress: Bech32.decode(address).data,
            toAddress: toAddress,
            amount: [
              {
                denom: sendDenom,
                amount: sendAmount,
              },
            ],
          },
        },
      ],
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
        gasLimit: gasLimit,
      },
    };
    const authInfoBytes = Uint8Array.from(AuthInfo.encode(authInfo).finish());
    const accountNumber = 1;
    const sequence = undefined; // go doesn't encode 0's
    const signDoc = SignDoc.create({
      bodyBytes: txBodyBytes,
      authInfoBytes: authInfoBytes,
      chainId: chainId,
      accountNumber: accountNumber,
      accountSequence: sequence,
    });
    // console.log(signDoc);

    console.log(signDoc);
    const signDocBytes = Uint8Array.from(SignDoc.encode(signDoc).finish());
    console.log(SignDoc.decode(signDocBytes));
    // 0a580a560a142f636f736d6f732e62616e6b2e4d736753656e64123e0a140d82b1e7c96dbfa42462fe612932e6bff111d51b12140102030405060708090a0b0c0d0e0f10111213141a100a0575636f736d12073132333435363712330a2b0a230a21034f04181eeba35391b858633a765c4a0c189697b40d216354d50890d350c7029012040a020801120410c09a0c1a0c73696d642d74657374696e6720012800
    console.log(toHex(signDocBytes));
    expect(toHex(signDocBytes)).toEqual(signBytesSeq0);
    const signature = await wallet.sign(address, signDocBytes);
    const txRaw = Tx.create({
      body: txBody,
      authInfo: authInfo,
      signatures: [fromBase64(signature.signature)],
    });
    const txRawBytes = Uint8Array.from(Tx.encode(txRaw).finish());
    const txBytesHex = toHex(txRawBytes);

    // TODO: Everything is the same except the signature.
    // Presumably because of the account number or sequence?
    console.log(JSON.stringify(Tx.decode(txRawBytes)));
    expect(txBytesHex.length).toEqual(signedTxBytesSeq0.length);
    expect(txBytesHex).toEqual(signedTxBytesSeq0);
  });

  // it("creates a SignDoc and a TxRaw", async () => {
  //   pendingWithoutSimapp();
  //   const tendermintUrl = "localhost:26657";
  //   const client = await Client.connect(tendermintUrl);

  //   const wallet = await Secp256k1Wallet.fromMnemonic(faucet.mnemonic);
  //   const [{ address, pubkey: pubkeyBytes }] = await wallet.getAccounts();
  //   const publicKey = PublicKey.create({
  //     secp256k1: pubkeyBytes,
  //   });

  //   const myRegistry = new Registry();

  //   const msgSendFields = {
  //     fromAddress: Bech32.decode(address).data,
  //     toAddress: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]),
  //     amount: coins(1234567, "ucosm"),
  //   };

  //   const txBodyFields: TxBodyValue = {
  //     messages: [{ typeUrl: "/cosmos.bank.MsgSend", value: msgSendFields }],
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
  //             mode: cosmos.tx.signing.SignMode.SIGN_MODE_DIRECT,
  //           },
  //         },
  //       },
  //     ],
  //     fee: {
  //       amount: coins(5000, "ucosm"),
  //       gasLimit: 890000,
  //     },
  //   };
  //   const authInfoBytes = Uint8Array.from(AuthInfo.encode(authInfo).finish());
  //   const accountNumber = 1;
  //   const sequence = 0;
  //   const signDoc = SignDoc.create({
  //     bodyBytes: txBodyBytes,
  //     authInfoBytes: authInfoBytes,
  //     chainId: chainId,
  //     accountNumber: accountNumber,
  //     accountSequence: sequence,
  //   });
  //   console.log(signDoc);

  //   const signDocBytes = SignDoc.encode(signDoc).finish();
  //   const signature = await wallet.sign(address, signDocBytes);
  //   const txRaw = Tx.create({
  //     body: txBody,
  //     authInfo: authInfo,
  //     signatures: [fromBase64(signature.signature)],
  //   });
  //   const txRawBytes = Tx.encode(txRaw).finish();
  //   console.log(txRawBytes);

  //   const response = await client.broadcastTxCommit({ tx: txRawBytes });
  //   expect(response.height).not.toEqual(0);
  //   console.log(signDoc);
  //   console.log(txRaw);
  //   console.log(txRaw.body!.messages);
  //   console.log(response);
  // });

  // it("creates a SignDoc and a TxRaw with a custom msg", async () => {
  //   const tendermintUrl = "localhost:26657";
  //   const client = await Client.connect(tendermintUrl);

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
