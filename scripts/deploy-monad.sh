#!/usr/bin/env bash
# Deploy the Sable P0 stack to Monad testnet.
# Prereq: contracts/.env has DEPLOYER_PRIVATE_KEY; wallet funded with testnet MON.
set -euo pipefail
cd "$(dirname "$0")/../contracts"
export PATH="$PATH:$HOME/.foundry/bin"

# load .env if present
if [ -f .env ]; then set -a; . ./.env; set +a; fi

RPC="${SABLE_RPC_URL:-https://testnet-rpc.monad.xyz}"
echo "→ deploying to $RPC (chain expects 10143)"

if [ -z "${DEPLOYER_PRIVATE_KEY:-}" ]; then
  echo "DEPLOYER_PRIVATE_KEY missing" >&2
  exit 1
fi

forge script script/Deploy.s.sol \
  --rpc-url "$RPC" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  -vv

echo "→ deployments/$(cast chain-id --rpc-url "$RPC").json written"
