import playwright, {Browser} from "playwright";
import fs from "fs/promises";
import {
    constructStringRule,
    extractTableData, getTableColumnClasses, getTableHeadings,
    getTableRows,
    startTrackingProgress,
    stopTrackingProgress,
    TimerObjectType
} from "./util";

// todo program is currently heavily single-threaded, should divide targets into chunks and allocate to worker threads to take full advantage of parallelisation, currently is fast enough that network is likely to cap out first, but could already benefit on faster networks.

const CONFIG = {
    subjectFile: './links/programs-test.json',
    useHardwareAcceleration: true,
    // desiredTerms: ['Credit Points','Coordinator','Description','School','Discipline','Pre-requisite(s)'],
    concurrentPages: 3,
}

export interface ProgramData {

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

    const locationTableHeaders = await getTableHeadings(page, '.tbl_location');
    const classNames = (locationTableHeaders) ? (await getTableColumnClasses(locationTableHeaders)) : undefined;
    console.log(classNames)
    const locationTableRows = await getTableRows(page, '.tbl_location');
    const tableData = await extractTableData(
        locationTableRows,
        [
            constructStringRule('column0'),
            constructStringRule('column1'),
            constructStringRule('column2'),
            constructStringRule('column3'),
        ],
        locationTableHeaders
    );
    console.log(tableData);



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
    await fs.writeFile('./data/subjects-unrefined.json', JSON.stringify(state.scrapedData,null,2), 'utf8');
    await fs.writeFile('./data/debugInfo.json', JSON.stringify(state.debugInfo,null,2), 'utf8');
    await state.browser.close();
}

main().then(()=>{
    console.log('Subject scraper complete!');
    process.exit();
});
