#!/usr/bin/env bash
# Deploy the Sable P0 stack to the local Anvil node (or any chain via env).
# Prereq: anvil running on 127.0.0.1:8545 (npm run chain).
set -euo pipefail
cd "$(dirname "$0")/../contracts"
export PATH="$PATH:$HOME/.foundry/bin"
forge script script/Deploy.s.sol \
  --rpc-url "${SABLE_RPC_URL:-http://127.0.0.1:8545}" \
  --broadcast
