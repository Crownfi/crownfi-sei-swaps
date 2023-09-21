#!/usr/bin/env bash
set -e

projectPath=$(cd "$(dirname "${0}")" && cd ../ && pwd)

mkdir -p $projectPath/frontend/src/ts/chain_config;

# TODO: Do for other chain artifacts
echo "export const CHAIN_CONFIG = " > "$projectPath/frontend/src/ts/chain_config/localsei.ts";
cat "$projectPath/artifacts/localsei.json" >> "$projectPath/frontend/src/ts/chain_config/localsei.ts";
echo ";" >> "$projectPath/frontend/src/ts/chain_config/localsei.ts";
