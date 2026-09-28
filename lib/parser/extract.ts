import { Node, SyntaxKind, type ImportClause, type SourceFile } from "ts-morph";
import type { EdgeKind } from "./types.ts";

export type RawImport = {
  kind: EdgeKind;
  line: number;
  typeOnly: boolean;
} & (
  | { literal: true; specifier: string }
  // import(someVariable): seen and reported, but there is no path to resolve.
  | { literal: false; expression: string }
);

export function extractImports(sourceFile: SourceFile): RawImport[] {
  const found: RawImport[] = [];

  // Static imports and re-exports are only legal at the top level of a module.
  for (const statement of sourceFile.getStatements()) {
    if (Node.isImportDeclaration(statement)) {
      const clause = statement.getImportClause();
      found.push({
        kind: "import",
        literal: true,
        specifier: statement.getModuleSpecifierValue(),
        line: statement.getStartLineNumber(),
        typeOnly: clause ? isTypeOnlyClause(clause) : false,
      });
    } else if (Node.isExportDeclaration(statement)) {
      const specifier = statement.getModuleSpecifierValue();
      if (specifier === undefined) continue; // `export { a }` names a local, not a file
      found.push({
        kind: "re-export",
        literal: true,
        specifier,
        line: statement.getStartLineNumber(),
        typeOnly: statement.isTypeOnly() || allTypeOnly(statement.getNamedExports()),
      });
    } else if (Node.isImportEqualsDeclaration(statement)) {
      // `import x = require("y")` is TypeScript import syntax, not a require() call.
      const reference = statement.getModuleReference();
      if (Node.isExternalModuleReference(reference)) {
        const expression = reference.getExpression();
        if (expression && Node.isStringLiteral(expression)) {
          found.push({
            kind: "import",
            literal: true,
            specifier: expression.getLiteralValue(),
            line: statement.getStartLineNumber(),
            typeOnly: statement.isTypeOnly(),
          });
        }
      }
    }
  }

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getKind() !== SyntaxKind.ImportKeyword) continue;
    const [argument] = call.getArguments();
    const line = call.getStartLineNumber();
    if (argument && (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument))) {
      found.push({ kind: "dynamic-import", literal: true, specifier: argument.getLiteralValue(), line, typeOnly: false });
    } else {
      found.push({
        kind: "dynamic-import",
        literal: false,
        expression: argument ? argument.getText() : "",
        line,
        typeOnly: false,
      });
    }
  }

  return found;
}

function isTypeOnlyClause(clause: ImportClause): boolean {
  if (clause.isTypeOnly()) return true;
  // `import { type A, type B } from` erases entirely; one value binding keeps it.
  if (clause.getDefaultImport() || clause.getNamespaceImport()) return false;
  return allTypeOnly(clause.getNamedImports());
}

function allTypeOnly(specifiers: { isTypeOnly(): boolean }[]): boolean {
  return specifiers.length > 0 && specifiers.every((specifier) => specifier.isTypeOnly());
}
