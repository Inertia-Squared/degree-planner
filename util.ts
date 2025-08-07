import playwright, {Locator, Page} from "playwright";
import fs from "fs/promises";

export interface TimerObjectType {
    progress: number,
    last: number,
    targetProgress: number,
    progressTracker: NodeJS.Timeout,
    loggingFunction: (s: string)=>void
}

// Console TextFormat
const tf = {
    r: '\x1b[0m', // reset
    u: '\x1b[4m', // underline
    i: '\x1b[7m', // inverse
}

// Indented macros are intended to be used only after the 'parent' macro has passed.
export const regexMacros = {
    year: /[Yy]ear \d/, // start of year code
    session: / session$|(Se|Tri)mester \d| [Tt]erm /, // start/end of session code
        isSpring: /Spring/,
        isAutumn: /Autumn/,
        isSummer: /Summer/,
        isTrimester: /Trimester/,
        isTerm: / [Tt]erm /,
        isSemester: /Semester/, // don't think this exists (Aut/Spr used instead)? but will try to catch it anyway
    creditPointsText: /Credit Points/,
    totalCreditPoints: /Total Credit Points/, // end of sequence code
    subjectCode: /^[A-Z]{4}\s\d{4}/,
        looseSubjectCode: /[A-Z]{4}\s\d{4}/,
    hasChoice: /[Cc]hoose|Select/,
        areSelectionsGiven: / following/,
    choiceEdgeCase: /(^| )subject( |$)/,
    isReplaced: /([A-Z]{4} \d{4})(?:.*?)(?:replace)(?:.*?)([A-Z]{4} \d{4})/, // get match[1] for original, match[2] for replacement. Assumes original comes first.
    getYearNumber: /[Yyear] (\d)/, // get match[1] for year number
    levelPool: /Level (\d) Pool/
}

// very scuffed, but we'll never need more than this so it can stay scuffed :D
export function getNumberFromText(text: string){
    if(text.match(/(^| )one( |$)/i))    return 1;
    if(text.match(/(^| )two( |$)/i))    return 2;
    if(text.match(/(^| )three( |$)/i))  return 3;
    if(text.match(/(^| )four( |$)/i))   return 4;
    if(text.match(/(^| )five( |$)/i))   return 5;
    if(text.match(/(^| )six( |$)/i))    return 6;
    return -1;
}

// Some parent scripts may handle IPC for one channel but not the other, so send it to both.
export function throwAndLog(message: string){
    console.log('ERROR: ' + message);
    throw message;
}

export function startTrackingProgress(progress: number, targetProgress?: number){
    const timerObject = {
        progress,
        last: progress,
        targetProgress: targetProgress ?? progress,
        loggingFunction: console.log,
        progressTracker: setInterval(()=>{
            if (timerObject.progress !== timerObject.last){
                timerObject.loggingFunction(`Progress: ${(timerObject.progress/timerObject.targetProgress * 100).toFixed(1)}% (${timerObject.progress}/${timerObject.targetProgress})`);
                timerObject.last = timerObject.progress;
            }
        },50),
    }
    return timerObject as TimerObjectType;
}

export function stopTrackingProgress(timerObject: TimerObjectType){
    if (timerObject.progressTracker) {
        clearInterval(timerObject.progressTracker);
    }
}

export interface PlayWrightSelectorOptions {
    has?: Locator
    hasNot?: Locator
    hasText?: string | RegExp
    hasNotText?: string | RegExp
}

export interface TableColumnExtractionRules {
    selectorClass: string
    selectorFilters?: PlayWrightSelectorOptions
}

export function constructStringRule(name: string, filter?: string, searchForNot: boolean = false){
    if (searchForNot) {
        return {
            selectorClass: '.'+name,
            selectorFilters: filter ? {hasNotText: filter} : {}
        } as TableColumnExtractionRules
    } else {
        return {
            selectorClass: '.'+name,
            selectorFilters: filter ? {hasText: filter} : {}
        } as TableColumnExtractionRules
    }
}

/**
 * Takes a pre-located table (as an array representing the table's rows) and returns their values in a structured object
 * based on user-defined rules.
 * @param locators
 * @param rules
 */
export async function extractTableDataStructured(locators: Locator[], rules: TableColumnExtractionRules[]){
    let data = [];
    for (const locator of locators){
        try {
            const map = new Map<string, string>;
            for (const rule of rules){
                const value = await locator.locator(rule.selectorClass, rule.selectorFilters).textContent();
                map.set(rule.selectorClass, value ?? '');
            }
            data.push(map);
        } catch (e) {
            console.error(`Table extraction failed for ${locator.page().url()}. Continuing anyway but check the error!\n`, e);
        }
    }
    return data;
}

export async function extractTableData(table: Locator){
    const rows = await table.locator('tr').all();
    return await Promise.all(rows.map(async row=>{
        return await row.locator('td').or(row.locator('th')).allTextContents();
    }));
}

export async function getElementBySimilarId(locator: Locator, id: string){
    return (await Promise.all((await locator.all()).map(async loc=>{
        return await loc.getAttribute('id').then(result=> {
            if (result && result.includes(id)) return loc;
        });
    }))).filter(Boolean);
}

export async function getTablesBySimilarId(locator: Locator, id: string){
    const tableData = new Map<string, string[][]>;
    const tables = await getElementBySimilarId(locator, id);
    for (const table of tables) {
        if(!table) return;
        const tableName = await table.getAttribute('id');
        if(!tableName) return;
        const data = await extractTableData(table);
        tableData.set(tableName, data);
    }
    return tableData;
}

export async function setConfig(defaultInput: string) {
    const inputFile = process.argv[2];
    const outputFile = process.argv[3];
    let result: {
        inputFile: string,
        outputFile: string
    } = {
        inputFile: defaultInput,
        outputFile: outputFile,
    };
    try {
        await fs.open(inputFile).then(async f => await f.close());
        result.inputFile = inputFile;
    } catch (e) {
        console.log(`Path ${inputFile} for input file is not valid.`)
    }
    return result;

}

export async function scrape(state: any, CONFIG: any, searchPage: (a:string)=>Promise<void>){
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
    console.log('Writing data to file...')
    await logDebugState(state.debugInfo);
    await fs.writeFile(CONFIG.outputFile, JSON.stringify(state.scrapedData,null,2), 'utf8');
    if(state.browser) await state.browser.close();
}

async function logDebugState(debugInfo: any){
    try{
        await fs.mkdir('./data');
    } catch(err) {}
    await fs.writeFile('./data/debugInfo.json', JSON.stringify(debugInfo,null,2), 'utf8');
}

export async function initSearch(state: any, link: string){
    if(!state.browser) {
        console.error('Browser not found!');
        process.exit();
    }
    if(link === ''){
        console.error('Link not found!');
        return;
    }
    const page = await state.browser.newPage() as Page;
    try {
        await page.goto(link);
    } catch(e) {
        console.log(`Page ${link} took too long to load, skipping!`);
        state.debugInfo.skipped.push(link);
        return undefined;
    }
    return page;
}

export function underline(text: string){
    console.log(tf.u + text + tf.r);
}

export function highlight(text: string){
    console.log(tf.i + text + tf.r);
}