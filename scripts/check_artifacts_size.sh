#!/usr/bin/env bash

set -e
set -o pipefail
projectPath=$(cd "$(dirname "${0}")" && cd ../ && pwd)
cd "$projectPath";

# as defined in https://github.com/sei-protocol/sei-wasmd/blob/f6a5c6e58875583193d3ace305e6ab635e486487/x/wasm/types/validation.go#L12
maximum_size=800

for artifact in artifacts/*.wasm; do
  artifactsize=$(du -k "$artifact" | cut -f 1)
  if [ "$artifactsize" -gt $maximum_size ]; then
    echo "Artifact file size exceeded: $artifact"
    echo "Artifact size: ${artifactsize}KiB"
    echo "Max size: ${maximum_size}KiB"
    exit 1
  fi
done
echo "No .wasm artifacts exceed ${maximum_size}KiB"
