import {Browser} from "playwright";
import fs from "fs/promises";
import {
    constructStringRule, extractTableData,
    extractTableDataStructured, getElementBySimilarId, getTablesBySimilarId, initSearch, scrape, setConfig,
    TimerObjectType
} from "../util";

// todo make the scraper generic and only implement search interface with the page context already open (i.e. hide the repetitive connection code)
const CONFIG = {
    programsFile: '../links/programs.json',
    outputFile: './data/programs-unrefined.json',
    useHardwareAcceleration: true,
    concurrentPages: 50,
}


export interface ProgramData {
    name: string
    locations: { [k: string]: string;}[]
    sequence: { [k: string]: string[][];}
    links?: ProgramLinkData
    originalLink: string
    sequenceNames: string[]
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

const scrapedAlternate: string[] = [];
const scrapedEmpty: string[] = [];

async function searchPage(link: string) {
    /**
     * Connect to the page, and set a quick timeout so we don't get stuck if an expected object is missing
     *
     * Due to short timeout period, scraping is not tolerant to network instability or processing delays
     */
    const page = await initSearch(state, link);
    if(!page) return;
    page.setDefaultTimeout(850); // increase this value if scrape keeps failing, min: ~300, recommended: ~800, max: as much as it takes, ~15 000 is sensible for < 30 concurrent pages on most networks/processors

    /**
     * Locators (Narrowed by Tab where possible)
     * **/
    const overview = page.locator('id=textcontainer')
    let sequenceLocator = (await getElementBySimilarId(page.locator('div').and(page.locator('.tab_content')),'sequence2025'))[0] ?? /* prioritise more recent sequence, if possible */
                                        (await getElementBySimilarId(page.locator('div').and(page.locator('.tab_content')),'sequence2024'))[0] ??
                                        (await getElementBySimilarId(page.locator('div').and(page.locator('.tab_content')),'sequence'))[0] ??
                                        (await getElementBySimilarId(page.locator('div').and(page.locator('.tab_content')),'structure'))[0] ??
                                        page


    /**
     * Get program name
     */
    const programName = await page.locator('h1').and(page.locator('.page-title')).textContent();
    if (!programName) throw `Could not find program name for ${link}!`

    let links = {} as ProgramLinkData;

    let shouldLog = false;
    let sequenceNames;
    try{
        sequenceNames = await sequenceLocator.locator('div.toggle-group:near(:text-matches("(Recommended|Program|Sequence|Structure|Current) (Recommended|Program|Sequence|Structure|Current)", "i"))').locator('button').allTextContents()
        if(sequenceNames.length === 0) {
            sequenceNames = await sequenceLocator.locator(':is(h2):near(table.sc_plangrid)')
                .or(sequenceLocator.locator(':is(h2):near(table.sc_courselist)'))
                .allTextContents()
           // sequenceNames = (await Promise.all(sequenceNames.map(async s=>await s.first().allTextContents()))).flat()
            shouldLog = true;
        }
    } catch (e) {
        console.log('Timed out, skipped!')
        shouldLog = true;
    }
    let shouldTerm = false;
    sequenceNames = sequenceNames?.map(s=>{
        // s = s as string
        if (s.match(/(\s{1,3}|^)(major|minor)/i) || shouldTerm) {
            shouldTerm = true;
            return;
        }
        return s.trim().trim();
    }).filter((f)=>f!==undefined) // trim extra since some sequences have had two spaces in them
    if(shouldLog) console.log(`${programName.trim()}: ${sequenceNames}`)
    if (shouldLog) {
        if (sequenceNames && sequenceNames.length > 0){
            scrapedAlternate.push(link)
        } else {
            scrapedEmpty.push(link)
        }
    }

    /**
     * Get links to majors
     */
    links.majors = (await Promise.all((await sequenceLocator.locator('.sc_screlatedcurricmjr').locator('a').all()).map(async link =>{
        const href = await link.getAttribute('href');
        return 'https://hbook.westernsydney.edu.au' + (href ?? '');
    }))).filter(str=>str!=='https://hbook.westernsydney.edu.au'); // linting doesn't like boolean filter for some reason

    if(links.majors.length < 1){
        links.majors = (await Promise.all((await page.locator('.sc_screlatedcurricmjr').locator('a').all()).map(async link =>{
            const href = await link.getAttribute('href');
            return 'https://hbook.westernsydney.edu.au' + (href ?? '');
        }))).filter(str=>str!=='https://hbook.westernsydney.edu.au');
    }

    /**
     * Get links to minors
     */
    links.minors = (await Promise.all((await sequenceLocator.locator('.sc_screlatedcurricmnr').locator('a').all()).map(async link =>{
        const href = await link.getAttribute('href');
        return 'https://hbook.westernsydney.edu.au' + (href ?? '');
    }))).filter(str=>str!=='https://hbook.westernsydney.edu.au');

    if(links.minors.length < 1){
        links.minors = (await Promise.all((await page.locator('.sc_screlatedcurricmnr').locator('a').all()).map(async link =>{
            const href = await link.getAttribute('href');
            return 'https://hbook.westernsydney.edu.au' + (href ?? '');
        }))).filter(str=>str!=='https://hbook.westernsydney.edu.au');
    }

    /**
     * Get links to subjects
     */
    links.subjects = (await Promise.all((await sequenceLocator.locator('a').and(sequenceLocator.locator('.code')).all()).map(async link =>{
        try{
            const href = await link.getAttribute('href');
            if(href?.includes('search')) {
                const subjectHref = "https://hbook.westernsydney.edu.au/subject-details/" + (await link.innerText()).replace(' ', '').toLowerCase()
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
    let sequence = (await getTablesBySimilarId(sequenceLocator.locator('div', {has: sequenceLocator.locator('table')}), 'tgl'));
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
        originalLink: link,
        sequenceNames: sequenceNames ?? []
    })

    await page.close();
}

async function main() {
    let totalPages = 0;
    try {
        state.targetPages = JSON.parse(await fs.readFile(CONFIG.programsFile, {encoding: "utf-8"}));
        totalPages = state.targetPages.length
    } catch (e) {
        console.error(e, '\nCould not locate file specified. Please check input.');
        process.exit();
    }
    await scrape(state, CONFIG, searchPage);
    console.log(`Scraped with alternate method: ${JSON.stringify(scrapedAlternate,null,2)}`)
    console.log(`Scraped and empty: ${JSON.stringify(scrapedEmpty,null,2)}`)
    console.log(`Scraped Alternate: ${scrapedAlternate.length*100/totalPages}%, Scraped Empty: ${scrapedEmpty.length*100/totalPages}%`)
}

setConfig(CONFIG.programsFile).then((r)=> {
    CONFIG.programsFile = r.inputFile;
    if(r.outputFile) CONFIG.outputFile = r.outputFile;
    main().then(() => {
        console.log('Program scraper complete!');
        process.exit();
    })
});
