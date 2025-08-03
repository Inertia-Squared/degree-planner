import {Browser} from "playwright";
import fs from "fs/promises";
import {
    constructStringRule, extractTableData,
    extractTableDataStructured, getElementBySimilarId, getTablesBySimilarId, initSearch, scrape, setConfig,
    TimerObjectType
} from "../util";

/*  UNFIXABLE MAJORS/MINORS DUE TO MAJOR ERRORS:
    - Culture and Society, Major (0264) -- incorrect tab headings set, placeholders used for major content -- uniquely identifiable, can be manually dealt with, but not ideal
*/

// todo scrape course majors and minors

const CONFIG = {
    majorMinorFile: '../links/majors-minors.json',
    useHardwareAcceleration: true,
    outputFile: './data/majors-minors-unrefined.json',
    // desiredTerms: ['Credit Points','Coordinator','Description','School','Discipline','Pre-requisite(s)'],
    concurrentPages: 10,
}

export enum SpecialisationType {
    testamurMajor = 0,
    major,
    minor,
    concentration,
    other
}

export interface MajorMinorData {
    type: SpecialisationType
    name: string
    locations: { [k: string]: string;}[]
    sequences: { [k: string]: string[][];}
    related: string[][]
}

interface StateType {
    targetPages: string[];
    timerObject?: TimerObjectType;
    activeSites: number;
    browser?: Browser;
    scrapedData: MajorMinorData[];
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
    const page = await initSearch(state, link);
    if(!page) return;
    page.setDefaultTimeout(850);

    const overview = page.locator('id=textcontainer')
    let sequence = (await getElementBySimilarId(page.locator('div').and(page.locator('.tab_content')),'structure'))[0] ?? page
    const related = page.locator('id=relatedprogramstextcontainer')

    const programName = await page.locator('h1').and(page.locator('.page-title')).textContent();
    if (!programName) throw `Could not find major/minor name for ${link}!`
    let type = SpecialisationType.other;
    const matches = [/[[Tt]estamur [Mm]ajor/, /[Mm]ajor/,/[Mm]inor/,/[Cc]oncentration/];
    for (let i = 0; i < matches.length; i++){
        if (programName.match(matches[i])) type = i; // works because matches array is ordered to enums, janky but it shouldn't change so it's fine... ish
    }

    const locationTableRows = await overview.locator('.tbl_location_specialisation').or(overview.locator('.tbl_location')).locator('tr').all();
    const locationTableData = await extractTableDataStructured(
        locationTableRows,
        [
            constructStringRule('column0'),
            constructStringRule('column1'),
            constructStringRule('column2'),
        ]
    );

    const relatedPrograms = await extractTableData(related.locator('table'));

    let sequences = await getTablesBySimilarId(sequence.locator('div', {has: sequence.locator('table')}), 'tgl');
    if(sequences?.size == 0) sequences = (new Map<string, string[][]>).set('structure', await extractTableData(sequence.locator('table').and(sequence.locator('.sc_courselist').or(sequence.locator('.sc_plangrid')))));
    if (sequences?.size == 0) sequences = (new Map<string, string[][]>).set('structure', await extractTableData(sequence.locator('table'))); // fallback to generic


    state.scrapedData.push({
        type: type,
        name: programName,
        locations: locationTableData.map(l=> Object.fromEntries(l)),
        sequences: Object.fromEntries(sequences ?? []),
        related: relatedPrograms,
    })

    await page.close();
}

async function main(){
    try {
        state.targetPages = JSON.parse(await fs.readFile(CONFIG.majorMinorFile, {encoding: "utf-8"}));
    } catch (e) {
        console.error(e, '\nCould not locate file specified. Please check input.');
        process.exit();
    }
    await scrape(state,CONFIG,searchPage);
}

setConfig(CONFIG.majorMinorFile).then((r)=> {
    CONFIG.majorMinorFile = r.inputFile;
    CONFIG.outputFile = r.outputFile;
    main().then(() => {
        console.log('Major-minor scraper complete!');
        process.exit();
    })
});
