#!/bin/dash

set -e
solcjs --abi --bin --optimize main.sol -o out
