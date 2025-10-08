/**
 * Requires a manually provided list of links to programs, the rest is automated
 */
import {highlight, startTrackingProgress, stopTrackingProgress, underline} from "../util";

let childProcess = require('child_process');
import fs from "fs/promises";

const pt = startTrackingProgress(0,10);
let elapsed = 0;

async function main(){
    const timer = setInterval(()=>{
        elapsed++;
    }, 1000)

    console.time('create-dir')
    pt.loggingFunction = highlight;
    underline('Creating Necessary Directories...')
    await ensureDir('./data');
    await ensureDir('./links');
    pt.progress++;
    console.timeEnd('create-dir')

    console.time('program-scraping')
    underline('Extracting Program Data:')
    await runScript('../programs/program-scraper.ts', ['../links/programs-subset-smaller.json', './data/programs-unrefined.json']); // links must be provided manually, can be provided as a subset of links gathered from link collector
    await runScript('../programs/related-links-extractor.ts', ['./data/programs-unrefined.json', './links/subsetProgram']);
    pt.progress++;
    console.timeEnd('program-scraping')
    //
    // console.time('specialisation-scraping')
    // underline('Extracting Majors/Minors:')
    // await runScript('../majors-minors/major-minor-scraper.ts', ['./links/subsetProgramMajors.json', './data/programMajorData.json']);
    // await runScript('../majors-minors/subject-links-extractor.ts', ['./data/programMajorData.json', './links/majorSubjectsLinks.json']);
    // pt.progress++;
    // await runScript('../majors-minors/major-minor-scraper.ts', ['./links/subsetProgramMinors.json', './data/programMinorData.json']);
    // await runScript('../majors-minors/subject-links-extractor.ts', ['./data/programMinorData.json', './links/minorSubjectsLinks.json']);
    // pt.progress++;
    // console.timeEnd('specialisation-scraping')
    //
    // console.time('subject-combining')
    // underline('Combining Subjects Found...')
    // const programSubjects = JSON.parse(await fs.readFile('./links/subsetProgramSubjects.json', {encoding: 'utf-8'}));
    // const majorSubjects = JSON.parse(await fs.readFile('./links/majorSubjectsLinks.json', {encoding: 'utf-8'}));
    // const minorSubjects = JSON.parse(await fs.readFile('./links/minorSubjectsLinks.json', {encoding: 'utf-8'}));
    //
    // const combinedSubjects = Array.from(new Set([...programSubjects,...majorSubjects,...minorSubjects].flat()));
    // await fs.writeFile('./links/allSubjects.json', JSON.stringify(combinedSubjects, null, 2));
    // pt.progress++;
    // console.timeEnd('subject-combining')

    // console.time('subject-scraping')
    // underline('Scraping Subject Data:')
    // await runScript('../subjects/subject-scraper.ts',['./links/allSubjects.json', './data/subjects-unrefined.json']);
    // pt.progress++;
    // console.timeEnd('subject-scraping')
    //
    // console.time('subject-find')
    // underline('Recursively scraping subjects from prerequisites...')
    // await runScript('scrape-missing-subjects.ts', ['./'])
    // pt.progress++;
    // console.timeEnd('subject-find')
    //
    // console.time('subject-refine')
    // underline('Converting prerequisites into machine-friendly logic, this may take a while...')
    // await runScript('../subjects/subject-refiner.ts', ['./data/subjects-unrefined.json','./data/subjects-refined.json']);
    // pt.progress++;
    // console.timeEnd('subject-refine')

    console.time('program-refine')
    underline('Postprocessing Programs Dataset:')
    await runScript('../programs/program-refiner.ts', ['./data/', './data/programs-refined.json']);
    pt.progress++;
    console.timeEnd('program-refine')

    console.time('upload-db')
    underline('Uploading data to db...')
    await runScript('../neo4j/upload-data-to-db.ts',['./data/']);
    pt.progress++;
    console.timeEnd('upload-db')

    stopTrackingProgress(pt);
    timer.close();
}
main().then(()=>{
    console.log('Automated Script Complete!\n'+elapsed + ' Seconds elapsed.');
    process.exit(0);
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


