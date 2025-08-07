import fs from "fs/promises";
import {setConfig} from "../util";
import {MajorMinorData} from "./major-minor-scraper";

const CONFIG = {
    inputFile: '../Automation/data/programMajorData.json',
    outputFile: '../links/linked/program/extracted-subject-links.json',
}

async function main(){
    console.log('Extracting links of related subjects...');

    const file = await fs.readFile(CONFIG.inputFile, {encoding: 'utf-8'});
    const data = JSON.parse(file) as MajorMinorData[];

    if(!data) return;

    // This is a cursed abomination, but it works and I never want to touch it again
    const flattenedData = Array.from(new Set(data.map((d)=>Object.entries(d.sequences).flat(3).filter(t=>t.match(/^[A-z]{4} \d{4}$/))).flat().map(link=>{
        return "https://hbook.westernsydney.edu.au/subject-details/" + link.replace(' ', '').toLowerCase();
    })));

    await fs.writeFile(CONFIG.outputFile, JSON.stringify(flattenedData, null, 2), {encoding: 'utf-8'});
}

setConfig(CONFIG.inputFile).then((r)=> {
        CONFIG.inputFile = r.inputFile;
        CONFIG.outputFile = r.outputFile;
        main().then(() => {
            console.log('Extraction complete!')
        })
    }
)
