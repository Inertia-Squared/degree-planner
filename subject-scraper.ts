import playwright, {Browser} from "playwright";
import fs from "fs/promises";
import {LLM, LMStudioClient} from "@lmstudio/sdk";
import { z } from "zod";
import {clearTimeout} from "node:timers";

const CONFIG = {
    subjectFile: './links/subject-details.json',
    useHardwareAcceleration: true,
    modelName: 'gemma-3-12b-it-GGUF',
    desiredTerms: ['Credit Points','Coordinator','Description','School','Discipline','Pre-requisite(s)'],
    concurrentPages: 10,

    systemPrompt: 'You are an AI that takes the requirements for a subject in plaintext and converts the data into a rigid format. In cases where the order of AND/OR is ambiguous, treat treat the AND as a separator and the OR as a comma in a list, unless brackets or other instructions indicate otherwise. If there is no course specified for a set of prerequisites, use \'any\'.',
}

interface enrollRequirements {
    enrollmentProgram: string;
    prerequisiteSubjectCodes?: string[];
}

const requirementSchema = z.object({
    studyProgram: z.string(),
    requirements: z.object({
        preRequisiteCombinations: z.string().array().array()
    })
})

interface SubjectData {
    subject?: string;
    creditPoints?: number;
    coordinator?: string;
    description?: string;
    school?: string;
    discipline?: string;
    prerequisites?: string | enrollRequirements[]; // captures requirements that vary based on enrolled course, to be eligible user must have completed at least one subject of every enrollRequirements item
}

interface StateType {
    targetPages: string[];
    progress: number;
    targetProgress: number;
    progressTracker?: NodeJS.Timeout;
    activeSites: number;
    browser?: Browser;
    model?: LLM;
    scrapedData: SubjectData[]
}

const state = {
    targetPages: [],
    progress: 0,
    targetProgress: 0,
    progressTracker: undefined,
    activeSites: 0,
    browser: undefined,
    model: undefined,
    scrapedData: [],
} as StateType;


async function searchPage(link: string) {
    if(!state.browser) {
        console.error('Browser not found!');
        process.exit();
    }
    if(link === ''){
        console.error('Link not found!');
        return;
    }
    const page = await state.browser.newPage();
    await page.goto(link);
    page.setDefaultTimeout(800);
    let data = new Map<string,string>;
    data.set('subject',await page.locator('.page-title').textContent()??'')
    for(let term of CONFIG.desiredTerms){
        try {
            data.set(term,
                (await page.locator('p', {has: page.locator('strong', {hasText: term})}).first().textContent())?.slice(term.length + 1)??''
            )
        } catch (e) {}
    }
    for(let[key, entry] of data){
        data.set(key, entry?.replace(' Opens in new window', ''));
    }
    state.scrapedData.push({
        subject: data.get('subject'),
        creditPoints: Number(data.get('Credit Points')),
        coordinator: data.get('Coordinator'),
        description: data.get('Description'),
        school: data.get('School'),
        discipline: data.get('Discipline'),
        prerequisites: data.get('Pre-requisite(s)'),
    })
    await page.close();
}

function startTrackingProgress(){
    let last = state.progress;
    state.progressTracker = setInterval(()=>{
        if (state.progress !== last){
            console.log(`Progress: ${(state.progress/state.targetProgress * 100).toFixed(1)}% (${state.progress}/${state.targetProgress})`);
            last = state.progress;
        }
    },50);
}

function stopTrackingProgress(){
    if (state.progressTracker) {
        clearInterval(state.progressTracker);
    }
}

async function startModel(){
    const client = new LMStudioClient();
    state.model = await client.llm.model(CONFIG.modelName);
}

async function main(){
    try {
        state.targetPages = JSON.parse(await fs.readFile(CONFIG.subjectFile, {encoding: "utf-8"}));
    } catch (e) {
        console.error(e, '\nCould not locate file specified. Please check input.');
        process.exit();
    }

    console.log('Pages: ', state.targetPages);

    state.browser = await playwright.chromium.launch({
        args: ['--no-sandbox', CONFIG.useHardwareAcceleration ? '' : '--disable-gpu'],
    });

    console.log('Launched Browser')

    state.targetProgress = state.targetPages.length;
    startTrackingProgress();
    while (state.targetPages.length > 0 || state.activeSites > 0){
        if (state.activeSites < CONFIG.concurrentPages && state.targetPages.length - state.activeSites > 0){
            const targetPage = state.targetPages.pop();
            state.activeSites++;
            searchPage(targetPage ?? '').finally(()=>{
                state.progress++;
                state.activeSites--;
            });
        } else {
            await new Promise(resolve => {
                setTimeout(resolve, 100)
            });
        }
    }
    console.log('wrapping up...')
    stopTrackingProgress();
    try{
        await fs.mkdir('./data');
    } catch(err) {}
    console.log('Writing data to file...')
    await fs.writeFile('./data/out.json', JSON.stringify(state.scrapedData,null,2), 'utf8');
    await state.browser.close();
}

main().then(()=>{
    console.log('Subject scraper complete!');
    process.exit();
});
