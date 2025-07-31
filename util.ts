import playwright, {Locator, Page} from "playwright";
import {string} from "zod";
import fs from "fs/promises";

export interface TimerObjectType {
    progress: number,
    last: number,
    targetProgress: number,
    progressTracker: NodeJS.Timeout,
}

export function startTrackingProgress(progress: number, targetProgress?: number){
    const timerObject = {
        progress,
        last: progress,
        targetProgress: targetProgress ?? progress,
        progressTracker: setInterval(()=>{
            if (timerObject.progress !== timerObject.last){
                console.log(`Progress: ${(timerObject.progress/timerObject.targetProgress * 100).toFixed(1)}% (${timerObject.progress}/${timerObject.targetProgress})`);
                timerObject.last = timerObject.progress;
            }
        },50)
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
 * @param headings
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

async function getElements(locator: Locator, elementTags: string[]){
    const elements = [] as Locator[];
    for (const elementTag of elementTags){
        (await locator.locator(elementTag).all()).forEach(l=>elements.push(l));
    }
    return elements;
}

/**
 * @deprecated
 */
export async function getTableColumnClasses(locator: Locator){
    const headings = await getElements(locator,[
        'col',
        'th'
    ])
    const classNames = (await Promise.all(headings.map(async h=>{
        return await h?.textContent() ?? '';
    }))).filter(s=>s.length>0);
    return classNames;
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
        await fs.open(inputFile).then(async f=>await f.close());
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
