#!/bin/bash
# Script to run tests with increased file descriptor limits
# This helps avoid ENFILE errors on macOS

# Check current limit
CURRENT_LIMIT=$(ulimit -n)
echo "Current file descriptor limit: $CURRENT_LIMIT"

# Set a higher limit if current is too low
if [ "$CURRENT_LIMIT" -lt 4096 ]; then
  echo "Increasing file descriptor limit to 4096..."
  ulimit -n 4096
  NEW_LIMIT=$(ulimit -n)
  echo "New limit: $NEW_LIMIT"
fi

# Run the tests with all passed arguments
exec pnpm test "$@"





