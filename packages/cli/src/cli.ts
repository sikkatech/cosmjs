import axios from "axios";
import * as fs from "fs";
import { join } from "path";
import yargs from "yargs";

import { TsRepl } from "./tsrepl";

import colors = require("colors/safe");

export async function main(originalArgs: readonly string[]): Promise<void> {
  const args = yargs
    .options({
      // User options (we get --help and --version for free)
      init: {
        describe:
          "Read initial TypeScript code from the given sources. This can be URLs (supported schemes: https) or local file paths.",
        type: "array",
      },
      code: {
        describe:
          "Add initial TypeScript code from the argument. All code arguments are processed after all init arguments.",
        type: "array",
      },
      // Maintainer options
      debug: {
        describe: "Enable debugging",
        type: "boolean",
      },
      selftest: {
        describe: "Run a selftext and exit",
        type: "boolean",
      },
    })
    .group(["init", "code", "help", "version"], "User options")
    .group(["debug", "selftest"], "Maintainer options")
    .parse(originalArgs);

  const imports = new Map<string, readonly string[]>([
    [
      "@cosmjs/cosmwasm",
      [
        // cosmwasmclient
        "Account",
        "Block",
        "BlockHeader",
        "Code",
        "CodeDetails",
        "Contract",
        "ContractCodeHistoryEntry",
        "CosmWasmClient",
        "GetSequenceResult",
        "SearchByHeightQuery",
        "SearchByIdQuery",
        "SearchBySentFromOrToQuery",
        "SearchByTagsQuery",
        "SearchTxQuery",
        "SearchTxFilter",
        // signingcosmwasmclient
        "ExecuteResult",
        "FeeTable",
        "InstantiateResult",
        "SigningCosmWasmClient",
        "UploadMeta",
        "UploadResult",
      ],
    ],
    [
      "@cosmjs/crypto",
      [
        "Bip39",
        "Ed25519",
        "Ed25519Keypair",
        "EnglishMnemonic",
        "Random",
        "Secp256k1",
        "Sha256",
        "Sha512",
        "Slip10",
        "Slip10Curve",
        "Slip10RawIndex",
      ],
    ],
    [
      "@cosmjs/encoding",
      ["fromAscii", "fromBase64", "fromHex", "fromUtf8", "toAscii", "toBase64", "toHex", "toUtf8", "Bech32"],
    ],
    [
      "@cosmjs/launchpad",
      [
        "coin",
        "coins",
        "encodeSecp256k1Pubkey",
        "encodeSecp256k1Signature",
        "logs",
        "makeCosmoshubPath",
        "makeSignBytes",
        "IndexedTx",
        "BroadcastTxResult",
        "Coin",
        "CosmosClient",
        "Msg",
        "MsgDelegate",
        "MsgSend",
        "LcdClient",
        "OfflineSigner",
        "PubKey",
        "pubkeyToAddress",
        "Secp256k1Wallet",
        "SigningCosmosClient",
        "StdFee",
        "StdTx",
      ],
    ],
    ["@cosmjs/math", ["Decimal", "Int53", "Uint32", "Uint53", "Uint64"]],
    ["@cosmjs/utils", ["assert", "sleep"]],
  ]);

  console.info(colors.green("Initializing session for you. Have fun!"));
  console.info(colors.yellow("Available imports:"));
  console.info(colors.yellow("  * axios"));
  console.info(colors.yellow("  * fs"));
  for (const [moduleName, symbols] of imports.entries()) {
    console.info(colors.yellow(`  * from ${moduleName}: ${symbols.join(", ")}`));
  }

  let init = `
    import axios from "axios";
    import * as fs from "fs";
  `;
  for (const [moduleName, symbols] of imports.entries()) {
    init += `import { ${symbols.join(", ")} } from "${moduleName}";\n`;
  }

  if (args.selftest) {
    // execute some trival stuff and exit
    init += `
      await sleep(123);

      const readmeContent = fs.readFileSync(process.cwd() + "/README.md");
      fs.writeFileSync(process.cwd() + "/README.md", readmeContent);

      const hash = new Sha512(new Uint8Array([])).digest();
      const hexHash = toHex(hash);
      export class NewDummyClass {};

      const original = "hello world";
      const encoded = toHex(toUtf8(toBase64(toAscii(original))));
      const decoded = fromAscii(fromBase64(fromUtf8(fromHex(encoded))));
      assert(decoded === original);

      assert(Decimal.fromAtomics("12870000", 6).toString() === "12.87");

      const mnemonic = Bip39.encode(Random.getBytes(16)).toString();
      const wallet = await Secp256k1Wallet.fromMnemonic(mnemonic, makeCosmoshubPath(0));
      const [{ address }] = await wallet.getAccounts();
      const data = toAscii("foo bar");
      const signature = await wallet.sign(address, data);

      console.info("Done testing, will exit now.");
      process.exit(0);
    `;
  }

  if (args.init) {
    for (const source of args.init.map((arg) => arg.toString())) {
      if (args.debug) console.info(`Adding code from: '${source}' ...`);
      if (source.startsWith("https://")) {
        const response = await axios.get(source);
        init += response.data + "\n";
      } else {
        init += fs.readFileSync(source, "utf8") + "\n";
      }
    }
  }

  if (args.code) {
    for (const code of args.code.map((arg) => arg.toString())) {
      if (args.debug) console.info(`Adding code: '${code}' ...`);
      init += `${code}\n`;
    }
  }

  const tsconfigPath = join(__dirname, "..", "tsconfig_repl.json");
  const installationDir = join(__dirname, "..");
  new TsRepl(tsconfigPath, init, !!args.debug, installationDir).start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
