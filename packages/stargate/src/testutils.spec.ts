export function pendingWithoutSimapp(): void {
  if (!process.env.SIMAPP_ENABLED) {
    return pending("Set SIMAPP_ENABLED to enable Simapp based tests");
  }
}

export const simapp = {
  tendermintUrl: "localhost:26657",
  chainId: "simd-testing",
  denomStaking: "ustake",
  denomFee: "ucosm",
};

/** Unused account */
export const unused = {
  pubkey: {
    type: "tendermint/PubKeySecp256k1",
    value: "ArkCaFUJ/IH+vKBmNRCdUVl3mCAhbopk9jjW4Ko4OfRQ",
  },
  address: "cosmos1cjsxept9rkggzxztslae9ndgpdyt2408lk850u",
  accountNumber: 16,
  sequence: 0,
  balanceStaking: "10000000", // 10 STAKE
  balanceFee: "1000000000", // 1000 COSM
};

export const validator = {
  /** From first gentx's auth_info.signer_infos in scripts/simapp/template/.simapp/config/genesis.json */
  pubkey: {
    type: "tendermint/PubKeySecp256k1",
    value: "AnFadRAdh6Fl7robHe8jywDMKSWQQjB7SlpoqGsX9Ghw",
  },
  /** delegator_address from /cosmos.staking.MsgCreateValidator in scripts/simapp/template/.simapp/config/genesis.json */
  address: "cosmos12gm9sa666hywxu9nzzmp7hyl7a55hvg769w2kz",
  accountNumber: 0,
  sequence: 1,
};

export const nonExistentAddress = "cosmos1p79apjaufyphcmsn4g07cynqf0wyjuezqu84hd";
