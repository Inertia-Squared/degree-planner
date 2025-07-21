import 'dotenv/config';
import {LLM, LMStudioClient} from "@lmstudio/sdk";
import fs from "fs/promises";
import {SubjectData} from "./subject-scraper";
import {startTrackingProgress, stopTrackingProgress, TimerObjectType} from "./util";
import {GoogleGenAI} from "@google/genai";


// @ts-ignore
let z;

const CONFIG = {
    dataFile: './data/subjects-unrefined.json',
    modelName: 'mistralai/mistral-small-3.2',
    onlineModelName: 'gemini-2.5-pro',
    online: false,
    manualErrorMsg: "MANUAL INTERVENTION REQUIRED",
    maxTries: 20,
    systemPrompt:
        'You are a data processor who reads in and outputs prerequisite information based on some simple rules. ' +
        'Subject codes are formatted as "ABCD 1234", some examples below simplifies this to a single letter for succinctness, but the rules are applying to these expanded values. ' +
        'Generalise all examples to any small or large number of subjects in any variation. ' +
        'The rules are as follows:\n' +
        'i. Subjects have the format "ABCD 1234 [sometimes some text on subject title or topic]".\n' +
        '1. Every time you see "[ABCD 1234] OR" without a newline, group them together in the SAME array e.g. for "A OR B OR C" -> [{course: any, prerequisites:[[A,B,C]]}], if there is a line break after an OR, or an OR is by itself, create an extra course entry for starting from the right of the OR instead of grouping them e.g. "A OR\nB AND C" -> [{course: any, prerequisites:[[A]]},{course: any, prerequisites:[[B],[C]]}]\n' +
        '2. Every time you see "[ABCD 1234] AND", put elements following in a new array e.g. "A AND B AND C" -> [{course: any, prerequisites:[[A],[B],[C]]}]. Do not apply the newline OR rules to AND.\n' +
        '3. These values can be mixed to create complex arrays of string arrays e.g. "A AND B OR C" -> [{course: any, prerequisites:[[A],[B,C]]}], "A AND B OR\n C" -> [{course: any, prerequisites:[[A],[B]]},{course: any, prerequisites:[[C]]}]\n' +
        '4. Some prerequisites specify a course requirement e.g. "A AND B OR for Course with this long name 1234 C" -> [{course: any, prerequisites:[[A],[B]]},{course: 1234, prerequisites: [[C]]}]\n' +
        '5. For each OR with a line break directly after, create a new entry with the same course name starting from the right/after the OR. The subject with the OR is merged into the ORIGINAL array (see example 5a)\n' +
        '5a. IMPORTANT EXAMPLE: A AND\n B AND\n C AND\n D OR\nE AND F -> [{course: any, prerequisites:[[A],[B],[C],[D]]},{course: any, prerequisites: [[E,F]]}]. Generalise this case as much as possible.\n' +
        '6. Returned subject values must follow this format.\n' +
        '7. Courses have the format "[Some long name and info] 1234".\n' +
        '8. Returned course values must always be in the course field, and may only be "any" or in the format "1234", where 1234 is replaced with the course\'s actual code.\n' +
        '9. Do not include the subject title or description in your output.\n' +
        '10. Ignore erroneous ORs and ANDs, only count operators which (ignoring newlines) have a subject code immediately before them e.g. "WELF 7008 This and That in Magic and Mystery\nOr\nWELF 6001 Witchcraft or Wizardry in Season" is ALWAYS equal to {course: any, prerequisites: [[WELF 7008, WELF 6001]]}\n' +
        '11. Typically an AND or OR will be capitalised, but will not always, treat all terms equally regardless of capitalisation, so long as it follows rule 11.\n' +
        '\nApply the rules above on the following data:\n'
}

if (CONFIG.online){
    z = require('zod/v4');
} else {
    z = require('zod')
}

const requirementSchema = z.object({
    course: z.string().refine((input: string)=>{
        return /^any$|^\d{4}$|^SPECIAL$/.test(input ?? "");
    }, "Should match pattern /^any$|^\\d{4}$|^SPECIAL$/"),
    prerequisites: z.string().refine((input: string)=>{
        return /^SPECIAL$|^[A-Z]{4} \d{4}$|^\d{4}$/.test(input ?? "");
    }, "Should match pattern /^SPECIAL$|^[A-Z]{4} \\d{4}$|^\\d{4}$/").array().array(),
}).array();

export interface enrollRequirements {
    course: string;
    prerequisites?: string[][];
}

interface StateType {
    subjectData: SubjectData[];
    prunedSubjectData: SubjectData[];
    progressTracker?: TimerObjectType;
    model?: LLM | GoogleGenAI;
    manualSubjects: SubjectData[];
}

const state = {
    subjectData: [],
    prunedSubjectData: [],
    progressTracker: undefined,
    model: undefined,
    manualSubjects: [],
} as StateType;


async function startModel(){
    if(CONFIG.online){
        state.model = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
    } else {
        const client = new LMStudioClient();
        state.model = await client.llm.model(CONFIG.modelName);
        // await state.model.respond('test');
        console.log('Model loaded!')
    }
}


async function queryModel(subject: SubjectData, attempts: number = 0){
    if(!CONFIG.online){
        const query = CONFIG.systemPrompt + `
        Prerequisites:\n${processQueryString(subject.prerequisites as string)}`;
        try{ // @ts-ignore
            return await state.model.respond(query, {structured: requirementSchema, temperature: Math.max(attempts/10,1)});}
        catch(err){
            console.log(`Received bad response\n\n${err}\n\n, retrying... (attempt number ${attempts+2}/${CONFIG.maxTries})`);
            if(attempts >= CONFIG.maxTries + 2){
                return {parsed: {program: CONFIG.manualErrorMsg, prerequisites: [[CONFIG.manualErrorMsg]]}, content: CONFIG.manualErrorMsg}
            }
            return await queryModel(subject, ++attempts);
        }
    } else if (state.model instanceof GoogleGenAI){
        const query = CONFIG.systemPrompt + `
        Prerequisites:\n${processQueryString(subject.prerequisites as string)}`;
        try {
            const result = await state.model.models.generateContent({
                model: CONFIG.onlineModelName,
                contents: query,
                config: {
                    // @ts-ignore
                    responseJsonSchema: z.toJSONSchema(requirementSchema),
                    thinkingConfig: {
                        thinkingBudget: Math.min(Math.max((subject.prerequisites as string).length - 9, 5) * 40 + Math.max((subject.prerequisites as string).length - 50, 0) * 50, 5000)
                    }
                }
            });
            const text = result.text?.replace(/```json|```/g, '');
            return {content: text, parsed: JSON.parse(text ?? '')}
        } catch (e) {
            // save output in case we're STUCK stuck
            console.log('Failed to query: ', e);
            await fs.writeFile("./data/subjects-manual-required.json", JSON.stringify(state.manualSubjects,null,2), {encoding: "utf-8"});
            await fs.writeFile("./data/subjects-refined-partial.json", JSON.stringify(state.prunedSubjectData,null,2), {encoding: "utf-8"});
            // assume API is temporarily busy, try again every 20 seconds
            let result;
            await new Promise((resolve) => {
                setTimeout(() => {
                    resolve(async()=>result = await queryModel(subject, 0));
                }, 30000);
            });
            return result;
        }
    }
    throw "No Model Loaded";
}

function processQueryString(query: string){
    return query.replace(/ /g, ' ').replace(/-/g,'');
}

// Since both pruned and non-pruned are ordered, we can just scan through once and replace as we go
// this looks O(N^2) but it's actually O(N)
// This only works if state.subjectData has not had an element removed since prunedSubjectData was set,
//  as the removed element may cause the loop to get stuck
function recombineSubjectData(){
    let j = 0;
    let subjectsAreMatching;
    for (let i = 0; i < state.prunedSubjectData.length; i++) {
        for (; !(subjectsAreMatching = (state.subjectData[j].subject === state.prunedSubjectData[i].subject)); j++) {}
        if(subjectsAreMatching) state.subjectData[j].prerequisites = state.prunedSubjectData[i].prerequisites;
    }
}

async function main(){
    const loadModelTask = startModel();

    try {
        state.subjectData = JSON.parse((await fs.readFile(CONFIG.dataFile, {encoding: "utf-8"})));
    } catch(e) {
        console.error(e, `\nCould not locate file '${CONFIG.dataFile}'. Please check input.`);
        await exitProcedure();
    }
    state.prunedSubjectData = state.subjectData.filter((subject)=>{
        return subject.prerequisites && subject.prerequisites.length > 6; // length check to prune 'NONE' and other variants of blank entries
    }) as SubjectData[] ?? [];
    await loadModelTask;
    state.progressTracker = startTrackingProgress(0,state.prunedSubjectData.length);
    for(let queryData of state.prunedSubjectData){
        console.log(`\nQuerying based on subject: ${queryData.subject}Prerequisites:\n${processQueryString(queryData.prerequisites as string)}`);
        queryData.originalPrerequisites = queryData.prerequisites as string; // compatibility for old data, remove this
        const queryResult = await queryModel(queryData);
        queryData.prerequisites = queryResult.parsed as enrollRequirements[];
        console.log("Query Result: ",queryResult.content)
        if(queryResult.content === CONFIG.manualErrorMsg){
            state.subjectData = state.subjectData.filter((subject)=>{
                return subject !== queryData;
            });
            state.prunedSubjectData = state.prunedSubjectData.filter((subject)=>{
                return subject !== queryData;
            });
            state.manualSubjects.push(queryData);
        }
        state.progressTracker.progress++;
    }
    stopTrackingProgress(state.progressTracker);
}

main().then(async ()=>{
    console.log('Subject refinement complete!');
    console.log("Recombining data...");
    recombineSubjectData();
    console.log("Saving data...");
    await fs.writeFile("./data/subjects-manual-required.json", JSON.stringify(state.manualSubjects,null,2), {encoding: "utf-8"});
    await fs.writeFile("./data/subjects-refined.json", JSON.stringify(state.subjectData,null,2), {encoding: "utf-8"});
    await exitProcedure();
});

// We need a slightly more complex exit procedure to make sure the model doesn't stay loaded after usage.
// This procedure should be called any time the program must stop.
async function exitProcedure(){
    console.log("Shutting down...");
    if (state.model && !CONFIG.online) {
        if (!(state.model instanceof GoogleGenAI)) {
            await state.model.unload();
        }
        console.log("Model unloaded successfully");
    } else {
        console.log("No model to unload, skipping...");
    }
    console.log("Process has terminated gracefully.");
    process.exit(0);
}
