#!/usr/bin/env bash
set -e
projectPath=$(cd "$(dirname "${0}")" && cd ../ && pwd)
cd ../packages/cargo/crownfi-sei-swaps-sdk-maker
cargo run
