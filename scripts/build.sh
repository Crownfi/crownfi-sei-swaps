#!/usr/bin/env bash
set -e
projectPath=$(cd "$(dirname "${0}")" && cd ../ && pwd)

# assuming .cargo/config has the following in the [alias] map
# build-wasm = "build --release --target wasm32-unknown-unknown"
cargo build-wasm
$projectPath/scripts/build_schema.sh
$projectPath/scripts/build_optimizer.sh
$projectPath/scripts/check_artifacts_size.sh

#cd "$projectPath/scripts" && node ts-node deploy_core.ts
#cd "$projectPath/scripts" && node ts-node deploy_pools.ts
