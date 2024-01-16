#!/usr/bin/env bash

set -e
set -o pipefail

projectPath=$(cd "$(dirname "${0}")" && cd ../ && pwd)

for c in "$projectPath"/contracts/*; do
  if [ -d "$c/examples" ]; then
      echo "--> cd $c && cargo schema";
      (cd $c && cargo schema)
  fi
done

# for c in "$projectPath"/contracts/periphery/*; do
#  echo "--> cd $c && cargo schema";
#  (cd $c && cargo schema)
#done
