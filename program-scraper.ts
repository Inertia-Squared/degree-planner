import playwright, {Browser} from "playwright";
import fs from "fs/promises";
import {
    constructStringRule, extractTableData,
    extractTableDataStructured, getElementBySimilarId, getTablesBySimilarId,
    startTrackingProgress,
    stopTrackingProgress,
    TimerObjectType
} from "./util";

// todo make the scraper generic and only implement search interface with the page context already open (i.e. hide the repetitive connection code)

const CONFIG = {
    subjectFile: './links/programs-SCDMS.json',
    useHardwareAcceleration: true,
    // desiredTerms: ['Credit Points','Coordinator','Description','School','Discipline','Pre-requisite(s)'],
    concurrentPages: 8,
}


export interface ProgramData {
    name: string
    locations: { [k: string]: string;}[]
    sequence: { [k: string]: string[][];}
    links?: ProgramLinkData
}

export interface ProgramLinkData {
    majors: string[]
    minors: string[]
    subjects: string[]
}

interface StateType {
    targetPages: string[];
    timerObject?: TimerObjectType;
    activeSites: number;
    browser?: Browser;
    scrapedData: ProgramData[];
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
    }
} as StateType;

async function searchPage(link: string) {
    /**
     * Connect to the page, and set a quick timeout so we don't get stuck if an expected object is missing
     *
     * Due to short timeout period, scraping is not tolerant to network instability or processing delays
     */
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
    page.setDefaultTimeout(850); // increase this value if scrape keeps failing, min: ~300, recommended: ~800, max: as much as it takes, ~15 000 is sensible for < 30 concurrent pages on most networks/processors

    /**
     * Locators (Narrowed by Tab where possible)
     * **/
    const overview = page.locator('id=textcontainer')
    let sequenceLocator = (await getElementBySimilarId(page.locator('div').and(page.locator('.tab_content')),'sequence2024'))[0] ?? /* prioritise more recent sequence, if possible */
                                        (await getElementBySimilarId(page.locator('div').and(page.locator('.tab_content')),'sequence'))[0] ??
                                        page
    /**
     * Get program name
     */
    const programName = await page.locator('h1').and(page.locator('.page-title')).textContent();
    if (!programName) throw `Could not find program name for ${link}!`

    let links = {} as ProgramLinkData;

    /**
     * Get links to majors
     */
    links.majors = (await Promise.all((await sequenceLocator.locator('.sc_screlatedcurricmjr').locator('a').all()).map(async link =>{
        return await link.getAttribute('href');
    }))).filter(str=>str!==null); // linting doesn't like boolean filter for some reason

    /**
     * Get links to minors
     */
    links.minors = (await Promise.all((await sequenceLocator.locator('.sc_screlatedcurricmnr').locator('a').all()).map(async link =>{
        return await link.getAttribute('href');
    }))).filter(str=>str!==null);

    /**
     * Get links to subjects
     */
    links.subjects = (await Promise.all((await sequenceLocator.locator('a').and(sequenceLocator.locator('.code')).all()).map(async link =>{
        try{
            const href = await link.getAttribute('href');
            if(href?.includes('search')) {
                const subjectHref = "https://hbook.westernsydney.edu.au/subject-details/" + (await link.innerText()).replace(' ', '-').toLowerCase()
                return subjectHref ?? undefined;
            }
        } catch (e){
            return undefined;
        }
    }))).filter(str=>str!==undefined);

    /**
     * Get all data on delivery locations - unprocessed table
     */
    const locationTableRows = await overview.locator('.tbl_location').locator('tr').all();
    const locationTableData = await extractTableDataStructured(
        locationTableRows,
        [
            constructStringRule('column0'),
            constructStringRule('column1'),
            constructStringRule('column2'),
        ]
    );

    /**
     * Get all data on course structure options - also unprocessed
     * todo collect and preserve table headers/names
     */
    let sequence = await getTablesBySimilarId(sequenceLocator.locator('div', {has: sequenceLocator.locator('table')}), 'tgl');
    if(sequence?.size == 0) sequence = (new Map<string, string[][]>).set('structure', await extractTableData(sequenceLocator.locator('table').and(sequenceLocator.locator('.sc_courselist').or(sequenceLocator.locator('.sc_plangrid')))));
    if (sequence?.size == 0) sequence = (new Map<string, string[][]>).set('structure', await extractTableData(sequenceLocator.locator('table'))); // fallback to generic

    /**
     * Ship it!
     */
    state.scrapedData.push({
        name: programName,
        locations: locationTableData.map(l=> Object.fromEntries(l)),
        sequence: Object.fromEntries(sequence ?? []),
        links: links,
    })

    await page.close();
}

async function main(){
    try {
        state.targetPages = JSON.parse(await fs.readFile(CONFIG.subjectFile, {encoding: "utf-8"}));
    } catch (e) {
        console.error(e, '\nCould not locate file specified. Please check input.');
        process.exit();
    }

    console.log(`Initialising scrape of ${state.targetPages.length} pages.`);

    state.browser = await playwright.chromium.launch({
        args: ['--no-sandbox', CONFIG.useHardwareAcceleration ? '' : '--disable-gpu'],
    });

    console.log('Browser Setup Complete')

    state.timerObject = startTrackingProgress(0, state.targetPages.length);
    while (state.targetPages.length > 0 || state.activeSites > 0){
        if (state.activeSites < CONFIG.concurrentPages && state.targetPages.length - state.activeSites > 0){
            const targetPage = state.targetPages.pop();
            state.activeSites++;
            searchPage(targetPage ?? '').finally(()=>{
                if(state.timerObject) state.timerObject.progress++
                state.activeSites--;
            });
        } else {
            await new Promise(resolve => {
                setTimeout(resolve, 100);
            });
        }
    }

    console.log('wrapping up...');
    stopTrackingProgress(state.timerObject);
    try{
        await fs.mkdir('./data');
    } catch(err) {}
    console.log('Writing data to file...')
    await fs.writeFile('./data/programs-scdms-unrefined.json', JSON.stringify(state.scrapedData,null,2), 'utf8');
    await fs.writeFile('./data/debugInfo.json', JSON.stringify(state.debugInfo,null,2), 'utf8');
    await state.browser.close();
}

main().then(()=>{
    console.log('Program scraper complete!');
    process.exit();
});
