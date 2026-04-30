#!/bin/bash
# Replaces http:// with https:// in all source and env files
# Usage: ./replace-http.sh [target-dir]

TARGET="${1:-.}"

find "$TARGET" \
  -type f \
  \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name ".env*" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" | while read -r file; do
    if grep -q "http://" "$file"; then
      sed -i '' 's|http://|https://|g' "$file"
      echo "Fixed: $file"
    fi
  done

echo "Done."
