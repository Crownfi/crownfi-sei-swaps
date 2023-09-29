#!/usr/bin/env bash
set -e

projectPath=$(cd "$(dirname "${0}")" && cd ../ && pwd)

mkdir -p $projectPath/frontend/src/ts/chain_config;

for c in $projectPath/artifacts/*.json; do
	echo "$c" 
	outputPath="$projectPath/frontend/src/ts/chain_config/$(basename "$c" ".json").ts"
	echo "export const CHAIN_CONFIG = " > "$outputPath";
	cat "$c" >> "$outputPath";
	echo ";" >> "$outputPath";
done
