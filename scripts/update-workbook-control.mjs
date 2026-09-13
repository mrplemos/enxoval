import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const [source, output, previewPath] = process.argv.slice(2);
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const base = workbook.worksheets.getItem("Base de Itens");
const benchmark = workbook.worksheets.getItem("Benchmark Enxoval");
const control = workbook.worksheets.getItem("Controle");

const baseRows = base.getUsedRange(true).rowCount;
const benchmarkRows = benchmark.getUsedRange(true).rowCount;
const benchmarkCount = benchmarkRows - 1;
const firstControlRow = 11;
const lastControlRow = firstControlRow + benchmarkCount - 1;

const itemIdRange = base.getRange(`A2:A${baseRows}`);
const itemIds = itemIdRange.values.map(([value]) => String(value ?? ""));
const usedIds = new Set(itemIds.filter(Boolean));
let nextItemNumber = Math.max(0, ...itemIds.map((id) => Number(id.match(/^ITM-(\d+)$/)?.[1] ?? 0))) + 1;
for (let index = 0; index < itemIds.length; index += 1) {
  if (itemIds[index]) continue;
  let candidate;
  do {
    candidate = `ITM-${String(nextItemNumber).padStart(4, "0")}`;
    nextItemNumber += 1;
  } while (usedIds.has(candidate));
  itemIds[index] = candidate;
  usedIds.add(candidate);
}
itemIdRange.values = itemIds.map((id) => [id]);

control.getRange("B4").formulas = [[`=COUNTA('Base de Itens'!$A$2:$A$${baseRows})`]];
control.getRange("B5").formulas = [[`=SUM('Base de Itens'!$E$2:$E$${baseRows})`]];
control.getRange("B6").formulas = [[`=COUNTIF($J$${firstControlRow}:$J$${lastControlRow},"Comprar agora")`]];
control.getRange("B7").formulas = [[`=COUNTIF($I$${firstControlRow}:$I$${lastControlRow},"Completo")`]];

const phases = ["RN", "1–3 meses", "3–6 meses", "6–9 meses", "9–12 meses", "Sem fase"];
control.getRange("D4:D9").values = phases.map((phase) => [phase]);
control.getRange("E4:E9").formulas = phases.map((_, index) => [
  `=COUNTIFS($E$${firstControlRow}:$E$${lastControlRow},D${index + 4},$G$${firstControlRow}:$G$${lastControlRow},">0")`,
]);

const linked = [];
const calculated = [];
for (let index = 0; index < benchmarkCount; index += 1) {
  const benchmarkRow = index + 2;
  const controlRow = index + firstControlRow;
  linked.push([
    `='Benchmark Enxoval'!B${benchmarkRow}`,
    `='Benchmark Enxoval'!C${benchmarkRow}`,
    `='Benchmark Enxoval'!D${benchmarkRow}`,
    `='Benchmark Enxoval'!F${benchmarkRow}`,
    `='Benchmark Enxoval'!E${benchmarkRow}`,
  ]);
  const common = `'Base de Itens'!$E$2:$E$${baseRows},'Base de Itens'!$B$2:$B$${baseRows},$A${controlRow},'Base de Itens'!$C$2:$C$${baseRows},$B${controlRow},'Base de Itens'!$G$2:$G$${baseRows},$E${controlRow}`;
  calculated.push([
    `=IF('Benchmark Enxoval'!$H${benchmarkRow}="Tipo N2",SUMIFS(${common}),SUMIFS(${common},'Base de Itens'!$D$2:$D$${baseRows},$C${controlRow}))`,
    `=MAX(D${controlRow}-F${controlRow},0)`,
    `=F${controlRow}-D${controlRow}`,
    `=IF(G${controlRow}=0,"Completo",IF(F${controlRow}=0,"Falta","Parcial"))`,
    `=IF(G${controlRow}=0,"Não comprar",'Benchmark Enxoval'!$J${benchmarkRow})`,
  ]);
}
control.getRange(`A${firstControlRow}:E${lastControlRow}`).formulas = linked;
control.getRange(`F${firstControlRow}:J${lastControlRow}`).formulas = calculated;

control.showGridLines = false;
control.freezePanes.freezeRows(10);
control.getRange(`D4:E9`).format.verticalAlignment = "center";
control.getRange(`B4:B7`).format.numberFormat = "#,##0";
control.getRange(`D${firstControlRow}:H${lastControlRow}`).format.numberFormat = "#,##0";
workbook.recalculate();

console.log((await workbook.inspect({
  kind: "table",
  range: `Controle!A1:J${lastControlRow}`,
  include: "values,formulas",
  tableMaxRows: 60,
  tableMaxCols: 10,
  maxChars: 20000,
})).ndjson);
console.log((await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
})).ndjson);

await fs.mkdir(path.dirname(output), { recursive: true });
const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(output);
const preview = await workbook.render({ sheetName: "Controle", range: `A1:J${lastControlRow}`, scale: 1.4, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
