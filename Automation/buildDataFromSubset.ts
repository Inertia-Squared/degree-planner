/**
 * Requires a manually provided list of links to programs, the rest is automated
 */
import {highlight, startTrackingProgress, stopTrackingProgress, underline} from "../util";

let childProcess = require('child_process');
import fs from "fs/promises";

const pt = startTrackingProgress(0,13);
let elapsed = 0;

async function main(){
    const timer = setInterval(()=>{
        elapsed++;
    }, 1000)

    pt.loggingFunction = highlight;
    underline('Creating Necessary Directories...')
    await ensureDir('./data');
    pt.progress++;
    await ensureDir('./links');
    pt.progress++;

    underline('Extracting Program Data:')
    await runScript('../programs/program-scraper.ts', ['../links/programs-subset.json', './data/programs-subset-unrefined.json']); // links must be provided manually, can be provided as a subset of links gathered from link collector
    pt.progress++;
    await runScript('../programs/related-links-extractor.ts', ['./data/programs-subset-unrefined.json', './links/subsetProgram']);
    pt.progress++;

    underline('Extracting Majors/Minors:')
    await runScript('../majors-minors/major-minor-scraper.ts', ['./links/subsetProgramMajors.json', './data/programMajorData.json']);
    pt.progress++;
    await runScript('../majors-minors/subject-links-extractor.ts', ['./data/programMajorData.json', './links/majorSubjectsLinks.json']);
    pt.progress++;
    await runScript('../majors-minors/major-minor-scraper.ts', ['./links/subsetProgramMinors.json', './data/programMinorData.json']);
    pt.progress++;
    await runScript('../majors-minors/subject-links-extractor.ts', ['./data/programMinorData.json', './links/minorSubjectsLinks.json']);
    pt.progress++;

    underline('Combining Subjects Found:')
    const programSubjects = JSON.parse(await fs.readFile('./links/subsetProgramSubjects.json', {encoding: 'utf-8'}));
    pt.progress++;
    const majorSubjects = JSON.parse(await fs.readFile('./links/majorSubjectsLinks.json', {encoding: 'utf-8'}));
    pt.progress++;
    const minorSubjects = JSON.parse(await fs.readFile('./links/minorSubjectsLinks.json', {encoding: 'utf-8'}));
    pt.progress++;

    const combinedSubjects = Array.from(new Set([...programSubjects,...majorSubjects,...minorSubjects].flat()));
    await fs.writeFile('./links/allSubjectsInSubset.json', JSON.stringify(combinedSubjects, null, 2));
    pt.progress++;

    underline('Postprocessing Programs Dataset')
    await runScript('../programs/program-refiner.ts', ['./data/programs-subset-unrefined.json', './data/programs-subset-refined.json']);
    pt.progress++;

    stopTrackingProgress(pt);
}
main().then(()=>{
    console.log('Automated Script Complete!\n'+elapsed + ' Seconds elapsed.');
})

async function ensureDir(dir: string){
    try{
        await fs.mkdir(dir);
    } catch (e) {}
}

/**
 * Stuff to run the scripts
 */

function runScript(scriptPath: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject)=>{
        let process = childProcess.fork(scriptPath, args, {silent: true});

        process.on('error',
            (err: any)=> {
                console.log(err)
                reject("There was an error when running " + scriptPath)
            }
        );

        process.stdout.on('data', (data: Buffer)=>{    // remove extra newline
            console.log('\t>'+data.toString('utf-8').slice(0,data.toString().length-1));
        })

        process.on('exit', ()=> {
            resolve()
        });
    })
}


