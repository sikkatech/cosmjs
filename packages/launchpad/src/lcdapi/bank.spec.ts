import {
  makeRandomAddress,
  nonNegativeIntegerMatcher,
  pendingWithoutWasmd,
  unused,
  wasmd,
} from "../testutils.spec";
import { BankExtension, setupBankExtension } from "./bank";
import { LcdClient } from "./lcdclient";

function makeBankClient(apiUrl: string): LcdClient & BankExtension {
  return LcdClient.withExtensions({ apiUrl }, setupBankExtension);
}

describe("BankExtension", () => {
  it("returns correct values for the unused account", async () => {
    pendingWithoutWasmd();
    const client = makeBankClient(wasmd.endpoint);
    const balances = await client.bank.balances(unused.address);
    expect(balances).toEqual({
      height: jasmine.stringMatching(nonNegativeIntegerMatcher),
      result: [
        {
          denom: "ucosm",
          amount: "1000000000",
        },
        {
          denom: "ustake",
          amount: "1000000000",
        },
      ],
    });
  });

  it("returns an empty result for a non-existent account", async () => {
    pendingWithoutWasmd();
    const client = makeBankClient(wasmd.endpoint);
    const nonExistentAddress = makeRandomAddress();
    const balances = await client.bank.balances(nonExistentAddress);
    expect(balances).toEqual({
      height: jasmine.stringMatching(nonNegativeIntegerMatcher),
      result: [],
    });
  });
});
