import {
    getLinkFromSubjectCode,
    highlight, regexMacros,
    setConfig,
    underline
} from "../util";

let childProcess = require('child_process');
import fs from "fs/promises";
import {SubjectData} from "../subjects/subject-scraper";


const CONFIG = {
    workingPath: './',
}

const state = {
    allLinksFound: [] as string[],
    newLinksFound: [] as string[],
    allSubjectData: [] as SubjectData[]
}


let elapsed = 0;

async function main(){
    const timer = setInterval(()=>{
        elapsed++;
    }, 1000)

    let subjectData = JSON.parse(
        await fs.readFile(`${CONFIG.workingPath}data/subjects-unrefined.json`, {encoding: 'utf-8'})
    ) as SubjectData[];
    state.allLinksFound = JSON.parse(
        await fs.readFile(`${CONFIG.workingPath}links/allSubjects.json`, {encoding: 'utf-8'})
    );
    await ensureDir(CONFIG.workingPath+'temp');

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
            CONFIG.workingPath+'temp/missing-links.json',
            JSON.stringify(missingLinks,null,2),
            {encoding: 'utf-8'}
        );
        underline(`scraping ${missingLinks.length} missing subjects...`)
        await runScript(
            '../subjects/subject-scraper.ts',
            [
                CONFIG.workingPath+'temp/missing-links.json',
                CONFIG.workingPath+'temp/missing-subjects-unrefined.json'
            ]
        )

        subjectData = JSON.parse(
            await fs.readFile(`${CONFIG.workingPath}temp/missing-subjects-unrefined.json`, {encoding: 'utf-8'})
        ) as SubjectData[];
    }
    console.log('Recursion complete!')
    underline('Updating unrefined subject data...')
    await fs.writeFile(`${CONFIG.workingPath}data/subjects-unrefined.json`,
        JSON.stringify(state.allSubjectData,null,2), {encoding: 'utf-8'});
    timer.close();
}

setConfig(CONFIG.workingPath).then((r)=> {
    CONFIG.workingPath = r.inputFile;
    main().then(() => {
        console.log('Recursive scraping complete!');
        process.exit();
    })
});

async function ensureDir(dir: string){
    try{
        await fs.mkdir(dir);
    } catch (e) {}
}

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
