import neo4j, {Driver, ManagedTransaction, Session, Transaction} from 'neo4j-driver';
import 'dotenv/config';
import fs from "fs/promises";
import {Major, Minor, ProgramSummary, SubjectChoice, SubjectSummary} from "../../handbooks/WSU/2025/procedures/extract/programs/program-refiner";
import {normaliseSubjectCode, setConfig, startTrackingProgress, stopTrackingProgress} from "../util";
import {SubjectData} from "../../handbooks/WSU/2025/procedures/extract/subjects/subject-scraper";
import {EnrollRequirements} from "../../handbooks/WSU/2025/procedures/extract/subjects/subject-refiner";

enum SpecialisationType {
    testamurMajor = 0,
    major,
    minor,
    concentration,
    other,
}

export interface LogicalPrerequisite {
    course: string // Program | SpecialRequirement
    AND: {
        OR: string[] // Subject[]
    }[]
}

const globals = {
    subjects: [] as SubjectData[]
}

export interface nodeProperties {
    Program: {
        keyProps: {
            programName: string
        }
        dataProps?: {
            programLink: string
            programSequences: string[]
        }
    }
    Major: {
        keyProps: {
            majorName: string
        }
        dataProps?: {
            majorType: string
            majorLocations: string[]
            majorLink: string
        }
    }
    Minor: {
        keyProps: {
            minorName: string
        }
        dataProps?: {
            minorType: string
            minorLocations: string[]
            minorLink: string
        }
    }
    Subject: {
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
            teachingPeriods: string[]
        }
    }
    SubjectChoice: {
        // these nodes are abstractions of metadata, unfortunately there is no simple way to match on them
        keyProps: {
            choiceName: string // name
            choices: number
            parent: string // fk also acts as secondary key
        }
        dataProps?: {
            choiceSequences: string[]
        }
    }
    Prerequisites: {
        keyProps: {
            subjects: string // JSON
            course: string
            forSubject: string
        }
        dataProps?: {}
    }
}

export type PropsKey = keyof nodeProperties;

export interface Node<T extends PropsKey> {
    type: T
    props: nodeProperties[T]
}


type serialisedProps = { [key: string]: string };

let keyOf: serialisedProps = {}

/**
 * Wrapper function of generateSerialisedInterface for cleaner inline code.
 * @param node The node to serialise.
 * @returns The serialised key string.
 */
function serialiseKey(node: Node<PropsKey>): string {
    return generateSerialisedInterface(node, keyOf);
}

let dataOf: serialisedProps = {}

/**
 * Wrapper function of generateSerialisedInterface for cleaner inline code.
 * @param node The node to serialise.
 * @returns The serialised data string.
 */
function serialiseProps(node: Node<PropsKey>): string {
    return generateSerialisedInterface(node, dataOf, true);
}

/**
 * Serialises data portion of nodeProperties into Neo4J-friendly syntax during runtime.
 *
 * This method of serialisation forces that all (or none of the) possible fields be present in whatever object is being serialised,
 * the datastructure was already like this naturally, but is now an active constraint.
 * @param node The node to serialise
 * @param cache The variable to cache the serialised string into.
 * @param serialiseAll Serialise all props or just key (i.e. 'match on') props.
 */
function generateSerialisedInterface(node: Node<PropsKey>, cache: serialisedProps, serialiseAll = false): string {
    const type = node.type.toString();
    if (cache[type]) return cache[type];

    const keyProps = Object.keys(node.props.keyProps);
    const dataProps: string[] = serialiseAll ? Object.keys(node.props.dataProps ?? []) : [];
    const props = [...keyProps, ...dataProps];

    if (props && props.length > 0) {
        const serialisedResult = `${type} {${props.map(d => `${d}: $${d}`).join(', ')}}`;
        cache[type] = serialisedResult;
        return serialisedResult;
    } else throw ("Attempted to serialise node with no keys or data, this should never happen.");
}

/**
 * Inserts a string into another string, after each parameter placeholder.
 * @param value The original string.
 * @param addition The string to insert.
 * @returns The modified string.
 */
function insertString(value: string, addition: string) {
    return value.replace(/\$[A-z0-9_]*/g, `$&${addition}`);
}

/**
 * Creates a unique key-value pair for two nodes, handling potential naming conflicts.
 * @param nodeA The first node.
 * @param nodeB The second node.
 * @returns A combined object of key properties.
 */
function uniqueNodeKeyPair(nodeA: Node<PropsKey>, nodeB: Node<PropsKey>) {
    return {...nodeA.props.keyProps, ...uniqueKeyArgumentsOf(nodeB, nodeA)}
}

/**
 * Creates a unique data property pair for two nodes, handling potential naming conflicts.
 * @param nodeA The first node.
 * @param nodeB The second node.
 * @returns A combined object of data properties.
 */
function uniqueNodeDataPair(nodeA: Node<PropsKey>, nodeB: Node<PropsKey>) {
    return {...nodeA.props.dataProps, ...uniqueDataArgumentsOf(nodeB, nodeA)}
}

/**
 * Returns a unique key for a node, appending '2' if it has the same type as a comparator node.
 * @param subjectNode The node to get the key for.
 * @param comparatorNode The node to compare against.
 * @returns The unique key string.
 */
function uniqueKeyOf(subjectNode: Node<PropsKey>, comparatorNode: Node<PropsKey>) {
    // electric boogaloo
    return subjectNode.type === comparatorNode.type ? insertString(serialiseKey(subjectNode), '2') : serialiseKey(subjectNode);
}

/**
 * Returns a unique set of key arguments for a node, appending '2' to keys if it has the same type as a comparator node.
 * @param subjectNode The node to get the key arguments for.
 * @param comparatorNode The node to compare against.
 * @returns The unique key arguments object.
 */
function uniqueKeyArgumentsOf(subjectNode: Node<PropsKey>, comparatorNode: Node<PropsKey>) {
    const nodePropsString = JSON.stringify(subjectNode.props.keyProps);
    return (subjectNode.type === comparatorNode.type) ?
        JSON.parse(nodePropsString.replace(/"(?<main>[A-z0-9_-]*)":/g, '\"$<main>2\":')) /* Black-magic fuckery */
        : subjectNode.props.keyProps;
}

/**
 * Returns a unique property string for a node, appending '2' to property names if it has the same type as a comparator node.
 * @param subjectNode The node to get the property string for.
 * @param comparatorNode The node to compare against.
 * @returns The unique property string.
 */
function uniqueDataOf(subjectNode: Node<PropsKey>, comparatorNode: Node<PropsKey>) {
    // electric boogaloo
    return subjectNode.type === comparatorNode.type ? insertString(serialiseProps(subjectNode), '2') : serialiseProps(subjectNode);
}

/**
 * Returns a unique set of data arguments for a node, appending '2' to keys if it has the same type as a comparator node.
 * @param subjectNode The node to get the data arguments for.
 * @param comparatorNode The node to compare against.
 * @returns The unique data arguments object.
 */
function uniqueDataArgumentsOf(subjectNode: Node<PropsKey>, comparatorNode: Node<PropsKey>) {
    const nodePropsString = JSON.stringify(subjectNode.props.dataProps);
    return (subjectNode.type === comparatorNode.type) ?
        JSON.parse(nodePropsString.replace(/"(?<main>[A-z0-9_-]*)":/g, '\"$<main>2\":')) /* Black-magic fuckery */
        : subjectNode.props.dataProps;
}

/**
 * Retrieves the full subject data for a given subject summary.
 * @param subject The subject summary.
 * @returns The full SubjectData object.
 */
function getSubjectFromSummary(subject: SubjectSummary): SubjectData {
    return <SubjectData>globals.subjects.find(s => normaliseSubjectCode(s.code) === normaliseSubjectCode(subject.code));
}

export class DBUploader {
    private session: Session;
    private tx!: Transaction;

    public constructor(URI: string, USER: string) {
        const PASSWORD = process.env.NEO4J_PASSWORD ?? '';
        const driver: Driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
        driver.getServerInfo({database: 'neo4j'}).then((r) => {
            console.log(r)
            console.log('connected!')
        })
        this.session = driver.session({database: 'neo4j'});
    }

    public async beginTransaction(){
        this.tx = await this.session.beginTransaction();
        return this.tx.isOpen();
    }

    public async run(uploadActions: (tx: Transaction) => Promise<void>) {
        if(!this.tx) return Promise.reject('No transaction has been started.');
        await uploadActions(this.tx)
        await this.tx.close();
    }

    /**
     * Adds a node to the database.
     * @param tx The transaction to use.
     * @param node The node to add.
     */
    public async addNode<T extends PropsKey>(node: Node<T>) {
        const addNode = `MERGE (n:${serialiseProps(node)})`
        await this.tx.run(addNode, {
            ...node.props.keyProps,
            ...node.props.dataProps
        });
    }

    /**
     * Adds or appends a property to a node.
     * @param tx The transaction to use.
     * @param node The node to modify.
     * @param property The property to add or append.
     * @param append Whether to append the value if the property already exists.
     */
    public async addProperty<T extends PropsKey>(node: Node<T>, property: {
        name: string,
        value: string
    }, append: boolean = true) {
        const addProp = `MATCH (n:${serialiseKey(node)}) SET n.${property.name} =${append ? ` n.${property.name} +` : ''} '${property.value.replace(/['"]/g, '\\$&')}'`; // escape quotes, this should be done everywhere but I can't be bothered right now
        await this.tx.run(addProp, {
            ...node.props.keyProps
        })
    }

    /**
     * Links two nodes with a given relationship.
     * @param tx The transaction to use.
     * @param nodeA The starting node.
     * @param relation The relationship type.
     * @param nodeB The ending node.
     */
    public async linkNodes<T extends PropsKey>(nodeA: Node<T>, relation: string, nodeB: Node<T>) {
        const linkNodes = "MATCH " +
            `(a:${serialiseKey(nodeA)}),` +
            `(b:${uniqueKeyOf(nodeB, nodeA)})` +
            `MERGE (a)-[r:${relation}]->(b)`;
        await this.tx.run(linkNodes, {
            ...nodeA.props.keyProps,
            ...uniqueKeyArgumentsOf(nodeB, nodeA)
        });
    }

    /**
     * Links a node to another node by its ID.
     * @param tx The transaction to use.
     * @param node The starting node.
     * @param relation The relationship type.
     * @param id The ID of the ending node.
     */
    public async linkNodeToId<T extends PropsKey>(node: Node<T>, relation: string, id: string) {
        const linkNodes = "MATCH " +
            `(a:${serialiseKey(node)}),` +
            `(b) WHERE ID(b) = ${id} ` +
            `MERGE (a)-[r:${relation}]->(b)`;
        await this.tx.run(linkNodes, {
            ...node.props.keyProps
        });
    }

    /**
     * Links a node to a subject, taking into account the subject's prerequisites.
     * @param tx The transaction to use.
     * @param subject The subject summary.
     * @param subjectNode The subject node.
     * @param relationship The relationship type.
     * @param otherNode The other node to link from.
     */
    public async prerequisiteAwareLinkNodes<T extends PropsKey>(subject: SubjectSummary, subjectNode: Node<'Subject'>, relationship: string, otherNode: Node<T>) {
        let shouldLinkDirectlyToProgram;
        let prerequisiteNodeIds;
        const subjectData = getSubjectFromSummary(subject);
        if (!subjectData) {
            console.log(`Got undefined for ${subject.code}. Indicates bad scrape or subject discontinued. Making dummy node to link against.`);
            // todo should detect and prune these earlier? Or maybe leave them in as dummy nodes for students to decide
            //  what to do with, but they don't have any data attached so not sure how helpful it'll be :/
            subjectNode = {
                type: "Subject",
                props: {
                    keyProps: {
                        code: normaliseSubjectCode(subject.code)
                    },
                    dataProps: {
                        subjectName: subject.name ?? 'Unknown Subject',
                        prerequisites: subject.prerequisites ?? 'Unknown Prerequisites',
                        creditPoints: subject.creditPoints.toString() ?? 'Unknown',
                        coordinator: 'Unknown Coordinator',
                        description: 'Subject exists in handbook, but may not have a page yet. Please check manually.',
                        school: 'Unknown',
                        discipline: 'Unknown',
                        subjectLink: 'Unknown',
                        subjectSequences: [],
                        teachingPeriods: [],
                    }
                }
            }
            await this.addNode(subjectNode);
        }
        prerequisiteNodeIds = await this.getSubjectPrerequisiteNodeIds(subjectNode);
        shouldLinkDirectlyToProgram = prerequisiteNodeIds.length === 0;
        // Assert that subjectNode is in fact extending PropsKey,
        // because linter thinks Node<'subject'> only overlaps, not extend?
        if (shouldLinkDirectlyToProgram) {               // fixme if something breaks this is probably part of the problem
            await this.linkNodes(otherNode, relationship, <Node<T>>subjectNode);
        } else {
            // if not to directly linked to program, we need to put prerequisites in the middle
            for (let nodeId of prerequisiteNodeIds) {
                await this.linkNodeToId(otherNode, relationship, nodeId);
            }
        }
    }

    /**
     * Prepends a node to an existing relationship chain.
     * @param tx The transaction to use.
     * @param startNode The node to prepend.
     * @param relation The relationship type.
     * @param endNode The node at the end of the existing chain.
     */
    public async prependNode<T extends PropsKey>(startNode: Node<T>, relation: string, endNode: Node<T>) {
        const prependQuery = `MATCH (b)-[${relation}]->(c:${serialiseKey(endNode)})
                              MERGE (a:${serialiseKey(startNode)})
                              MERGE (a)-[:${relation}]->(b)`;
        await this.tx.run(prependQuery, {
            ...startNode.props.keyProps,
            ...endNode.props.keyProps
        })
    }

    /**
     * Checks if a connection exists between two nodes.
     * @param tx The transaction to use.
     * @param startNode The starting node.
     * @param endNode The ending node.
     * @returns True if a connection exists, false otherwise.
     */
    public async connectionExists(startNode: Node<PropsKey>, endNode: Node<PropsKey>) {
        const matchQuery = `MATCH (a:${serialiseKey(startNode)})-[r]-(b:${uniqueKeyOf(endNode, startNode)}) RETURN r`;
        const queryResult = await this.tx.run(
            matchQuery,
            uniqueNodeKeyPair(startNode, endNode)
        );
        return queryResult.records.length > 0;
    }

    /**
     * Checks if a specific relationship exists from a node.
     * @param tx The transaction to use.
     * @param startNode The starting node.
     * @param relation The relationship type.
     * @param endNode An optional ending node to check for.
     * @returns True if the relationship exists, false otherwise.
     */
    public async relationExists(startNode: Node<PropsKey>, relation: string, endNode?: Node<PropsKey>) {
        const matchQuery = `MATCH (a:${serialiseKey(startNode)})-[r:${relation}]-(b${endNode ? ':' + uniqueKeyOf(endNode, startNode) : ''}) RETURN r`;
        const queryResult = await this.tx.run(
            matchQuery,
            endNode ? uniqueNodeKeyPair(startNode, endNode) : {...startNode.props.keyProps}
        );
        return queryResult.records.length > 0;
    }

    /**
     * Removes the connection between two nodes.
     * @param tx The transaction to use.
     * @param startNode The starting node.
     * @param endNode The ending node.
     */
    public async removeConnection(startNode: Node<PropsKey>, endNode: Node<PropsKey>) {
        const removeQuery = `MATCH (a:${serialiseKey(startNode)})-[r]-(b:${uniqueKeyOf(endNode, startNode)}) DELETE r`;
        await this.tx.run(
            removeQuery,
            uniqueKeyArgumentsOf(endNode, startNode)
        );
    }

    /**
     * Merges and links a subject choice node to a parent node.
     * @param tx The transaction to use.
     * @param choiceData The subject choice data.
     * @param parentNode The parent node.
     */
    public async mergeAndLinkChoiceNode(choiceData: SubjectChoice, parentNode: Node<PropsKey>) {
        // convert SubjectSummary array to string if necessary, it's an easy key, a stupid one, sure, but it works :)
        const choiceDescription = JSON.stringify(choiceData.choices, null, 2);
        const parentKey = Object.values(parentNode.props.keyProps)[0] as string; // hacky as fuck, assumes choice can never be a parent

        const choiceNode: Node<'SubjectChoice'> = {
            type: 'SubjectChoice',
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
        await this.addNode(choiceNode);
        await this.linkNodes(parentNode, 'PROVIDES_SELECTION', choiceNode);

        // if we have a list of subjects instead of plain english instructions, attempt to link them directly
        if (typeof choiceData.choices !== 'string') {
            for (const sub of choiceData.choices) {
                const subjectData = getSubjectFromSummary(sub);
                if (!subjectData) {
                    // todo recursively scrape subject from choice selections that are missed
                    console.log(`WARN: COULD NOT FIND SUBJECT ${sub.code} FROM MASTER LIST, SOMETHING HAS GONE HORRIBLY WRONG!`);
                    continue;
                    //throw 'FATAL: COULD NOT FIND SUBJECT FROM MASTER LIST, SOMETHING HAS GONE HORRIBLY WRONG!';
                }
                const subjectNode: Node<'Subject'> = {
                    type: 'Subject',
                    props: {
                        keyProps: {code: normaliseSubjectCode(subjectData.code)},
                        dataProps: {
                            subjectName: subjectData.subject ?? 'none',
                            prerequisites: subjectData.originalPrerequisites ?? 'none',
                            creditPoints: subjectData.creditPoints?.toString() ?? 'none',
                            coordinator: subjectData.coordinator ?? 'none',
                            description: subjectData.description ?? 'none',
                            school: subjectData.school ?? 'none',
                            discipline: subjectData.discipline ?? 'none',
                            subjectLink: subjectData.link,
                            subjectSequences: [],
                            teachingPeriods: (subjectData.teachingPeriods ?? []).map(p => JSON.stringify(p))
                        }
                    }
                }
                await this.prerequisiteAwareLinkNodes(sub, subjectNode, 'REQUIRES_CHOICE', choiceNode);
            }
        }
    }

    /**
     * Adds a specialisation (major or minor) to the database and links it to its parent program.
     * @param tx The transaction to use.
     * @param specialisation The specialisation data.
     * @param type The type of specialisation ('major' or 'minor').
     * @param parentProgram The parent program node.
     */
    public async addSpecialisation(specialisation: Major | Minor, type: PropsKey, parentProgram: Node<'Program'>) {
        const specialisationNode: Node<typeof type> = {
            type: type,
            props: type === 'Major' ?
                {
                    keyProps: {majorName: specialisation.name},
                    dataProps: {
                        majorType: SpecialisationType[specialisation.type],
                        majorLocations: specialisation.locations,
                        majorLink: specialisation.link
                    }
                } :
                {
                    keyProps: {minorName: specialisation.name},
                    dataProps: {
                        minorType: SpecialisationType[specialisation.type],
                        minorLocations: specialisation.locations,
                        minorLink: specialisation.link
                    }
                }
        };
        await this.addNode(specialisationNode);
        for (const subject of specialisation.subjects) {
            if ('code' in subject) {
                const subjectNode: Node<'Subject'> = {
                    type: 'Subject',
                    props: {
                        keyProps: {code: normaliseSubjectCode(subject.code)}
                    }
                };
                if (await this.relationExists(subjectNode, 'PATHWAY_TO')) {
                    await this.prependNode(specialisationNode, 'REQUIRES_SUBJECT', subjectNode);
                } else {
                    await this.linkNodes(specialisationNode, 'REQUIRES_SUBJECT', subjectNode);
                }
            } else {
                await this.mergeAndLinkChoiceNode(subject, specialisationNode);
            }
        }
        await this.linkNodes(parentProgram, `HAS_${type.toUpperCase()}`, specialisationNode);
    }

    /**
     * Generates and adds prerequisite nodes for a subject.
     * @param tx The transaction to use.
     * @param subjectNode The subject node.
     * @param logicalPrerequisites The logical prerequisite data.
     */
    public async nodePrerequisiteGenerator(subjectNode: Node<"Subject">, logicalPrerequisites: LogicalPrerequisite[]) {
        const prerequisiteNodes = []
        for (let prerequisite of logicalPrerequisites) {
            const prerequisiteNode: Node<'Prerequisites'> = {
                type: 'Prerequisites',
                props: {
                    keyProps: {
                        course: prerequisite.course,
                        subjects: JSON.stringify(prerequisite.AND),
                        forSubject: normaliseSubjectCode(subjectNode.props.keyProps.code)
                    },
                    dataProps: {}
                }
            }
            prerequisiteNodes.push(prerequisiteNode);
            await this.addNode(prerequisiteNode);
            for (const subjectCode of prerequisite.AND.map(p => p.OR).flat()) {
                const prerequisiteSubjectNode: Node<'Subject'> = {
                    type: 'Subject',
                    props: {keyProps: {code: normaliseSubjectCode(subjectCode)}}
                }
                await this.linkNodes(prerequisiteSubjectNode, 'PREREQUISITE_FOR', prerequisiteNode);
            }
            await this.linkNodes(prerequisiteNode, 'PATHWAY_TO', subjectNode);
        }
    }

    /**
     * Gets the IDs of all prerequisite nodes for a given subject.
     * @param tx The transaction to use.
     * @param subjectNode The subject node.
     * @returns An array of prerequisite node IDs.
     */
    public async getSubjectPrerequisiteNodeIds(subjectNode: Node<'Subject'>) {
        const prerequisiteNodeQuery = `MATCH (a:${serialiseKey(subjectNode)})<--(b:Prerequisites) RETURN id(b) as ID`;
        return (await this.tx.run(prerequisiteNodeQuery, {...subjectNode.props.keyProps})).records.map(record => record.get('ID').low);
    }

    /**
     * Links a program to a subject or subject choice.
     * @param tx The transaction to use.
     * @param programNode The program node.
     * @param subject The subject or subject choice.
     */
    public async linkProgramToSubject(programNode: Node<"Program">, subject: SubjectChoice | SubjectSummary) {
        if ('code' in subject) {
            const subjectNode = {
                type: 'Subject',
                props: {
                    keyProps: {code: normaliseSubjectCode(subject.code)}
                }
            } as Node<'Subject'>
            await this.prerequisiteAwareLinkNodes(subject, subjectNode, 'REQUIRES_SUBJECT', programNode)
        } else {
            await this.mergeAndLinkChoiceNode(subject, programNode);
        }
    }
}
