#!/bin/bash

# Function to remove test files from a commit
remove_test_files() {
    # Remove any test/debug files if they exist
    git rm -f test-pr2.js 2>/dev/null
    git rm -f debug-exec.js 2>/dev/null
    git rm -f test-classification-debug.ts 2>/dev/null
    git rm -f test-real-error.js 2>/dev/null
    git rm -f .test-ai-features.md.un~ 2>/dev/null
    git rm -f test-*.js test-*.ts debug-*.js 2>/dev/null
    
    # Check if there are any changes to commit
    if git diff --cached --quiet; then
        echo "No test files to remove"
        return 1
    else
        echo "Removed test/debug files"
        return 0
    fi
}

# Export the function so it can be used in git filter-branch
export -f remove_test_files

echo "Cleanup script ready"