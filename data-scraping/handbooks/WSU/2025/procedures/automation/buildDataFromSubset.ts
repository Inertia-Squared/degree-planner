/**
 * Requires a manually provided list of links to programs, the rest is automated
 *
 * Lots of changes were made to this and related files during the API refactor.
 * Because I don't have infinite time, these changes are untested, but should be pretty close to functional.
 */
import {highlight, startTrackingProgress, stopTrackingProgress, underline} from "@/api/util";

let childProcess = require('child_process');
import fs from "fs/promises";
import {dataDir, linksDir} from "@/api/directories";

const pt = startTrackingProgress(0,10);
let elapsed = 0;

const CONFIG = {
    programLinksFile: 'links/programs-subset-smaller.json',
    dataDir: '../../data',
    linksDir: '../../data/links',
}

/**
 * Main function to orchestrate the data scraping and processing pipeline.
 */
async function main(){
    const timer = setInterval(()=>{
        elapsed++;
    }, 1000)

    console.time('create-dir')
    pt.loggingFunction = highlight;
    underline('Creating Necessary Directories...')
    await ensureDir(dataDir);
    await ensureDir(linksDir);
    pt.progress++;
    console.timeEnd('create-dir')

    console.time('program-scraping')
    underline('Extracting Program Data:')
    await runScript('programs/program-scraper.ts', [CONFIG.programLinksFile, `${dataDir}/programs-unrefined.json`]); // links must be provided manually, can be provided as a subset of links gathered from link collector
    await runScript('programs/related-links-extractor.ts', [`${dataDir}/programs-unrefined.json`, `${linksDir}/subsetProgram`]);
    pt.progress++;
    console.timeEnd('program-scraping')

    console.time('specialisation-scraping')
    underline('Extracting Majors/Minors:')
    await runScript('majors-minors/major-minor-scraper.ts', [`${linksDir}/subsetProgramMajors.json`, `${dataDir}/programMajorData.json`]);
    await runScript('majors-minors/subject-links-extractor.ts', [`${dataDir}/programMajorData.json`, `${linksDir}/majorSubjectsLinks.json`]);
    pt.progress++;
    await runScript('majors-minors/major-minor-scraper.ts', [`${linksDir}/subsetProgramMinors.json`, `${dataDir}/programMinorData.json`]);
    await runScript('majors-minors/subject-links-extractor.ts', [`${dataDir}/programMinorData.json`, `${linksDir}/minorSubjectsLinks.json`]);
    pt.progress++;
    console.timeEnd('specialisation-scraping')

    console.time('subject-combining')
    underline('Combining Subjects Found...')
    const programSubjects = JSON.parse(await fs.readFile(`${linksDir}/subsetProgramSubjects.json`, {encoding: 'utf-8'}));
    const majorSubjects = JSON.parse(await fs.readFile(`${linksDir}/majorSubjectsLinks.json`, {encoding: 'utf-8'}));
    const minorSubjects = JSON.parse(await fs.readFile(`${linksDir}/minorSubjectsLinks.json`, {encoding: 'utf-8'}));

    const combinedSubjects = Array.from(new Set([...programSubjects,...majorSubjects,...minorSubjects].flat()));
    await fs.writeFile(`${linksDir}/allSubjects.json`, JSON.stringify(combinedSubjects, null, 2));
    pt.progress++;
    console.timeEnd('subject-combining')

    console.time('subject-scraping')
    underline('Scraping Subject Data:')
    await runScript('subjects/subject-scraper.ts',[`${linksDir}/allSubjects.json`, `${dataDir}/subjects-unrefined.json`]);
    pt.progress++;
    console.timeEnd('subject-scraping')

    console.time('subject-find')
    underline('Recursively scraping subjects from prerequisites...')
    await runScript('scrape-missing-subjects.ts', [`${dataDir}/`])
    pt.progress++;
    console.timeEnd('subject-find')

    console.time('subject-refine')
    underline('Converting prerequisites into machine-friendly logic, this may take a while...')
    await runScript('subjects/subject-refiner.ts', [`${dataDir}/subjects-unrefined.json`,`${dataDir}/subjects-refined.json`]);
    pt.progress++;
    console.timeEnd('subject-refine')

    console.time('program-refine')
    underline('Postprocessing Programs Dataset:')
    await runScript('programs/program-refiner.ts', [`${dataDir}/`, `${dataDir}/programs-refined.json`]);
    pt.progress++;
    console.timeEnd('program-refine')

    console.time('upload-db')
    underline('Uploading data to db...')
    await runScript('neo4j/upload-data-to-db.ts',[`${dataDir}/`]);
    pt.progress++;
    console.timeEnd('upload-db')

    stopTrackingProgress(pt);
    timer.close();
}
main().then(()=>{
    console.log('Automated Script Complete!\n'+elapsed + ' Seconds elapsed.');
    process.exit(0);
})

/**
 * Ensures that a directory exists, creating it if it doesn't.
 * @param dir The path of the directory to ensure exists.
 */
async function ensureDir(dir: string){
    try{
        await fs.mkdir(dir);
    } catch (e) {}
}

/**
 * Runs a script in a child process.
 * @param scriptPath The path to the script to run.
 * @param args An array of arguments to pass to the script.
 * @returns A promise that resolves when the script exits.
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


