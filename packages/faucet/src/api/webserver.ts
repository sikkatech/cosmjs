import Koa from "koa";
import cors = require("@koa/cors");
import bodyParser from "koa-bodyparser";

import { isValidAddress } from "../addresses";
import * as constants from "../constants";
import { Faucet } from "../faucet";
import { HttpError } from "./httperror";
import { RequestParser } from "./requestparser";

/** This will be passed 1:1 to the user */
export interface ChainConstants {
  readonly nodeUrl: string;
  readonly chainId: string;
}

export class Webserver {
  private readonly api = new Koa();

  constructor(faucet: Faucet, chainConstants: ChainConstants) {
    this.api.use(cors());
    this.api.use(bodyParser());

    this.api.use(async (context) => {
      switch (context.path) {
        case "/":
        case "/healthz":
          context.response.body =
            "Welcome to the faucet!\n" +
            "\n" +
            "Check the full status via the /status endpoint.\n" +
            "You can get tokens from here by POSTing to /credit.\n" +
            "See https://github.com/CosmWasm/cosmjs/tree/master/packages/faucet for all further information.\n";
          break;
        case "/status": {
          const [holder, ...distributors] = await faucet.loadAccounts();
          const availableTokens = await faucet.availableTokens();
          const chainTokens = faucet.loadTokenTickers();
          context.response.body = {
            status: "ok",
            ...chainConstants,
            chainTokens: chainTokens,
            availableTokens: availableTokens,
            holder: holder,
            distributors: distributors,
          };
          break;
        }
        case "/credit": {
          if (context.request.method !== "POST") {
            throw new HttpError(405, "This endpoint requires a POST request");
          }

          if (context.request.type !== "application/json") {
            throw new HttpError(415, "Content-type application/json expected");
          }

          // context.request.body is set by the bodyParser() plugin
          const requestBody = context.request.body;
          const { address, ticker } = RequestParser.parseCreditBody(requestBody);

          if (!isValidAddress(address, constants.addressPrefix)) {
            throw new HttpError(400, "Address is not in the expected format for this chain.");
          }

          const availableTokens = await faucet.availableTokens();
          if (availableTokens.indexOf(ticker) === -1) {
            const tokens = JSON.stringify(availableTokens);
            throw new HttpError(422, `Token is not available. Available tokens are: ${tokens}`);
          }

          try {
            await faucet.credit(address, ticker);
          } catch (e) {
            console.error(e);
            throw new HttpError(500, "Sending tokens failed");
          }

          context.response.body = "ok";
          break;
        }
        default:
        // koa sends 404 by default
      }
    });
  }

  public start(port: number): void {
    console.info(`Starting webserver on port ${port} ...`);
    this.api.listen(port);
  }
}
