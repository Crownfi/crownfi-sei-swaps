#!/bin/sh
set -e
echo "optimizer_workarounds active: arg1=$1";
optimize_workspace.sh .
chown -R "$1" /code/artifacts
