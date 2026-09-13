import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const [source, output, previewDir] = process.argv.slice(2);
const idsToRemove = new Set(["ITM-0133", "ITM-0134", "ITM-0135", "ITM-0136"]);

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const base = workbook.worksheets.getItem("Base de Itens");
const benchmark = workbook.worksheets.getItem("Benchmark Enxoval");
const control = workbook.worksheets.getItem("Controle");

const originalBaseRange = base.getUsedRange(true);
const originalValues = originalBaseRange.values;
const header = originalValues[0];
const dataRows = originalValues.slice(1).filter((row) => row[0]);
const foundIds = new Set(dataRows.filter((row) => idsToRemove.has(String(row[0]))).map((row) => String(row[0])));
const missingIds = [...idsToRemove].filter((id) => !foundIds.has(id));
if (missingIds.length) throw new Error(`IDs não encontrados: ${missingIds.join(", ")}`);

const filteredRows = dataRows.filter((row) => !idsToRemove.has(String(row[0])));
const finalValues = [header, ...filteredRows];
const finalBaseRows = finalValues.length;
base.getRange(`A1:K${finalBaseRows}`).values = finalValues;
if (originalValues.length > finalBaseRows) {
  base.getRange(`A${finalBaseRows + 1}:K${originalValues.length}`).clear({ applyTo: "contents" });
}

const existingTable = base.tables.items[0];
const tableName = existingTable.name;
const tableStyle = existingTable.style;
existingTable.delete();
const replacementTable = base.tables.add(`A1:K${finalBaseRows}`, true, tableName);
replacementTable.style = tableStyle;
replacementTable.showBandedColumns = false;
replacementTable.showFilterButton = true;

const benchmarkRows = benchmark.getUsedRange(true).rowCount;
const benchmarkCount = benchmarkRows - 1;
const firstControlRow = 11;
const lastControlRow = firstControlRow + benchmarkCount - 1;

control.getRange("B4").formulas = [[`=COUNTA('Base de Itens'!$A$2:$A$${finalBaseRows})`]];
control.getRange("B5").formulas = [[`=SUM('Base de Itens'!$E$2:$E$${finalBaseRows})`]];
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
  const common = `'Base de Itens'!$E$2:$E$${finalBaseRows},'Base de Itens'!$B$2:$B$${finalBaseRows},$A${controlRow},'Base de Itens'!$C$2:$C$${finalBaseRows},$B${controlRow},'Base de Itens'!$G$2:$G$${finalBaseRows},$E${controlRow}`;
  calculated.push([
    `=IF('Benchmark Enxoval'!$H${benchmarkRow}="Tipo N2",SUMIFS(${common}),SUMIFS(${common},'Base de Itens'!$D$2:$D$${finalBaseRows},$C${controlRow}))`,
    `=MAX(D${controlRow}-F${controlRow},0)`,
    `=F${controlRow}-D${controlRow}`,
    `=IF(G${controlRow}=0,"Completo",IF(F${controlRow}=0,"Falta","Parcial"))`,
    `=IF(G${controlRow}=0,"Não comprar",'Benchmark Enxoval'!$J${benchmarkRow})`,
  ]);
}
control.getRange(`A${firstControlRow}:E${lastControlRow}`).formulas = linked;
control.getRange(`F${firstControlRow}:J${lastControlRow}`).formulas = calculated;

workbook.recalculate();

console.log((await workbook.inspect({
  kind: "region",
  sheetId: "Base de Itens",
  range: `A128:K140`,
  maxChars: 10000,
})).ndjson);
console.log((await workbook.inspect({
  kind: "region",
  sheetId: "Controle",
  range: `A1:J${lastControlRow}`,
  maxChars: 20000,
})).ndjson);
console.log((await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
})).ndjson);

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(output);
for (const [sheetName, range] of [
  ["Base de Itens", "A128:K140"],
  ["Controle", `A1:J${lastControlRow}`],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.4, format: "png" });
  await fs.writeFile(`${previewDir}/${sheetName}.png`, new Uint8Array(await preview.arrayBuffer()));
}

console.log(JSON.stringify({ removed: [...idsToRemove], records: filteredRows.length, output }));
