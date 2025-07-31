/**
 * Requires a manually provided list of links to programs, the rest is automated
 */
let childProcess = require('child_process');
import fs from "fs/promises";

async function main(){
    await ensureDir('./data');
    await ensureDir('./links')

    await runScript('../programs/program-scraper.ts', ['../links/programs-subset.json', './data/programs-subset-unrefined.json']); // links must be provided manually, can be provided as a subset of links gathered from link collector
    await runScript('../programs/related-links-extractor.ts', ['../programs/data/programs-subset-unrefined.json', './links/subsetProgram']);

    await runScript('../majors-minors/major-minor-scraper.ts', ['./links/subsetProgramMajors.json', './data/programMajorData.json']);
    await runScript('../majors-minors/major-minor-scraper.ts', ['./links/subsetProgramMinors.json', './data/programMinorData.json']);


}
main().then(()=>{
    console.log('Automation Script Complete!')
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
            console.log(data.toString('utf-8').slice(0,data.toString().length-1));
        })

        process.on('exit', ()=> {
            resolve()
        });
    })
}


