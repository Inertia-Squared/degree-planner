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

export const keyOf = {
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
export const propsOf = {
    ['program']: 'Program {\n' +
        'programName: $programName,\n' +
        'programLink: $programLink,\n' +
        'programSequences: $programSequences' +
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
        'subjectLink: $subjectLink,\n' +
        'subjectSequences: $subjectSequences' +
        '}',
    ['choice']: 'SubjectChoice {\n' +
        'choiceName: $choiceName, \n' +
        'choices: $choices, \n' +
        'parent: $parent,\n' +
        'choiceSequences: $choiceSequences' +
        '}',
    ['prerequisites']: 'Prerequisites {\n' +
        'course: $course,\n' +
        'subjects: $subjects\n' +
        '}'
}

const globals = {
    subjects: [] as SubjectData[]
}

export interface nodeProperties {
    program: {
        keyProps: {
            programName: string
        }
        dataProps?: {
            programLink: string
            programSequences: string[]
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
            subjectSequences: string[]
        }
    }
    choice: {
        // these nodes are abstractions of metadata, unfortunately there is no simple way to match on them
        keyProps: {
            choiceName: string // name
            choices: number
            parent?: string // fk also acts as secondary key
        }
        dataProps?: {
            choiceSequences: string[]
        }
    }
    prerequisites: {
        keyProps: {
            subjects: string // JSON
            course: string
        }
        dataProps?: {}
    }
}

export type PropsKey = keyof nodeProperties;

export interface Node<T extends PropsKey> {
    type: T
    props: nodeProperties[T]
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

async function addProperty<T extends PropsKey>(tx: ManagedTransaction, node: Node<T>, property: {name: string, value: string}, append: boolean = true){
    const addProp = `MATCH (n:${keyOf[node.type]}) SET n.${property.name} =${append ? ` n.${property.name} +` : ''} '${property.value}'`;
    await tx.run(addProp, {
        ...node.props.keyProps
    })
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

async function linkNodeToId<T extends PropsKey>(tx: ManagedTransaction, node: Node<T>, relation: string, id: string){
    const linkNodes = "MATCH " +
        `(a:${keyOf[node.type]}),` +
        `(b) WHERE ID(b) = ${id} ` +
        `MERGE (a)-[r:${relation}]->(b)`;
    await tx.run(linkNodes, {
        ...node.props.keyProps
    });
}

async function prerequisiteAwareLinkNodes<T extends PropsKey>(tx: ManagedTransaction, subject: SubjectSummary, subjectNode: Node<'subject'>, relationship: string, otherNode: Node<T>){
    let shouldLinkDirectlyToProgram = true;
    let prerequisiteNodeIds = []
    const subjectData = getSubjectFromSummary(subject);
    if(subjectData){
        prerequisiteNodeIds = await getSubjectPrerequisiteNodeIds(tx, subjectNode);
        shouldLinkDirectlyToProgram = prerequisiteNodeIds.length === 0;
    } else {
        console.log(`Got undefined for ${subject.code}. Indicates bad scrape or subject discontinued.`);
        // todo should detect and prune these earlier? Or maybe leave them in as dummy nodes for students to decide
        //  what to do with, but they don't have any data attached so not sure how helpful it'll be :/
    }
                                                    // Assert that subjectNode is in fact extending PropsKey,
                                                    // because linter thinks Node<'subject'> only overlaps, not extend?
    if(shouldLinkDirectlyToProgram) {               // fixme if something breaks this is probably part of the problem
        await linkNodes(tx, otherNode, relationship, <Node<T>>subjectNode);
    } else {
        // if not to directly linked to program, we need to put prerequisites in the middle
        for (let nodeId of prerequisiteNodeIds) {
            await linkNodeToId(tx, otherNode, relationship, nodeId);
        }
    }
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
            },
            dataProps: {
                choiceSequences: []
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
            const subjectNode: Node<'subject'> = {
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
                        subjectLink: subjectData.link,
                        subjectSequences: []
                    }
                }
            }
            await prerequisiteAwareLinkNodes(tx, sub, subjectNode, 'INCLUDES_CHOICE', choiceNode);
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

async function nodePrerequisiteGenerator(tx: ManagedTransaction, subjectNode: Node<"subject">, logicalPrerequisites: LogicalPrerequisite[]){
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
}

async function getSubjectPrerequisiteNodeIds(tx: ManagedTransaction, subjectNode: Node<'subject'>){
    const prerequisiteNodeQuery = `MATCH (a:${keyOf[subjectNode.type]})<--(b:Prerequisites) RETURN id(b) as ID`;
    return (await tx.run(prerequisiteNodeQuery, {...subjectNode.props.keyProps})).records.map(record=>record.get('ID').low);
}

async function linkProgramToSubject(tx: ManagedTransaction, programNode: Node<"program">, subject: SubjectChoice | SubjectSummary) {
    if('code' in subject){
        const subjectNode = {
            type: 'subject',
            props: {
                keyProps: { code: subject.code }
            }
        } as Node<'subject'>
        await prerequisiteAwareLinkNodes(tx, subject, subjectNode, 'INCLUDES_SUBJECT', programNode)
    } else {
        await mergeAndLinkChoiceNode(tx, subject, programNode);
    }
}

async function main(){
    const URI = 'neo4j://localhost:7687';
    const USER = 'neo4j';
    const PASSWORD = process.env.NEO4J_PASSWORD ?? '';

    const driver: Driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
    await driver.getServerInfo({database: 'neo4j'}).then((r)=>{
        console.log(r)
        console.log('connected!')
    })

    const session = driver.session({database: 'neo4j'});
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
                            subjectLink: subject.link,
                            subjectSequences: []
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
                        dataProps: {
                            programLink: program.link,
                            programSequences: program.sequences.map(s=>s.name).flat()
                        }
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
                                type: 'subject',
                                props: {
                                    keyProps: { code: subject.code }
                                }
                            } as Node<'subject'>
                            await addProperty(tx, subjectNode, {name: 'subjectSequences', value: `${program.name}:${subjectSequencePair.sequence}`})
                        } else {
                            const choiceNode = {
                                type: 'choice',
                                props: {
                                    keyProps: {
                                        choiceName: subject.choices,
                                        choices: subject.numberToChoose,
                                        parent: program.name
                                    }
                                }
                            } as Node<'choice'>
                            await addProperty(tx, choiceNode, {name: 'choiceSequences', value: `${program.name}:${subjectSequencePair.sequence}`})
                        }
                        await linkProgramToSubject(tx, programNode, subject);
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
