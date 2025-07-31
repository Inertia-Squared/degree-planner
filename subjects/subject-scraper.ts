import playwright, {Browser} from "playwright";
import fs from "fs/promises";
import {scrape, setConfig, startTrackingProgress, stopTrackingProgress, TimerObjectType} from "../util";
import {enrollRequirements} from "./subject-refiner";

// todo program is currently heavily single-threaded, should divide targets into chunks and allocate to worker threads to take full advantage of parallelisation, currently is fast enough that network is likely to cap out first, but could already benefit on faster networks.

const CONFIG = {
    subjectFile: '../links/subject-details.json',
    outputFile: './data/subjects-unrefined.json',
    useHardwareAcceleration: true,
    desiredTerms: ['Credit Points','Coordinator','Description','School','Discipline','Pre-requisite(s)'],
    concurrentPages: 10,
}

export interface AssessmentData {
    type: string;
    length: string;
    percent: number;
    threshold: boolean;
    task_type?: string;
    mandatory?: boolean;
}

export interface TeachingPeriodData {
    period: string;
    locations: string[];
}

export interface SubjectData {
    subject?: string;
    creditPoints?: number;
    coordinator?: string;
    description?: string;
    school?: string;
    discipline?: string;
    teachingPeriods?: TeachingPeriodData[];
    prerequisites?: string | enrollRequirements[]; // captures requirements that vary based on enrolled course, to be eligible user must have completed at least one subject of every enrollRequirements item
    originalPrerequisites?: string;
    assessments?: AssessmentData[];
}

interface StateType {
    targetPages: string[];
    timerObject?: TimerObjectType;
    activeSites: number;
    browser?: Browser;
    scrapedData: SubjectData[];
    debugInfo: {
        skipped: string[];
        termNotFound: string[];
    };
}

const state = {
    targetPages: [],
    timerObject: undefined,
    activeSites: 0,
    browser: undefined,
    scrapedData: [],
    debugInfo: {
        skipped: [],
        termNotFound: [],
    },
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
    try {
        await page.goto(link);
    } catch(e) {
        console.log(`Page ${link} took too long to load, skipping!`);
        state.debugInfo.skipped.push(link);
    }
    page.setDefaultTimeout(850);

    /**
     * data subroutine
     * @brief returns value of any heading specified in the 'desiredTerms' section of
     *        config, must be formatted on the site as <strong>heading</strong> data
     */
    let data = new Map<string,string>;
    data.set('subject',await page.locator('.page-title').textContent()??'')
    for(let term of CONFIG.desiredTerms){
        try {
            data.set(term,
                (await page.locator('p').filter({has: page.locator('strong', {hasText: term})}).first().textContent())?.slice(term.length + 1)??''
            )
        } catch (e) {
            //console.log("Could not find term: " + term + " for page " + link + " within required time limit. Is either missing or default timeout period must be increased.");
            state.debugInfo.termNotFound.push(`Could not find ${term} at ${link}!`);
        }
    }
    for(let[key, entry] of data){
        data.set(key, entry?.replace(' Opens in new window', ''));
    }

    /**
     * assessments subroutine
     * @brief converts the data on the assessments table portion of the handbook into a structured JSON format
     */
    const assessmentTable = await page.locator('.table').locator('tbody').locator('tr').all();
    page.setDefaultTimeout(600);
    let assessmentData = []
    for (const assessmentLocator of assessmentTable){
        try {
            const type = await assessmentLocator.locator('.column0').textContent();
            const length = await assessmentLocator.locator('.column1').textContent();
            const percent = Number((await assessmentLocator.locator('.column2').textContent())?.replace('%', ''));
            const threshold = (await assessmentLocator.locator('.column3').textContent()) === 'Y';
            let task_type;
            let mandatory;
            try {
                task_type = await assessmentLocator.locator('.column4', {hasNotText: /^Y$|^N$|^$/}).textContent(); // workaround for handbook site bug where two last columns are both named 'column4'
            } catch (e) {
            }
            try {
                mandatory = (await assessmentLocator.locator('.column4', {hasText: /^Y$|^N$/}).textContent()) === 'Y'
            } catch (e) {
            }
            const assessment = {
                type: type,
                length: length,
                percent: percent,
                threshold: threshold,
                task_type: task_type,
                mandatory: mandatory,
            } as AssessmentData;
            assessmentData.push(assessment);
        } catch (e) {
            console.log(`Subject ${data.get('subject')} failed: ${e}`); // TODO: log to file
        }
    }


    /**
     * study periods subroutine
     * @brief converts the data in the study periods list into a structured JSON format
     */
    const periods = await page.locator('.teaching-period').filter({has: page.locator('button')}).all();
    const filteredPeriods = await Promise.all(periods.filter(async (period) => {
        return (await period.getAttribute('id'))?.startsWith('teaching-period');
    }));

    let finalPeriods = [] as TeachingPeriodData[];
    for (const period of filteredPeriods) {
        const periodName = await period.locator('button').first().textContent();
        const dynamicId = await period.locator('button').getAttribute('aria-controls');
        const locationsSelectors = await page.locator(`#${dynamicId}`).first().locator('button').all();

        let locations = []
        for (const location of locationsSelectors) {
            locations.push(await location.textContent());
        }

        const periodData = {
            period: periodName,
            locations: locations,
        }
        finalPeriods.push(periodData as TeachingPeriodData);
    }

    state.scrapedData.push({
        subject: data.get('subject'),
        creditPoints: Number(data.get('Credit Points')),
        coordinator: data.get('Coordinator'),
        description: data.get('Description'),
        school: data.get('School'),
        discipline: data.get('Discipline'),
        prerequisites: data.get('Pre-requisite(s)'),
        originalPrerequisites: data.get('Pre-requisite(s)'),
        assessments: assessmentData,
        teachingPeriods: finalPeriods,
    });
    await page.close();
}

async function main(){
    try {
        state.targetPages = JSON.parse(await fs.readFile(CONFIG.subjectFile, {encoding: "utf-8"}));
    } catch (e) {
        console.error(e, '\nCould not locate file specified. Please check input.');
        process.exit();
    }
    await scrape(state,CONFIG,searchPage);
}

setConfig(CONFIG.subjectFile).then((r)=> {
    CONFIG.subjectFile = r.inputFile;
    CONFIG.outputFile = r.outputFile;
    main().then(() => {
        console.log('Program scraper complete!');
        process.exit();
    })
});
