import neo4j, {Driver, ManagedTransaction, QueryResult, Record, RecordShape} from 'neo4j-driver';
import 'dotenv/config';
import fs from "fs/promises";
import {Major, Minor, ProgramSummary, SubjectChoice, SubjectSummary} from "../programs/program-refiner";
import {highlight, regexMacros, setConfig, startTrackingProgress, stopTrackingProgress} from "../util";
import {SubjectData} from "../subjects/subject-scraper";
import {EnrollRequirements} from "../subjects/subject-refiner";
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
    inputPath: '../Automation/data/',
}

export interface LogicalPrerequisite {
    course: string
    AND: {
        OR: string[]
    }[]
}

const keyOf = {
    ['program']: 'Program {programName: $programName}',
    ['major']: 'Major {majorName: $majorName}',
    ['minor']: 'Minor {minorName: $minorName}',
    ['subject']: 'Subject {code: $code}',
    ['choice']: 'SubjectChoice {choiceName: $choiceName, choices: $choices, parent: $parent}',
    ['prerequisites']: 'Prerequisites {subjects: $subjects, course: $course}', // due to AI sometimes being silly, don't trust that we can always get a unique value based on properties, and force it to be accounted for in implementation
}

function insertString(value: string, addition: string){
    return value.replace(/\$[A-z0-9_]*/g, `$&${addition}`);
}

// todo create a function that automatically converts available parameters to the structure below
//  will allow for optional properties, and be easier to maintain
const propsOf = {
    ['program']: 'Program {\n' +
        'programName: $programName,\n' +
        'programLink: $programLink\n' +
        '}',
    ['major']: 'Major {\n' +
        'majorName: $majorName,\n' +
        'majorType: $majorType,\n' +
        'majorLocations: $majorLocations,\n' +
        'majorLink: $majorLink\n' +
        '}',
    ['minor']: 'Minor {\n' +
        'minorName: $minorName,\n' +
        'minorType: $minorType,\n' +
        'minorLocations: $minorLocations,\n' +
        'minorLink: $minorLink\n' +
        '}',
    ['subject']: 'Subject {\n' +
        'code: $code, \n' +
        'subjectName: $subjectName, \n' +
        'prerequisites: $prerequisites, \n' +
        'creditPoints: $creditPoints, \n' +
        'coordinator: $coordinator, \n' +
        'description: $description, \n' +
        'school: $school, \n' +
        'discipline: $discipline, \n' +
        'subjectLink: $subjectLink\n' +
        '}',
    ['choice']: 'SubjectChoice {\n' +
        'choiceName: $choiceName, \n' +
        'choices: $choices, \n' +
        'parent: $parent\n' +
        '}',
    ['prerequisites']: 'Prerequisites {\n' +
        'course: $course,\n' +
        'subjects: $subjects\n' +
        '}'
}

const globals = {
    subjects: [] as SubjectData[]
}

interface properties {
    program: {
        keyProps: {
            programName: string
        }
        dataProps?: {
            programLink: string
        }
    }
    major: {
        keyProps: {
            majorName: string
        }
        dataProps?: {
            majorType: string
            majorLocations: string[]
            majorLink: string
        }
    }
    minor: {
        keyProps: {
            minorName: string
        }
        dataProps?: {
            minorType: string
            minorLocations: string[]
            minorLink: string
        }
    }
    subject: {
        keyProps: {
            code: string // code
        }
        dataProps?: {
            subjectName: string
            prerequisites: string | EnrollRequirements[]
            creditPoints: string
            coordinator: string
            description: string
            school: string
            discipline: string
            subjectLink: string
        }
    }
    choice: {
        // these nodes are abstractions of metadata, unfortunately there is no simple way to match on them
        keyProps: {
            choiceName: string // name
            choices: number
            parent?: string // fk also acts as secondary key
        }
        dataProps?: {} // need to keep a placeholder here to ensure this field is available for generic access
    }
    prerequisites: {
        keyProps: {
            subjects: string // JSON
            course: string
        }
        dataProps?: {}
    }
}

type PropsKey = keyof properties;

interface Node<T extends PropsKey> {
    type: T
    props: properties[T]
}

function uniqueNodeKeyPair(nodeA: Node<PropsKey>, nodeB: Node<PropsKey>){
    return {...nodeA.props.keyProps, ...uniqueKeyArgumentsOf(nodeB, nodeA)}
}

function uniqueNodeDataPair(nodeA: Node<PropsKey>, nodeB: Node<PropsKey>){
    return {...nodeA.props.dataProps, ...uniqueDataArgumentsOf(nodeB,nodeA)}
}

function uniqueKeyOf(subjectNode: Node<PropsKey>, comparatorNode: Node<PropsKey>){
                                                                        // electric boogaloo
    return subjectNode.type === comparatorNode.type ? insertString(keyOf[subjectNode.type],'2') : keyOf[subjectNode.type];
}

function uniqueKeyArgumentsOf(subjectNode: Node<PropsKey>, comparatorNode: Node<PropsKey>){
    const nodePropsString = JSON.stringify(subjectNode.props.keyProps);
    return (subjectNode.type === comparatorNode.type) ?
        JSON.parse(nodePropsString.replace(/"(?<main>[A-z0-9_-]*)":/g,'\"$<main>2\":')) /* Black-magic fuckery */
        : subjectNode.props.keyProps;
}

function uniqueDataOf(subjectNode: Node<PropsKey>, comparatorNode: Node<PropsKey>){
    // electric boogaloo
    return subjectNode.type === comparatorNode.type ? insertString(propsOf[subjectNode.type],'2') : propsOf[subjectNode.type];
}

function uniqueDataArgumentsOf(subjectNode: Node<PropsKey>, comparatorNode: Node<PropsKey>){
    const nodePropsString = JSON.stringify(subjectNode.props.dataProps);
    return (subjectNode.type === comparatorNode.type) ?
        JSON.parse(nodePropsString.replace(/"(?<main>[A-z0-9_-]*)":/g,'\"$<main>2\":')) /* Black-magic fuckery */
        : subjectNode.props.dataProps;
}

function getSubjectFromSummary(subject: SubjectSummary): SubjectData {
    return <SubjectData>globals.subjects.find(s => s.code === subject.code);
}

async function addNode<T extends PropsKey>(tx: ManagedTransaction, node: Node<T>){
    const addNode = `MERGE (n:${propsOf[node.type]})`
    await tx.run(addNode, {
        ...node.props.keyProps,
        ...node.props.dataProps
    });
}

async function linkNodes<T extends PropsKey>(tx: ManagedTransaction, nodeA: Node<T>, relation: string,  nodeB: Node<T>){
    const linkNodes = "MATCH " +
        `(a:${keyOf[nodeA.type]}),` +
        `(b:${uniqueKeyOf(nodeB, nodeA)})` +
        `MERGE (a)-[r:${relation}]->(b)`;
    await tx.run(linkNodes, {
        ...nodeA.props.keyProps,
        ...uniqueKeyArgumentsOf(nodeB, nodeA)
    });
}

async function prependNode<T extends PropsKey>(tx: ManagedTransaction, startNode: Node<T>, relation: string, endNode: Node<T>){
    const prependQuery = `MATCH (b)-[${relation}]->(c:${keyOf[endNode.type]})
                          MERGE (a:${keyOf[startNode.type]})
                          MERGE (a)-[:${relation}]->(b)`;
    await tx.run(prependQuery,{
        ...startNode.props.keyProps,
        ...endNode.props.keyProps
    })
}

async function connectionExists(tx: ManagedTransaction, startNode: Node<PropsKey>, endNode: Node<PropsKey>) {
    const matchQuery = `MATCH (a:${keyOf[startNode.type]})-[r]-(b:${uniqueKeyOf(endNode, startNode)}) RETURN r`;
    const queryResult = await tx.run(
        matchQuery,
        uniqueNodeKeyPair(startNode,endNode)
    );
    return queryResult.records.length > 0;
}

async function relationExists(tx: ManagedTransaction, startNode: Node<PropsKey>, relation: string, endNode?: Node<PropsKey>) {
    const matchQuery = `MATCH (a:${keyOf[startNode.type]})-[r:${relation}]-(b${endNode ? ':' + uniqueKeyOf(endNode, startNode) : ''}) RETURN r`;
    const queryResult = await tx.run(
        matchQuery,
        endNode ? uniqueNodeKeyPair(startNode, endNode) : {...startNode.props.keyProps}
    );
    return queryResult.records.length > 0;
}

async function removeConnection(tx: ManagedTransaction, startNode: Node<PropsKey>, endNode: Node<PropsKey>){
    const removeQuery = `MATCH (a:${keyOf[startNode.type]})-[r]-(b:${uniqueKeyOf(endNode, startNode)}) DELETE r`;
    await tx.run(
        removeQuery,
        uniqueKeyArgumentsOf(endNode, startNode)
    );
}

// type Direction = '<--' | '--' | '-->'
//
// async function getConnectedNodes(tx: ManagedTransaction, node: Node<PropsKey>, direction: Direction = '--'){
//     const connectedQuery = `MATCH (a:${keyOf[node.type]})${direction}(b) RETURN b`
//     const queryResult = await tx.run(connectedQuery, {...node.props.keyProps});
//     for (let record of queryResult.records) {
//         await convertRecordToNode(record);
//     }
// }
//
// async function convertRecordToNode<R extends RecordShape>(record: Record<R>){
//     highlight('getting record...')
//     console.log(record.get('b'))
//     highlight('got record!')
//     // todo finish when required
// }
//
// async function injectNode(tx: ManagedTransaction, startNode: Node<PropsKey>, relation1: string, injectedNode: Node<PropsKey>, relation2: string, endNode: Node<PropsKey>){
//     const nodesConnected = await connectionExists(tx, startNode, endNode);
//     if (nodesConnected) {
//         await removeConnection(tx, startNode, endNode);
//         await linkNodes(tx, startNode, relation1, injectedNode);
//         await linkNodes(tx, injectedNode, relation2, endNode);
//     } else {
//         console.log('WARN: Attempted to inject non-existing connection. THIS SHOULD NOT HAPPEN!!!')
//     }
// }
//
// async function injectNodes(tx: ManagedTransaction, startNode: Node<PropsKey>, relation1: string, injectedNodes: Node<PropsKey>[], relation2: string, endNode: Node<PropsKey>){
//     const nodesConnected = await connectionExists(tx, startNode, endNode);
//     if (nodesConnected) {
//         await removeConnection(tx, startNode, endNode);
//         for (const injectedNode of injectedNodes) {
//             await linkNodes(tx, startNode, relation1, injectedNode);
//         }
//         for (const injectedNode of injectedNodes) {
//             await linkNodes(tx, injectedNode, relation2, endNode);
//         }
//     } else {
//         console.log('WARN: Attempted to inject non-existing connection. THIS SHOULD NOT HAPPEN!!!')
//     }
// }

async function mergeAndLinkChoiceNode(tx: ManagedTransaction, choiceData: SubjectChoice, parentNode: Node<PropsKey>){
    // convert SubjectSummary array to string if necessary, it's an easy key, a stupid one, sure, but it works :)
    const choiceDescription = JSON.stringify(choiceData.choices,null,2);
    const parentKey = Object.values(parentNode.props.keyProps)[0] as string; // hacky as fuck, assumes choice can never be a parent

    const choiceNode: Node<'choice'> = {
        type: 'choice',
        props: {
            keyProps: {
                choiceName: choiceDescription,
                choices: choiceData.numberToChoose,
                parent: parentKey ?? 'none'
            }
        }
    }
    await addNode(tx, choiceNode);
    await linkNodes(tx, parentNode, 'PROVIDES_SELECTION', choiceNode);

    // if we have a list of subjects instead of plain english instructions, attempt to link them directly
    if (typeof choiceData.choices !== 'string'){
        for (const sub of choiceData.choices){
            const subjectData = getSubjectFromSummary(sub);
            if(!subjectData) {
                // todo recursively scrape subject from choice selections that are missed
                console.log(`WARN: COULD NOT FIND SUBJECT ${sub.code} FROM MASTER LIST, SOMETHING HAS GONE HORRIBLY WRONG!`);
                continue;
                //throw 'FATAL: COULD NOT FIND SUBJECT FROM MASTER LIST, SOMETHING HAS GONE HORRIBLY WRONG!';
            }
            await linkNodes(tx, choiceNode, 'INCLUDES_CHOICE', {
                type: 'subject',
                props: {
                    keyProps: { code: subjectData.code },
                    dataProps: {
                        subjectName: subjectData.subject ?? 'none',
                        prerequisites: subjectData.originalPrerequisites ?? 'none',
                        creditPoints: subjectData.creditPoints?.toString() ?? 'none',
                        coordinator: subjectData.coordinator ?? 'none',
                        description: subjectData.description ?? 'none',
                        school: subjectData.school ?? 'none',
                        discipline: subjectData.discipline ?? 'none',
                        subjectLink: subjectData.link
                    }
                }
            })
        }
    }
}

async function addSpecialisation(tx: ManagedTransaction, specialisation: Major | Minor, type: PropsKey, parentProgram: Node<'program'>){
    const specialisationNode: Node<typeof type> = {
        type: type,
        props: type === 'major' ?
            {
                keyProps: { majorName: specialisation.name },
                dataProps: {
                    majorType: SpecialisationType[specialisation.type],
                    majorLocations: specialisation.locations,
                    majorLink: specialisation.link
                }
            } :
            {
                keyProps: { minorName: specialisation.name },
                dataProps: {
                    minorType: SpecialisationType[specialisation.type],
                    minorLocations: specialisation.locations,
                    minorLink: specialisation.link
                }
            }
    };
    await addNode(tx, specialisationNode);
    for (const subject of specialisation.subjects){
        if ('code' in subject){
            const subjectNode: Node<'subject'> = {
                type: 'subject',
                props: {
                    keyProps: { code: subject.code }
                }
            };
            if(await relationExists(tx, subjectNode, 'PATHWAY_TO')){
                await prependNode(tx, specialisationNode, 'PATHWAY_TO', subjectNode);
            }  else {
                await linkNodes(tx, specialisationNode, 'INCLUDES_SUBJECT', subjectNode);
            }
        } else {
            await mergeAndLinkChoiceNode(tx, subject, specialisationNode);
        }
    }
    await linkNodes(tx, parentProgram, `HAS_${type.toUpperCase()}`, specialisationNode);
}

function normaliseSubjectCode(code: string){
    if (code.match(regexMacros.noWhiteSpaceCode)){
        return code.replace(code.slice(0,4), code.slice(0,4)+' ');
    }
}

// don't care about relations, just connect subjects by prerequisites
async function simplePrerequisiteGenerator(tx: ManagedTransaction, subjectNode: Node<"subject">, logicalPrerequisites: LogicalPrerequisite[]){
    const subjectCodes = logicalPrerequisites.map(p=>p.AND.map(p2=>p2.OR)).flat(2);
    for (let code of subjectCodes){
        const normCode = normaliseSubjectCode(code) ?? '';
        if(normCode.match(regexMacros.subjectCode)) {
            code = normCode;
        }
        if (!code.match(regexMacros.subjectCode)) { // todo handle 'SPECIAL' cases here
            console.log(`Invalid code ${code}, skipping`);
            continue;
        }
        const prerequisiteNode: Node<'subject'> = {
            type: 'subject',
            props: {
                keyProps: {
                    code: code
                }
            }
        };
        await linkNodes(tx, prerequisiteNode, 'PREREQUISITE_OF', subjectNode);
    }
}

async function nodePrerequisiteGenerator(tx: ManagedTransaction, subjectNode: Node<"subject">, logicalPrerequisites: LogicalPrerequisite[]){
    let count = 0;
    const prerequisiteNodes = []
    for(let prerequisite of logicalPrerequisites){
        const prerequisiteNode: Node<'prerequisites'> = {
            type: 'prerequisites',
            props: {
                keyProps: {
                    course: prerequisite.course,
                    subjects: JSON.stringify(prerequisite.AND)
                },
                dataProps: {}
            }
        }
        prerequisiteNodes.push(prerequisiteNode);
        await addNode(tx, prerequisiteNode);
        for (const subjectCode of prerequisite.AND.map(p=>p.OR).flat()) {
            const prerequisiteSubjectNode: Node<'subject'> = {
                type: 'subject',
                props: { keyProps: {code: subjectCode} }
            }
            await linkNodes(tx, prerequisiteSubjectNode, 'PREREQUISITE_FOR', prerequisiteNode);
        }
        await linkNodes(tx, prerequisiteNode, 'PATHWAY_TO', subjectNode);
    }
    // // todo get each node connected with a relation directed towards subjectNode, and inject prerequisite nodes
    // for (const n of prerequisiteNodes) {
    //     await getConnectedNodes(tx, n, '<--');
    // }
}

async function main(){
    const URI = 'neo4j://localhost:7687';
    const USER = 'neo4j';
    const PASSWORD = process.env.NEO4J_PASSWORD ?? '';

    const driver: Driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
    await driver.getServerInfo({database: 'subset-it-programs'}).then((r)=>{
        console.log(r)
        console.log('connected!')
    })

    const session = driver.session({database: 'subset-it-programs'});
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
        await session.executeWrite(async tx => {
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
                const subjectNode: Node<'subject'> = {
                    type: 'subject',
                    props: {
                        keyProps: { code: subject.code },
                        dataProps: {
                            subjectName: subject.subject ?? 'none',
                            prerequisites: JSON.stringify(logicalPrerequisites,null,2) ?? subject.originalPrerequisites ?? 'none',
                            creditPoints: subject.creditPoints?.toString() ?? 'none',
                            coordinator: subject.coordinator ?? 'none',
                            description: subject.description ?? 'none',
                            school: subject.school ?? 'none',
                            discipline: subject.discipline ?? 'none',
                            subjectLink: subject.link
                        }
                    }
                }
                await addNode(tx, subjectNode);
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
                                return {OR: a}
                            }) ?? []
                        }
                    }).filter(Boolean)
                }
                const subjectNode: Node<'subject'> = {
                    type: 'subject',
                    props: {keyProps: { code: subject.code }}
                }
                if(logicalPrerequisites.length > 0) await nodePrerequisiteGenerator(tx, subjectNode, logicalPrerequisites);
                pt.progress++;
            }
            stopTrackingProgress(pt);

            console.log('Adding programs, majors, and minors...')
            pt = startTrackingProgress(0, programSummaries.length);
            for (const program of programSummaries){
                const programNode: Node<'program'> = {
                    type: 'program',
                    props: {
                        keyProps: { programName: program.name },
                        dataProps: { programLink: program.link }
                    }
                };
                await addNode(tx, programNode);
                if(program.majors){
                    for (const major of program.majors){
                        await addSpecialisation(tx, major, 'major', programNode);
                    }
                }
                if(program.minors){
                    for (const minor of program.minors){
                        await addSpecialisation(tx, minor, 'minor', programNode);
                    }
                }

                for (let sequence of program.sequences){
                    for (let year of sequence.sequence){
                        for (let session of year.sessions){
                            for (let subject of session.subjects){
                                if('code' in subject){
                                    const subjectNode = {
                                        type: 'subject',
                                        props: {
                                            keyProps: { code: subject.code }
                                        }
                                    } as Node<'subject'>
                                    await linkNodes(tx, programNode, 'INCLUDES_SUBJECT', subjectNode);
                                } else {
                                    await mergeAndLinkChoiceNode(tx, subject, programNode);
                                }
                            }
                        }
                    }
                }
                pt.progress++;
            }
            stopTrackingProgress(pt);
        })
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
