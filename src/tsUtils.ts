import { isValidIdentifier } from "oazapfts/generate";
import ts from "typescript";
import * as prettier from "prettier";
import * as emphasize from "emphasize";

export function createObject(
  obj: Record<string, ts.Expression>
): ts.ObjectLiteralExpression {
  const properties = Object.entries(obj).map(([key, value]) =>
    ts.factory.createPropertyAssignment(key, value)
  );

  return ts.factory.createObjectLiteralExpression(properties);
}

export async function printNode(node: ts.Node, doPretty = true) {
  const tsResultFile = ts.createSourceFile(
    "someFileName.ts",
    "",
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ false,
    ts.ScriptKind.TS
  );
  const tsPrinter = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const rawString = tsPrinter.printNode(
    ts.EmitHint.Unspecified,
    node,
    tsResultFile
  );

  const pretty = doPretty
    ? await prettier.format(rawString, {
        parser: "typescript",
      })
    : rawString;

  const emph = emphasize.createEmphasize(emphasize.common);
  console.log(emph.highlight("ts", pretty).value);
}

// TODO: attribute to rtk query codegen
// packages/rtk-query-codegen-openapi/src/generate.ts
export function accessProperty(
  rootObject: string | ts.Identifier,
  propertyName: string
) {
  const rootIdent =
    typeof rootObject === "string"
      ? ts.factory.createIdentifier(rootObject)
      : rootObject;

  return isValidIdentifier(propertyName)
    ? ts.factory.createPropertyAccessExpression(
        rootIdent,
        ts.factory.createIdentifier(propertyName)
      )
    : ts.factory.createElementAccessExpression(
        rootIdent,
        ts.factory.createStringLiteral(propertyName)
      );
}
