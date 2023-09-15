#!/usr/bin/env bash

set -e
set -o pipefail

projectPath=$(cd "$(dirname "${0}")" && cd ../ && pwd)

docker run --rm \
  --mount "type=bind,src=$projectPath,dst=/code" \
  --mount type=tmpfs,dst=/code/target \
  --mount type=tmpfs,dst=/usr/local/cargo/registry \
  --entrypoint "/code/scripts/optimizer_workarounds/entrypoint.sh"\
  cosmwasm/workspace-optimizer:0.14.0 \
  "$(id -u):$(id -g)"
