import {Transaction} from 'neo4j-driver';
import 'dotenv/config';
import fs from "fs/promises";
import {ProgramSummary} from "../extract/programs/program-refiner";
import {normaliseSubjectCode, setConfig, startTrackingProgress, stopTrackingProgress} from "@/api/util";
import {SubjectData} from "../extract/subjects/subject-scraper";
import {DBUploader, LogicalPrerequisite, Node} from "@/api/neo4j/DBUploader";
import {dataDir} from "@/api/directories";

enum SpecialisationType {
    testamurMajor = 0,
    major,
    minor,
    concentration,
    other
}

/**
 * todo Add teaching period nodes and connect them to subject
 *      Add assessment data nodes and connect them to subject
 *      Investigate root cause of some orphan subjects being unrelated to majors/minors that they should be connected to
 */

const CONFIG = {
    inputPath: `${dataDir}/`,
    disableDBCommit: false,
}

const globals = {
    subjects: [] as SubjectData[]
}

/**
 * Main function to upload the scraped and refined data to the Neo4j database.
 */
async function main(){
    const db = new DBUploader('neo4j://localhost:7687', 'neo4j');
    let programSummaries = [] as ProgramSummary[];
    try{
        programSummaries = JSON.parse(await fs.readFile(CONFIG.inputPath+'programs-refined.json', {encoding: "utf-8"})) as ProgramSummary[];
        globals.subjects = JSON.parse(await fs.readFile(CONFIG.inputPath+'subjects-refined.json', {encoding: 'utf-8'})) as SubjectData[];
    } catch (e) {
        console.log('File read failed!')
        process.exit(-1)
    }
    if (!globals.subjects || !programSummaries) return;
    try {
        const transaction = (async (tx: Transaction) => {
            console.log('cleaning db');
            let pt = startTrackingProgress(0, 2);
            const deleteConnectedNodes = "match (a) -[r] -> () delete a, r";
            const deleteOrphans = "match (a) delete a";
            await tx.run(deleteConnectedNodes);
            pt.progress++;
            await tx.run(deleteOrphans);
            pt.progress++;
            stopTrackingProgress(pt);

            console.log('Adding subject nodes...')
            pt = startTrackingProgress(0,globals.subjects.length);
            for (const subject of globals.subjects){
                let logicalPrerequisites: LogicalPrerequisite[] = [];
                if (subject.prerequisites && typeof subject.prerequisites !== 'string'){
                    logicalPrerequisites = subject.prerequisites.map(p=>{
                        return {
                            course: p.course,
                            AND: p.prerequisites?.map(a=>{
                                return {OR: a}
                            }) ?? []
                        }
                    }).filter(Boolean)
                }
                const subjectNode: Node<'Subject'> = {
                    type: 'Subject',
                    props: {
                        keyProps: { code: normaliseSubjectCode(subject.code)},
                        dataProps: {
                            subjectName: subject.subject ?? 'none',
                            prerequisites: JSON.stringify(logicalPrerequisites,null,2) ?? subject.originalPrerequisites ?? 'none',
                            creditPoints: subject.creditPoints?.toString() ?? 'none',
                            coordinator: subject.coordinator ?? 'none',
                            description: subject.description ?? 'none',
                            school: subject.school ?? 'none',
                            discipline: subject.discipline ?? 'none',
                            subjectLink: subject.link,
                            subjectSequences: [],
                            teachingPeriods: (subject.teachingPeriods ?? []).map(p=>JSON.stringify(p))
                        }
                    }
                }
                await db.addNode(subjectNode);
                pt.progress++;
            }
            stopTrackingProgress(pt);

            console.log('Adding prerequisites...')
            pt = startTrackingProgress(0,globals.subjects.length);
            for (const subject of globals.subjects){
                let logicalPrerequisites: LogicalPrerequisite[] = [];
                if (subject.prerequisites && typeof subject.prerequisites !== 'string'){
                    logicalPrerequisites = subject.prerequisites.map(p=>{
                        return {
                            course: p.course,
                            AND: p.prerequisites?.map(a=>{
                                return {OR: a.map(o=>normaliseSubjectCode(o))}
                            }) ?? []
                        }
                    }).filter(Boolean)
                }
                const subjectNode: Node<'Subject'> = {
                    type: 'Subject',
                    props: {keyProps: { code: normaliseSubjectCode(subject.code) }}
                }
                if(logicalPrerequisites.length > 0) await db.nodePrerequisiteGenerator(subjectNode, logicalPrerequisites);
                pt.progress++;
            }
            stopTrackingProgress(pt);

            console.log('Adding programs, majors, and minors...')
            pt = startTrackingProgress(0, programSummaries.length);
            for (const program of programSummaries){
                // todo some programs in the refinement phase lose their sequence info, fix this later. Band-aid for now.
                if (program.sequences.length < 1) {
                    console.warn(`Skipping program ${program.name.replace(/[\n\t]/g,'')} due to no sequence data`)
                    continue;
                }
                const programNode: Node<'Program'> = {
                    type: 'Program',
                    props: {
                        keyProps: { programName: program.name },
                        dataProps: {
                            programLink: program.link,
                            programSequences: program.sequences.map(s=>s.name).flat()
                        }
                    }
                };
                await db.addNode(programNode);

                if(program.majors){
                    for (const major of program.majors){
                        await db.addSpecialisation(major, 'Major', programNode);
                    }
                }
                if(program.minors){
                    for (const minor of program.minors){
                        await db.addSpecialisation(minor, 'Minor', programNode);
                    }
                }

                const subjectSequencePairs = program.sequences.map(
                    sequence=>sequence.sequence.map(
                        year=>year.sessions.map(
                            session=> {
                                return {subjects: session.subjects, sequence: sequence.name}
                            }
                        )
                    )
                ).flat(2)
                for (const subjectSequencePair of subjectSequencePairs) {
                    for (const subject of subjectSequencePair.subjects){
                        if('code' in subject){
                            const subjectNode = {
                                type: 'Subject',
                                props: {
                                    keyProps: { code: normaliseSubjectCode(subject.code) }
                                }
                            } as Node<'Subject'>
                            await db.addProperty(subjectNode, {name: 'subjectSequences', value: `${program.name}:${subjectSequencePair.sequence}`})
                        } else {
                            const choiceNode = {
                                type: 'SubjectChoice',
                                props: {
                                    keyProps: {
                                        choiceName: subject.choices,
                                        choices: subject.numberToChoose,
                                        parent: program.name
                                    }
                                }
                            } as Node<'SubjectChoice'>
                            await db.addProperty(choiceNode, {name: 'choiceSequences', value: `${program.name}:${subjectSequencePair.sequence}`})
                        }
                        await db.linkProgramToSubject(programNode, subject);
                    }
                }

                pt.progress++;
            }
            stopTrackingProgress(pt);
            if(CONFIG.disableDBCommit) throw("Cancelling for testing"); // don't commit changes to local db
        });
        await db.run(transaction);
    } catch (e) {
        console.log('Transaction failed!\n'+e);
    }
}

setConfig(CONFIG.inputPath).then((r)=> {
        CONFIG.inputPath = r.inputFile ?? CONFIG.inputPath;
        main().then(() => {
            console.log('Script Execution Finished Without Errors!')
            process.exit(0);
        }).catch(e=>{
            console.log(e)
            process.exit(-1);
        })
    }
)
