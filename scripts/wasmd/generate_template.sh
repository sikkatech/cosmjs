#!/bin/bash
set -o errexit -o nounset -o pipefail
command -v shellcheck > /dev/null && shellcheck "$0"

SCRIPT_DIR="$(realpath "$(dirname "$0")")"
# shellcheck source=./env
# shellcheck disable=SC1091
source "$SCRIPT_DIR"/env

rm -rf "$SCRIPT_DIR/template"
mkdir "$SCRIPT_DIR/template"

# The usage of the accounts below is documented in README.md of this directory
docker run --rm \
  -e PASSWORD=my-secret-password \
  --mount type=bind,source="$SCRIPT_DIR/template",target=/root \
  "$REPOSITORY:$VERSION" \
  ./setup_wasmd.sh \
  cosmos1pkptre7fdkl6gfrzlesjjvhxhlc3r4gmmk8rs6 cosmos10dyr9899g6t0pelew4nvf4j5c3jcgv0r73qga5 cosmos1xy4yqngt0nlkdcenxymg8tenrghmek4nmqm28k cosmos142u9fgcjdlycfcez3lw8x6x5h7rfjlnfhpw2lx cosmos1hsm76p4ahyhl5yh3ve9ur49r5kemhp2r0dcjvx \
  cosmos14qemq0vw6y3gc3u3e0aty2e764u4gs5le3hada cosmos1hhg2rlu9jscacku2wwckws7932qqqu8x3gfgw0 cosmos1xv9tklw7d82sezh9haa573wufgy59vmwe6xxe5 cosmos17yg9mssjenmc3jkqth6ulcwj9cxujrxxzezwta cosmos1f7j7ryulwjfe9ljplvhtcaxa6wqgula3etktce \
  cosmos1lvrwcvrqlc5ktzp2c4t22xgkx29q3y83lktgzl cosmos1vkv9sfwaak76weyamqx0flmng2vuquxqcuqukh cosmos106jwym4s9aujcmes26myzzwqsccw09sdm0v5au cosmos1c7wpeen2uv8thayf7g8q2rgpm29clj0dgrdtzw cosmos1mjxpv9ft30wer7ma7kwfxhm42l379xutplrdk6 \
  cosmos1cjsxept9rkggzxztslae9ndgpdyt2408lk850u \
  cosmos17d0jcz59jf68g52vq38tuuncmwwjk42u6mcxej

# The ./template folder is created by the docker daemon's user (root on Linux, current user
# when using Docker Desktop on macOS), let's make it ours if needed
if [ ! -x "$SCRIPT_DIR/template/.wasmd/config/gentx" ]; then
  sudo chown -R "$(id -u):$(id -g)" "$SCRIPT_DIR/template"
fi

function inline_jq() {
  IN_OUT_PATH="$1"
  shift
  TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/inline_jq.XXXXXXXXX")
  TMP_FILE="$TMP_DIR/$(basename "$IN_OUT_PATH")"
  jq "$@" < "$IN_OUT_PATH" > "$TMP_FILE"
  if ! mv "$TMP_FILE" "$IN_OUT_PATH" ; then
    >&2 echo "Temp file '$TMP_FILE' could not be deleted. If it contains sensitive data, you might want to delete it manually."
    exit 3
  fi
}

inline_jq "$SCRIPT_DIR/template/.wasmd/config/genesis.json" -S
