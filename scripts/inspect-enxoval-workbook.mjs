import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const source = process.argv[2];
const output = process.argv[3];
await fs.mkdir(output, { recursive: true });
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
console.log((await workbook.inspect({ kind: "workbook,sheet,table", maxChars: 8000, tableMaxRows: 5, tableMaxCols: 12 })).ndjson);
for (const sheetName of ["Base de Itens", "Benchmark Enxoval", "Controle"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${output}/${sheetName}.png`, new Uint8Array(await preview.arrayBuffer()));
}
