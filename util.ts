import {Locator, Page} from "playwright";
import {string} from "zod";

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
export async function extractTableData(locators: Locator[], rules: TableColumnExtractionRules[], headings?: Locator){
    let data = [];
    for (const locator of locators){
        try {
            const map = new Map<string, string>;
            for (const rule of rules){
                const value = await locator.locator(rule.selectorClass, rule.selectorFilters).textContent();
                if (!headings) {
                    map.set(rule.selectorClass, value ?? '');
                } else {
                    const name = await headings.locator(rule.selectorClass).textContent();
                    map.set(name ?? rule.selectorClass, value ?? '');
                }
            }
            data.push(map);
        } catch (e) {
            console.error('Table extraction failed. Continuing anyway but check the error!\n', e);
        }
    }
    return data;
}

export async function getTableRows(page: Page, uniqueTableIdentifier: string){
    return await page.locator(uniqueTableIdentifier).getByRole('row').all();
}

export async function getTableHeadings(page: Page, uniqueTableIdentifier: string){
    const elements = await page.locator(uniqueTableIdentifier).all();
    return elements.find(element => {
        return element.evaluate(e=> {
            return e.tagName.match(/^colgroup$|^thead$/);
        })
    })
}

export async function getTableColumnClasses(locator: Locator){
    const locators = await locator.all();
    const headings = (await Promise.all(locators.map(async loc => {
        return await loc.evaluate(e=>{
            if (e.tagName.match(/^th$|^col$/)) return loc;
        })
    }))).filter(Boolean);
    const classNames = await Promise.all(headings.map(async h=>{
        return await h?.textContent() ?? '';
    }));
    console.log(classNames);
    return classNames;
}

export function getTablesBySimilarClass(className: string){
    const tables = new Map<string, Map<string, string>>;

}