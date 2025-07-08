import {z} from "zod";
import {LLM, LMStudioClient} from "@lmstudio/sdk";
import fs from "fs/promises";
import {SubjectData} from "./subject-scraper";
import {startTrackingProgress, stopTrackingProgress, TimerObjectType} from "./util";

const CONFIG = {
    dataFile: './data/subjects-unrefined.json',
    modelName: 'gemma-3-12b-it-qat',
    systemPrompt: 'Take the requirements for this subject in plaintext and convert the data into a rigid format. If there is no study program/course specified for a set of prerequisites, use \'any\'. In cases where the order of AND/OR is ambiguous, treat the AND as a separator and the OR as a comma in a list, unless brackets or other instructions indicate otherwise. As a pseudo-structured example, \"A AND B OR C OR D for course X\" evaluates to [any,[[A, B]], [A, C]]], [X,[[A,D]]]. Not all prerequisites will be this complex, and many will not include a study program field, but they can get quite lengthy.',
}


const requirementSchema = z.object({
    studyProgram: z.string(),
    requirements: z.object({
        preRequisiteCombinations: z.string().array().array(),
        // structured with extra room for additional requirements later on
    })
}).array();

export interface enrollRequirements {
    studyProgram: string;
    prerequisiteSubjectCodes?: string[][];
}

interface StateType {
    subjectData: SubjectData[];
    prunedSubjectData: SubjectData[];
    progressTracker?: TimerObjectType;
    model?: LLM;
}

const state = {
    subjectData: [],
    prunedSubjectData: [],
    progressTracker: undefined,
    model: undefined,
} as StateType;

async function startModel(){
    const client = new LMStudioClient();
    state.model = await client.llm.model(CONFIG.modelName);
    // await state.model.respond('test');
    console.log('Model loaded!')
}

async function queryModel(subject: SubjectData){
    if(state.model){
        const query = CONFIG.systemPrompt + `
        Prerequisites: ${subject.prerequisites}`;
        return state.model.respond(query, {structured: requirementSchema});
    }
    throw "No Model Loaded";
}

// Since both pruned and non-pruned are ordered, we can just scan through once and replace as we go
// this looks O(N^2) but it's actually O(N)
// This only works if state.subjectData has not had an element removed since prunedSubjectData was set,
//  as the removed element may cause the loop to get stuck
async function recombineSubjectData(){
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
        return subject.prerequisites;
    }) as SubjectData[] ?? [];
    await loadModelTask;
    state.progressTracker = startTrackingProgress(0,state.prunedSubjectData.length);
    for(let queryData of state.prunedSubjectData){
        console.log(`\nQuerying based on subject: ${queryData.subject}Prerequisites: ${queryData.prerequisites}`);
        const queryResult = await queryModel(queryData);
        queryData.prerequisites = queryResult.parsed as enrollRequirements[];
        console.log("Query Result: ",queryResult.content)
        state.progressTracker.progress++;
    }
    stopTrackingProgress(state.progressTracker);
}

main().then(async ()=>{
    console.log('Subject refinement complete!');
    await exitProcedure();
});

// We need a slightly more complex exit procedure to make sure the model doesn't stay loaded after usage.
// This procedure should be called any time the program must stop.
async function exitProcedure(){
    console.log("Shutting down...");
    if (state.model) {
        await state.model.unload();
        console.log("Model unloaded successfully");
    } else {
        console.log("No model to unload, skipping...");
    }
    console.log("Process has terminated gracefully.");
    process.exit(0);
}
