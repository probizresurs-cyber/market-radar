import { fetchRussiaAreas } from "./hh.mjs";
const russia = await fetchRussiaAreas();
const names = (russia.areas || []).map((s) => `${s.id}: ${s.name}`);
console.log(`Субъектов РФ в дереве: ${names.length}\n`);
console.log(names.join("\n"));
