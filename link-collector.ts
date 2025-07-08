import playwright from 'playwright';
import fs from 'fs/promises';
import {startTrackingProgress, stopTrackingProgress, TimerObjectType} from "./util";


const CONFIG = {
    targetPage: 'https://hbook.westernsydney.edu.au',
    useHardwareAcceleration: true,
    targetLists: ['/programs/', '/majors-minors/', '/subject-details/'],
}

interface StateType {
    links: Map<string, (string | null)[]>;
    timerObject?: TimerObjectType;
    targetProgressLock: boolean;
}

const state = {
    links: new Map<string, (string | null)[]>,
    timerObject: undefined,
    targetProgressLock: false,
} as StateType;

async function searchPage() {
    console.log('Setting up browser...');
    const browser = await playwright.chromium.launch({
        args: ['--no-sandbox', CONFIG.useHardwareAcceleration ? '' : '--disable-gpu'],
        //headless: false,
    });
    const page = await browser.newPage();
    console.log('Navigating to page...');
    await page.goto(CONFIG.targetPage);
    console.log('Extracting data...');
    state.timerObject = startTrackingProgress(0);
    while (!state.timerObject){}
    await Promise.all((await page.locator('ul').all()).map(async (locator) => {
        const id = await locator.getAttribute('id');
        if (id && CONFIG.targetLists.includes(id)) {
            const elements = locator.locator('a');
            await addTargetProgress((await elements.all()).length);
            const data = await Promise.all(
                (await elements.all()).map(
                    async (selector) => selector.getAttribute('href').then((result)=> {
                        if(state.timerObject) state.timerObject.progress++;
                        return (result && result.startsWith('http')) ? result : CONFIG.targetPage + result;
                    })
                )
            );
            if(data) state.links.set(id, data);
        }
    }));
    stopTrackingProgress(state.timerObject);
    await page.close();
    await browser.close();
}

// this function shouldn't be called too much in order to avoid deadlock/starvation
async function addTargetProgress(amt: number) {
    while(state.targetProgressLock){
        // wait for target progress
    }
    state.targetProgressLock = true;
    if(state.timerObject) state.timerObject.targetProgress += amt;
    state.targetProgressLock = false;
}

async function saveData(){
    try {await fs.mkdir('./links');} catch(err) {
        try {
            const dir = await fs.opendir('./links');
            await dir.close();
        } catch (err2) {
            console.error('A fatal error has occurred.');
            throw err;
        }
    }
    for (let [key, value] of state.links.entries()) {
        const fileDir = './links/' + stringToFileName(key).trim() + '.json';
        console.log(`Saving ${key} to ${__dirname}/${fileDir.slice(2)}`);
        await fs.writeFile(fileDir, JSON.stringify(value, null, 2));
    }
}

function stringToFileName(fileName: string): string {
    return fileName.replace(/[\/|\\:*?"<>]/g, " ");
}

async function main(){
    await searchPage();
    await saveData();
}

main().catch(error => {
    console.error('An error occurred while running: ', error);
}).then(()=>{
    let messageString = '';
    for (let [key, value] of state.links.entries()) {
        messageString += `${value.length} items in ${key} | `;
    }
    console.log(`Finished! Found:\n| ${messageString}`);
    process.exit();
});


