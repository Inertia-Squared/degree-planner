import {
    getLinkFromSubjectCode,
    highlight,
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
    allLinksFound: [] as string[]
}


let elapsed = 0;

async function main(){
    const timer = setInterval(()=>{
        elapsed++;
    }, 1000)

    let subjectData = JSON.parse(
        await fs.readFile(`${CONFIG.workingPath}data/subjects-refined.json`, {encoding: 'utf-8'})
    ) as SubjectData[];
    state.allLinksFound = JSON.parse(
        await fs.readFile(`${CONFIG.workingPath}links/allSubjects.json`, {encoding: 'utf-8'})
    );
    await ensureDir(CONFIG.workingPath+'temp');

    let depth = 1;
    while (subjectData && subjectData.length > 0){
        highlight(`Recursive pass ${depth++}:`);
        underline('Getting next set of links to scrape and refine...')

        let prerequisiteSubjectLinks = Array.from(new Set(subjectData.map(s=>{
            if(s.prerequisites && typeof s.prerequisites !== 'string'){
                return s.prerequisites.map(p=>{
                    if (p.prerequisites) {
                        return p.prerequisites
                    }
                }).filter(p=>p!==undefined);
            }
        }).filter(p=>p!==undefined).flat(3).map(c=>getLinkFromSubjectCode(c))));

        let missingLinks = prerequisiteSubjectLinks.filter(l=>!state.allLinksFound.includes(l));
        if (!missingLinks || missingLinks.length < 1) break;
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

        // todo don't refine the subjects, extract the codes from plaintext and search them recursively
        //  - prevents hallucinations from polluting actual nodes
        //  - much more consistent
        underline('Converting prerequisites of missing subjects to machine-friendly format...')
        await runScript(
            '../subjects/subject-refiner.ts',
            [
                CONFIG.workingPath+'temp/missing-subjects-unrefined.json',
                CONFIG.workingPath+'temp/missing-subjects-refined.json'
            ]
        )

        subjectData = JSON.parse(
            await fs.readFile(`${CONFIG.workingPath}temp/missing-subjects-refined.json`, {encoding: 'utf-8'})
        ) as SubjectData[];

        underline('refining missing subjects...')
    }

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
