import {
    getLinkFromSubjectCode,
    highlight, regexMacros,
    underline
} from "@/api/util";

let childProcess = require('child_process');
import fs from "fs/promises";
import {SubjectData} from "../extract/subjects/subject-scraper";
import {dataDir, linksDir, proceduresDir} from "@/api/directories";

const state = {
    allLinksFound: [] as string[],
    newLinksFound: [] as string[],
    allSubjectData: [] as SubjectData[]
}


let elapsed = 0;

/**
 * Main function to recursively scrape for missing subjects based on prerequisites.
 */
async function main(){
    const timer = setInterval(()=>{
        elapsed++;
    }, 1000)

    let subjectData = JSON.parse(
        await fs.readFile(`${dataDir}/subjects-unrefined.json`, {encoding: 'utf-8'})
    ) as SubjectData[];
    state.allLinksFound = JSON.parse(
        await fs.readFile(`${linksDir}/allSubjects.json`, {encoding: 'utf-8'})
    );
    await ensureDir(`${dataDir}/temp`);

    let depth = 1;
    while (subjectData && subjectData.length > 0){
        state.allSubjectData.push(...subjectData);
        highlight(`Recursive pass ${depth++}:`);
        underline('Getting next set of links to scrape...');

        let prerequisiteSubjectLinks: string[] = Array.from(new Set(subjectData.map(s=>{
            if (typeof s.originalPrerequisites === 'string') {
                const matches = s.originalPrerequisites.match(regexMacros.aggressiveSubjectCode);
                if(!matches) return;
                return matches?.map(m=>m);
            }
        }).flat().filter(f=>f!==undefined))).map(l=>getLinkFromSubjectCode(l))

        let missingLinks = prerequisiteSubjectLinks.filter(l=>!state.allLinksFound.includes(l));
        console.log(`Found ${missingLinks.length} new subjects this pass`);
        if (!missingLinks || missingLinks.length < 1) break;
        state.newLinksFound.push(...missingLinks);
        state.allLinksFound.push(...missingLinks);
        await fs.writeFile(
            `${dataDir}/temp/missing-links.json`,
            JSON.stringify(missingLinks,null,2),
            {encoding: 'utf-8'}
        );
        underline(`scraping ${missingLinks.length} missing subjects...`)
        await runScript(
            `${proceduresDir}/extract/subjects/subject-scraper.ts`,
            [
                `${dataDir}/temp/missing-links.json`,
                `${dataDir}/temp/missing-subjects-unrefined.json`
            ]
        )

        subjectData = JSON.parse(
            await fs.readFile(`${dataDir}/temp/missing-subjects-unrefined.json`, {encoding: 'utf-8'})
        ) as SubjectData[];
    }
    console.log('Recursion complete!')
    underline('Updating unrefined subject data...')
    await fs.writeFile(`${dataDir}/subjects-unrefined.json`,
        JSON.stringify(state.allSubjectData,null,2), {encoding: 'utf-8'});
    timer.close();
}

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
