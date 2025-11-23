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
    subjectCode: /^[A-Z]{4}(\s| )\d{4}/,
        aggressiveSubjectCode: /[A-Z]{4}[\s ]?\d{4}/g, // matches subject codes the most aggressively but may have false positives
        looseSubjectCode: /[A-Z]{4}(\s| )\d{4}/,
        noWhiteSpaceCode: /[A-Z]{4}\d{4}/,
    hasChoice: /[Cc]hoose|Select/,
        areSelectionsGiven: / following/,
    choiceEdgeCase: /(^| )subject( |$)/,
    isReplaced: /([A-Z]{4} \d{4})(?:.*?)(?:replace)(?:.*?)([A-Z]{4} \d{4})/, // get match[1] for original, match[2] for replacement. Assumes original comes first.
    getYearNumber: /[Yy]ear (\d)/, // get match[1] for year number
    levelPool: /Level (\d) Pool/
}

/**
 * Converts a number written as a word (up to six) into its integer equivalent.
 * @param text The text to parse.
 * @returns The number, or -1 if no match is found.
 */
export function getNumberFromText(text: string){
    if(text.match(/(^| )one( |$)/i))    return 1;
    if(text.match(/(^| )two( |$)/i))    return 2;
    if(text.match(/(^| )three( |$)/i))  return 3;
    if(text.match(/(^| )four( |$)/i))   return 4;
    if(text.match(/(^| )five( |$)/i))   return 5;
    if(text.match(/(^| )six( |$)/i))    return 6;
    return -1;
}

/**
 * Standardises a subject code to the format "ABCD 1234".
 * @param code The subject code to normalise.
 * @returns The normalised subject code.
 */
export function normaliseSubjectCode(code: string){
    if (code.match(/^\w{4} \d{4}$/)) return code;
    const match = code.match(/(\w{4})\s*(\d{4})/);
    if (!match) return code;
    return `${match[1]} ${match[2]}`.toUpperCase();
}

/**
 * Generates a handbook link for a given subject code.
 * @param link The subject code.
 * @returns The full URL for the subject details page.
 */
export function getLinkFromSubjectCode(link: string){
    return "https://hbook.westernsydney.edu.au/subject-details/" + link.replace(/ |\s/, '').toLowerCase();
}

/**
 * Logs an error message to the console and throws an exception.
 * @param message The message to log and throw.
 */
export function throwAndLog(message: string){
    console.log('ERROR: ' + message);
    throw message;
}

/**
 * Starts a progress tracker that logs the percentage complete to the console.
 * @param progress The initial progress value.
 * @param targetProgress The target value for progress.
 * @returns A timer object for managing the tracker.
 */
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

/**
 * Stops a previously started progress tracker.
 * @param timerObject The timer object to stop.
 */
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

/**
 * Constructs a rule for table column extraction.
 * @param name The class name of the column.
 * @param filter An optional text filter to apply.
 * @param searchForNot If true, the filter will be inverted.
 * @returns A rule object for table extraction.
 */
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

/**
 * Extracts all text content from a table, returning it as a 2D array of strings.
 * @param table The Playwright locator for the table.
 * @returns A 2D array representing the table's data.
 */
export async function extractTableData(table: Locator){
    const rows = await table.locator('tr').all();
    return await Promise.all(rows.map(async row=>{
        return await row.locator('td').or(row.locator('th')).allTextContents();
    }));
}

/**
 * Finds elements that have an ID containing a given string.
 * @param locator A Playwright locator to search within.
 * @param id The string to search for in the ID attribute.
 * @returns An array of locators for the matching elements.
 */
export async function getElementBySimilarId(locator: Locator, id: string){
    return (await Promise.all((await locator.all()).map(async loc=>{
        return await loc.getAttribute('id').then(result=> {
            if (result && result.includes(id)) return loc;
        });
    }))).filter(Boolean);
}

/**
 * Extracts data from all tables whose IDs contain a given string.
 * @param locator A Playwright locator to search within.
 * @param id The string to search for in the table IDs.
 * @returns A map where keys are table IDs and values are the extracted table data.
 */
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

/**
 * Sets up the input and output file paths for a script, using command-line arguments or defaults.
 * @param defaultInput The default input file path.
 * @returns An object containing the input and output file paths.
 */
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

/**
 * Manages the scraping process, including browser launch, page navigation, and data persistence.
 * @param state An object containing the current state of the scraper.
 * @param CONFIG The configuration object for the scraper.
 * @param searchPage A function that performs the scraping on a single page.
 */
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

/**
 * Logs the debug information to a file.
 * @param debugInfo The debug information to log.
 */
async function logDebugState(debugInfo: any){
    try{
        await fs.mkdir('Automation/data');
    } catch(err) {}
    await fs.writeFile('Automation/data/debugInfo.json', JSON.stringify(debugInfo,null,2), 'utf8');
}

/**
 * Initialises a Playwright page and navigates to a given URL.
 * @param state The scraper's state object.
 * @param link The URL to navigate to.
 * @returns A Playwright page object, or undefined if an error occurs.
 */
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

/**
 * Prints underlined text to the console.
 * @param text The text to underline.
 */
export function underline(text: string){
    console.log(tf.u + text + tf.r);
}

/**
 * Prints highlighted text to the console.
 * @param text The text to highlight.
 */
export function highlight(text: string){
    console.log(tf.i + text + tf.r);
}