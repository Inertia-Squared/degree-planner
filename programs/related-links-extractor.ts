import fs from "fs/promises";
import {ProgramData} from "./program-scraper";
import {setConfig} from "../util";

const CONFIG = {
    inputFile: './data/programs-subset-unrefined.json',
    outputFile: '../links/linked/program',
}

async function main(){
    console.log('Extracting links of related programs for searching...');

    const file = await fs.readFile(CONFIG.inputFile, {encoding: 'utf-8'});
    const data = JSON.parse(file) as ProgramData[];

    if(!data) return;

    const programSubjectLinks = JSON.stringify(Array.from(new Set(data.map((entry)=>{
        return entry.links?.subjects;
    }).filter(e=>e && e.length > 0).flat())),null, 2);

    const programMajorLinks = JSON.stringify(Array.from(new Set(data.map((entry)=>{
        return entry.links?.majors;
    }).filter(e=>e && e.length > 0).flat())),null, 2);

    const programMinorLinks = JSON.stringify(Array.from(new Set(data.map((entry)=>{
        return entry.links?.minors;
    }).filter(e=>e && e.length > 0).flat())),null, 2);

    await fs.writeFile(CONFIG.outputFile + 'Subjects.json', programSubjectLinks, {encoding: 'utf-8'});
    await fs.writeFile(CONFIG.outputFile + 'Majors.json', programMajorLinks, {encoding: 'utf-8'});
    await fs.writeFile(CONFIG.outputFile + 'Minors.json', programMinorLinks, {encoding: 'utf-8'});
}

setConfig(CONFIG.inputFile).then((r)=> {
        CONFIG.inputFile = r.inputFile;
        CONFIG.outputFile = r.outputFile;
        main().then(() => {
            console.log('Extraction complete!')
        })
    }
)
