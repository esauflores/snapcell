#!/usr/bin/env python3
"""Extract all import statements from Python source using AST. Handles multi-line imports."""

import ast
import sys
import json


def extract_imports(source: str) -> str:
    tree = ast.parse(source)
    imports: list[str] = []
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            imports.append(ast.unparse(node))
    return '\n'.join(imports)


if __name__ == '__main__':
    source = sys.stdin.read()
    result = extract_imports(source)
    json.dump({'imports': result}, sys.stdout)
