// app/page.tsx
'use client'
import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";
import {GraphEdge, GraphNode, LayoutTypes} from 'reagraph';
import LineupSelector from "@/components/LineupSelector";
import {getProgramsInterface} from "@/app/api/graph/getPrograms/route";
import {getConnectedNodesInterface} from "@/app/api/graph/getConnected/route";
import {HEXGBA, nodeFillMap, NodeTypes} from "@/lib/siteUtil";
import InfoPanel from "@/components/InfoPanel";
import {
    BsArrowUpShort,
    BsGithub,
    BsQuestion
} from "react-icons/bs";

import {
    filterDisconnectedEdges, filterImpossiblePrerequisites, filterLeafPrerequisites,
    filterPrerequisitesNotInCourse,
    filterSubjectsNotInSequence
} from "@/lib/graph/graphFilters";
import {
    isEligibleForSubject,
    isRequiredByProgramOrSpecialisation,
    prerequisiteIsFulfilled, RequiredType
} from "@/lib/graph/graphColours";
import {getParentsByType} from "@/lib/graph/graphUtil";
import {CourseTimeline} from "@/components/CourseTimeline";
import {SpecialisationType} from "../../../majors-minors/major-minor-scraper";
import {PiGraphBold} from "react-icons/pi";
import {BiSearch} from "react-icons/bi";

// todo fix failure-case for Ba. of Arts, Ma. 0026 & Mi. 0024

const ForceGraph = dynamic(() => import('../components/ForceGraph'), {
    ssr: false,
});

function containsAll(object: any, components: string[]){
    let missingComponent = false;
    components.forEach((component)=>{
        if (!(component in object)) {
            missingComponent = true;
        }
    })
    return !missingComponent;
}

export interface ExtendedNode<T> extends GraphNode {
     data: T
}

export function isExtendedNode(obj: any): obj is ExtendedNode<any> {
    return 'data' in obj;
}

export interface Generic {
    type: NodeTypes
}
export function isGenericNode(obj: any): obj is ExtendedNode<Generic>{
    return isExtendedNode(obj) && containsAll(obj.data, ['type']);
}

export interface Subject extends Generic{
    type: 'Subject'
    code: string,
    prerequisites: string
    subjectSequences: string[]
    teachingPeriods: string[]
}
export function isSubjectNode(obj: any): obj is ExtendedNode<Subject>{
    return isGenericNode(obj) && containsAll(obj.data, ['code','prerequisites','subjectSequences', 'teachingPeriods']);
}

export interface Program extends Generic{
    type: 'Program'
    programName: string,
    programSequences: string[]
}
export function isProgramNode(obj: any): obj is ExtendedNode<Program>{
    return isGenericNode(obj) && containsAll(obj.data,['programName','programSequences']);
}

export interface Prerequisite extends Generic {
    type: 'Prerequisites'
    course: string
    subjects: string
    forSubject: string
}
export function isPrerequisiteNode(obj: any): obj is ExtendedNode<Prerequisite>{
    return isGenericNode(obj) && containsAll(obj.data, ['course', 'subjects', 'forSubject']);
}

export interface Major extends Generic {
    type: 'Major'
    majorName: string
    majorType: SpecialisationType | string
    majorLocations: string[]
    majorLink: string
    programConnectionId?: string
}
export function isMajorNode(obj: any): obj is ExtendedNode<Major>{
    return isGenericNode(obj) && containsAll(obj.data, ['majorName', 'majorType', 'majorLocations', 'majorLink']);
}

export interface Minor extends Generic {
    type: 'Minor'
    minorName: string
    minorType: SpecialisationType | string
    minorLocations: string[]
    minorLink: string
    programConnectionId?: string
}
export function isMinorNode(obj: any): obj is ExtendedNode<Minor>{
    return isGenericNode(obj) && containsAll(obj.data, ['minorName', 'minorType', 'minorLocations', 'minorLink']);
}

export interface Choice extends Generic {
    type: 'SubjectChoice'
    choiceName: string
    parent: string
}
export function isChoiceNode(obj: any): obj is ExtendedNode<Choice> {
    return isGenericNode(obj) && containsAll(obj.data, ['choiceName', 'parent']);
}

export function showNodeInfo(node: ExtendedNode<any>){
    console.log(`Info on Node | Is Generic: ${isGenericNode(node)}, 
    Is Subject: ${isSubjectNode(node)}, Is Program: ${isProgramNode(node)}, 
    Is Prerequisite: ${isPrerequisiteNode(node)}`)
}

enum OfferStatus {
    NO,
    YES,
    UNKNOWN
}

const badClusterOptions = [
    'subjectSequences',
    'programSequences',
    'choiceSequences',
    'description',
    'subjectLink',
    'programLink',
    'majorLink',
    'minorLink',
    'code',
    'prerequisites',
    'creditPoints',
    'subjectName',
    'teachingPeriods',
]

export interface StudyPeriodItem {
    period: StudyPeriod
    subjectsTaken: ExtendedNode<Subject>[]
}

const displayMode: LayoutTypes = 'forceDirected2d';

export type StudyPeriod = 'autumn' | 'spring' | 'unknown';
const studyPeriods: StudyPeriod[] = ['autumn','spring','unknown'];

export function asStudyPeriod(period: string){
    const value = studyPeriods.find(s=>period.toLowerCase().includes(s));
    if (!value){
        return 'unknown';
    }
    return value;
}

const colours = {
    inaccessible: '#AAAAAA'
}

export default function Home() {
    const [nodes, setNodes] = useState<ExtendedNode<Generic>[]>([]);
    const [displayedNodes, setDisplayedNodes] = useState<ExtendedNode<Generic>[]>([]);
    const [nodeMap, setNodeMap] = useState<Map<string, ExtendedNode<Generic>>>(new Map());
    const [adjacencyList, setAdjacencyList] = useState<Map<string, string[]>>(new Map())
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [displayedEdges, setDisplayedEdges] = useState<GraphEdge[]>([]);
    const [addedNodes, setAddedNodes] = useState<ExtendedNode<Generic>[]>([]);

    const [clusterOptions, setClusterOptions] = useState(['select a node to see cluster options']);
    const [clusterBy, setClusterBy] = useState<string | undefined>(undefined);
    const [selectedElement, setSelectedElement] = useState<ExtendedNode<Generic> | GraphEdge | undefined>(undefined);

    const [selectedProgram, setSelectedProgram] = useState<ExtendedNode<Program> | undefined>(undefined);
    const [selectedProgramSequence, setSelectedProgramSequence] = useState<string | undefined>(undefined);

    const [showPotentialElectives, setShowPotentialElectives] = useState<boolean>(false);

    const [startPeriod, setStartPeriod] = useState<StudyPeriod>('autumn');

    const [completedPeriods, setCompletedPeriods] = useState<StudyPeriodItem[]>([])

    const [currentPeriod, setCurrentPeriod] = useState<StudyPeriodItem>({
        period: startPeriod,
        subjectsTaken: []
    });

    const [showLineup, setShowLineup] = useState<boolean>(false);
    const [firstShowLineup, setFirstShowLineup] = useState<boolean>(true);

    const [updateToggle, setUpdateToggle] = useState<boolean>(false);

    const [showSequences, setShowSequences] = useState<boolean>(true);

    const [subjectsTaken, setSubjectsTaken] = useState<ExtendedNode<Subject>[]>([]);

    const [showKey, setShowKey] = useState<boolean>(false);
    const [firstShowKey, setFirstShowKey] = useState<boolean>(true);

    const [showHelp, setShowHelp] = useState<boolean>(false);
    const [firstShowHelp, setFirstShowHelp] = useState<boolean>(true);


    const searchProgram = async (searchString: string)=>{
        const response = await fetch(`/api/graph/getPrograms?programName=${searchString}`);
        if (!response.ok) {
            throw new Error(`Failed to get programs at /api/graph/getPrograms with search string ${searchString}`);
        }

        const data = await response.json() as getProgramsInterface;
        if(data.programs !== nodes) setNodes(data.programs);
        setSelectedProgram(data.programs[0] as ExtendedNode<Program>);
        setSelectedProgramSequence(data.programs[0].data.programSequences[0]);
    }

    const forceAddSpecialisation = (node: ExtendedNode<Major | Minor>) => {
        if(!node.data.programConnectionId || !selectedProgram) return;
        if (nodes.includes(node)) return;
        node.size = 40;
        const newNodes = [...nodes.filter(n=>n.data.type !== node.data.type), node];
        setNodes(newNodes);
        const newEdgeId = node.data.programConnectionId + ":" + selectedProgram.id + node.id;
        const newEdge: GraphEdge = {
            id: newEdgeId,
            source: selectedProgram.id,
            target: node.id,
            label: 'HAS_SPECIALISATION',
        };
        const newEdges = [...edges.filter(e=>newNodes.find(n=>n.id===e.target)), newEdge];
        setEdges(newEdges);
    }

    function isOfferedInCurrentPeriod(node: ExtendedNode<Subject>): OfferStatus {
        if (!node.data.teachingPeriods || node.data.teachingPeriods.length < 1) return OfferStatus.UNKNOWN;
        let offerStatus: OfferStatus = OfferStatus.NO;
        node.data.teachingPeriods.map(p=>{
            if (offerStatus === OfferStatus.NO && asStudyPeriod(p) === 'unknown') offerStatus = OfferStatus.UNKNOWN;
            if (asStudyPeriod(p) === currentPeriod.period) offerStatus = OfferStatus.YES;
        });
        return offerStatus;
    }

    function getNodeFromId(id: string){
        return nodes.find(n=>n.id===id);
    }

    async function startExploring(){
        const newNodes = nodes.filter(n=>isProgramNode(n)||isMinorNode(n)||isMajorNode(n));
        setNodes(newNodes);
        setFirstShowLineup(false);
        setShowLineup(false);
        expandConnected(newNodes);
    }

    function selectElement(id: string, isNode: boolean = true) {
        const element =
            isNode ? nodes.find(n=>n.id===id) : edges.find(e=>e.id===id);
        setSelectedElement(element);
        if(isNode) {
            if (element && isProgramNode(element)) {
                setSelectedProgram(element);
                const sequences = element.data['programSequences'];
                if (sequences.length > 0) setSelectedProgramSequence(sequences[0])
            }
            setClusterOptions(Object.keys(element?.data).filter(key=>!badClusterOptions.find(o=>o==key)));
        }
    }

    function getCompletedSubjects(){
        return completedPeriods.map(p=>p.subjectsTaken).flat();
    }

    function hasTaken(node: ExtendedNode<Generic>){
        return subjectsTaken.includes(node as ExtendedNode<Subject>);
    }

    function onNodeDoubleClicked(id: string){
        // console.log('Checking node...')
        setUpdateToggle(!updateToggle);
        const node = getNodeFromId(id);
        if (node && isSubjectNode(node)){
            if (hasTaken(node)) {
                return;
            }
            const parentPrerequisites = getParentsByType<Prerequisite>(node, nodes, adjacencyList, nodeMap, 'Prerequisites').filter(p=>p.data.forSubject===(node).data.code);
            if (!isEligibleForSubject(parentPrerequisites, getCompletedSubjects()) || isOfferedInCurrentPeriod(node) === OfferStatus.NO) {
                return;
            }
            setShowSequences(false);
            let newCurrentPeriod = currentPeriod;
            newCurrentPeriod.subjectsTaken = [...newCurrentPeriod.subjectsTaken, node];
            setSubjectsTaken([...subjectsTaken, node]);
            if ((newCurrentPeriod.subjectsTaken.length) % 4 === 0) {
                moveToNewPeriod(newCurrentPeriod);
            } else {
                setCurrentPeriod(newCurrentPeriod);
            }
        }
    }

    function moveToNewPeriod(oldCurrentPeriod: StudyPeriodItem){
        const newCompletedPeriods = completedPeriods ?? [];
        newCompletedPeriods.push(oldCurrentPeriod);

        if ((completedPeriods.length) % 2 === 0) {
            setCompletedPeriods(newCompletedPeriods);
            setCurrentPeriod({
                period: startPeriod,
                subjectsTaken: []
            });
        } else {
            setCompletedPeriods(newCompletedPeriods);
            setCurrentPeriod({
                period: startPeriod === 'autumn' ? 'spring' : 'autumn',
                subjectsTaken: []
            });
        }
    }

    function resetSelectedElement(){
        setSelectedElement(undefined);
        setClusterOptions(['select a node to see cluster options']);
        setClusterBy(undefined)
    }

    /**
     * Filters out all nodes of a type excluding the one selected.
     * Selected node is excluded as this function is intended to be a way to narrow down options.
     * @param excludeId
     * @param filterType
     * @param graph
     */
    function chooseNode(excludeId: string, filterType: NodeTypes, graph: { oldNodes: ExtendedNode<Generic>[], oldEdges: GraphEdge[]}){
        const nodesToRemove = new Set<string>();

        // Initial nodes to remove based on the filterType
        graph.oldNodes.forEach(n => {
            if (n.data.type === filterType && n.id !== excludeId) {
                nodesToRemove.add(n.id);
            }
        });

        // Recursively find and mark all children for removal
        let  newNodesAdded = true;
        while (newNodesAdded) {
            newNodesAdded = false;
            graph.oldEdges.forEach(edge => {
                if (nodesToRemove.has(edge.source) && ! nodesToRemove.has(edge.target)) {
                    nodesToRemove.add(edge.target);
                    newNodesAdded = true;
                }
            });
        }

        // Filter out the marked nodes and their  edges
        graph.oldNodes = graph.oldNodes.filter(n => !nodesToRemove.has(n.id));
        graph.oldEdges = graph.oldEdges.filter(e => !nodesToRemove.has(e.source) && !nodesToRemove.has(e.target));

        return graph;
    }

    async function addConnected(params: {id: string}): Promise<void>;
    async function addConnected(params: {manualAdd: {newNodes: ExtendedNode<Generic>[], newEdges: GraphEdge[]}}): Promise<void>;

    async function addConnected(params: {id?: string, manualAdd?: { newNodes: ExtendedNode<Generic>[], newEdges: GraphEdge[] }
    }) {
        let newNodes;
        let newEdges;
        if (params.id) {
            let oldNodes = nodes;
            let oldEdges = edges;
            let result;
            switch (getNodeFromId(params.id)?.data.type) {
                case 'Program':
                    result = chooseNode(params.id, 'Program', {oldNodes, oldEdges})
                    break;
                case 'Major':
                    result = chooseNode(params.id, 'Major', {oldNodes, oldEdges})
                    break;
                case 'Minor':
                    result = chooseNode(params.id, 'Minor', {oldNodes, oldEdges})
                    break;
            }
            if (result){
                oldNodes = result.oldNodes;
                oldEdges = result.oldEdges;
            }
            const connected = await getConnected(params.id);

            newNodes = [...oldNodes,...connected.newNodes]
            newEdges = [...oldEdges, ...connected.newEdges]
        } else if(params.manualAdd) {
            newNodes = [...nodes,...params.manualAdd.newNodes];
            newEdges = [...edges, ...params.manualAdd.newEdges];
        } else {
            throw new Error('Unreachable code reached!?!? PANIC!!!!')
        }

        const nmap = new Map(newNodes.map(n=>[n.id,n]));
        setNodeMap(nmap);

        const adjacency = new Map<string, string[]>();
        newEdges.forEach(e=>{
            if (!adjacency.has(e.source)) {
                adjacency.set(e.source, []);
            }
            adjacency.get(e.source)?.push(e.target);
        })
        setAdjacencyList(adjacency);
        setNodes(newNodes);
        setEdges(newEdges);
    }

    const getConnected = async (id: string | string[]) => {
        if (typeof id === 'string'){
            id = [id];
        }
        const response = await fetch(`/api/graph/getConnected`, {
            method: "POST",
            body: JSON.stringify({parentNodeIds: id})
        });
        if(!response.ok){
            throw new Error(`Failed to get connected nodes at /api/graph/getConnected using id ${id}`);
        }
        const data = await response.json() as getConnectedNodesInterface;
        const newNodes = [];
        const newEdges = [];
        for(const connection of data.connections){
            const nodeAlreadyExists = nodes.find(node=>node.id==connection.connectedNode.id);
            const edgeAlreadyExists = edges.find(edge=> {
                return edge.id == connection.relation.id + ":" + connection.relation.source + connection.connectedNode.id
            });
            if (!nodeAlreadyExists){
                const newNode = connection.connectedNode;
                newNode.id = connection.connectedNode.id;
                newNodes.push(newNode);
            }
            if(!edgeAlreadyExists) {
                const newEdge: GraphEdge = {
                    id: connection.relation.id + ":" + connection.relation.source + connection.connectedNode.id,
                    source: connection.relation.source,
                    target: connection.connectedNode.id,
                    label: connection.relation.label
                };
                newEdges.push(newEdge);
            }
        }

        setAddedNodes(newNodes);
        return {newNodes: newNodes, newEdges: newEdges}
    }

    const expandConnected = async (nodesToExpand: ExtendedNode<Generic>[])=> {
        const connectionsToAdd: { newNodes: ExtendedNode<Generic>[], newEdges: GraphEdge[] } = {newNodes: [], newEdges: []}
        const idsToAdd = nodesToExpand.map(n=>n.id)
        const connections = await getConnected(idsToAdd);
        connectionsToAdd.newNodes.push(...connections.newNodes);
        connectionsToAdd.newEdges.push(...connections.newEdges);

        await addConnected({manualAdd: connectionsToAdd});
    }

    function fromNodesById(id: string, nodes: ExtendedNode<any>[]){
        return nodes.find(n=>n.id===id);
    }

    useEffect(() => {
        let newNodes = nodes;
        let newEdges = edges;

        console.log(nodes.filter(n=>isSubjectNode(n)&&n.data.code.includes('COMP 2021')))
        /**
         * Graph Filtering Pass
         */
        // filter out nodes not relevant to selected program


        if(selectedProgram && selectedProgram.data.programSequences && selectedProgramSequence) {
            if (selectedProgram) newNodes = newNodes.filter(n => {
                if (!isSubjectNode(n)) return true;
                return filterSubjectsNotInSequence(n, selectedProgram.data.programName, selectedProgramSequence ?? '');
            });
        }

        // filter out prerequisites we know are not part of course
        if(selectedProgram) newNodes = newNodes.filter(n=> {
            if(!isPrerequisiteNode(n)) return true;
            return filterPrerequisitesNotInCourse(n, selectedProgram.data.programName);
        });


        if(!showPotentialElectives) {
            newNodes = newNodes.filter(n=>{
                if (!isSubjectNode(n) || !n.fill) return true;
                return isRequiredByProgramOrSpecialisation(n, newNodes, adjacencyList, nodeMap, edges) !== RequiredType.NOT_REQUIRED;
            });
        }

        newNodes = newNodes.filter(n=>{
            if (!isPrerequisiteNode(n)) return true;
            const subjectNodes = nodes.filter(nn=>isSubjectNode(nn));
            return filterImpossiblePrerequisites(n, subjectNodes);
        });

        // filter out edges that are no longer visible
        newEdges = newEdges.filter(e=>filterDisconnectedEdges(e, newNodes));

        newEdges = newEdges.filter(e=>{
            return !(e.label === 'PREREQUISITE_FOR' && !isPrerequisiteNode(fromNodesById(e.target, newNodes)));
        });

        newNodes = newNodes.filter(n=>{
            if (!isSubjectNode(n)) return true;
            return !(n.data.prerequisites.length > 3
                && getParentsByType<Prerequisite>(n, newNodes, adjacencyList, nodeMap, 'Prerequisites')
                    .filter(p => p.data.forSubject === n.data.code).length < 1);
        });


        // filter out prerequisite nodes that do not lead to a visible subject
        newNodes = newNodes.filter(n=> {
            if(!isPrerequisiteNode(n)) return true;
            return filterLeafPrerequisites(n, newEdges);
        });
        newNodes = newNodes.filter(n=> {
            if(!isPrerequisiteNode(n)) return true;
            return filterLeafPrerequisites(n, newEdges);
        });

        /**
         * Graph Semantic Highlighting Pass
         */
        newNodes.forEach(n=>{
            if (!isSubjectNode(n)) return;
            const parentPrerequisites = getParentsByType<Prerequisite>
            (n, newNodes, adjacencyList, nodeMap, 'Prerequisites').filter(p=>p.data.forSubject===n.data.code);
            if (isEligibleForSubject(parentPrerequisites, getCompletedSubjects()) && isOfferedInCurrentPeriod(n) !== OfferStatus.NO){
                n.fill = nodeFillMap['Subject'];
            } else {
                if(!hasTaken(n)) n.fill = colours.inaccessible
            }
        });


        newNodes.forEach(n=>{
            if (!isSubjectNode(n) || !n.fill) return;
            const required = isRequiredByProgramOrSpecialisation(n, newNodes, adjacencyList, nodeMap, edges);
            if (required !== RequiredType.REQUIRED){
                if(n.fill !== colours.inaccessible) {
                    if(required === RequiredType.NOT_REQUIRED){
                        n.fill = new HEXGBA('#994499').toHex();
                    } else {
                        if(!hasTaken(n)) n.fill = new HEXGBA(n.fill).multiply(0.60).toHex();
                    }
                }
            }
        });

        newNodes.forEach(n=>{
            if (!isSubjectNode(n) || !n.fill) return;
            if (!hasTaken(n)) {
                if(n.fill !== colours.inaccessible) n.fill = new HEXGBA(n.fill).multiply(0.75).toHex();
            }
        });

        newNodes.forEach(n=>{
            if (!isPrerequisiteNode(n)) return;
            if (prerequisiteIsFulfilled(n, getCompletedSubjects())) {
                n.fill = nodeFillMap['Prerequisites'];
            } else {
                n.fill = colours.inaccessible
            }
        })

        setDisplayedNodes(newNodes);
        setDisplayedEdges(newEdges);
    }, [nodes, selectedProgramSequence, selectedProgram, showPotentialElectives, completedPeriods.length, currentPeriod.subjectsTaken.length, updateToggle]);

    useEffect(() => {
        if(addedNodes.length > 0) expandConnected(addedNodes);
    }, [addedNodes]);

    useEffect(() => {
        if (!firstShowHelp) setFirstShowLineup(false);
    }, [showLineup]);

    return (
        <main className={`h-[100vh] flex flex-col ${showLineup ? 'p-2' : 'pb-2 px-2'}`}>
            <div onClick={()=> {
                setShowHelp(!showHelp);
                setFirstShowHelp(false);
            }} className={`absolute right-0 top-24 z-31 flex flex-row ${!showHelp ? `max-h-8 items-center border border-r-0 rounded-l-md bg-white ${(firstShowHelp) ? 'animate-bounceright w-12 translate-x-0 !bg-green-300' : 'w-8'}` : ''}`}><BsQuestion className={`${showHelp ? `max-h-8 items-center border border-r-0 rounded-l-md bg-white` : ''}`} size={32}/>{showHelp && <div className={`border rounded-bl-lg px-1.5 max-w-[400px] w-full min-w-[250px] overflow-y-scroll bg-white`}>
                Welcome to <strong>MyDegree.help!</strong> To get started, you can type part or all of a program name into the search bar, the dropdown will fill automatically with any matching courses.
                <br/><br/> Selecting a Major or Minor is optional (if you don't want one, just don't select it), once you are happy with your choices, click 'Start Exploring' to plan your degree!
                <br/><br/><strong>IMPORTANT:</strong>
                <br/><ul>
                    <li>- To view information about a node, click it once.</li>
                    <li>- To add a subject to your Degree Timeline, double-click it. You can only add subjects you are eligible for (i.e. are not greyed out)</li>
                    <li>- As you complete more subjects, you will be eligible for the subjects that were previously greyed out.</li>
                </ul>
            </div>}</div>
            <div onClick={()=> {
                setShowKey(!showKey);
                if(!firstShowLineup) setFirstShowKey(false);
            }} className={`absolute right-0 top-36 z-30 flex flex-row ${!showKey ? `max-h-8 items-center border border-r-0 rounded-l-md bg-white ${(firstShowKey && nodes.length > 3) ? 'animate-bounceright w-12 translate-x-0 !bg-green-300' : 'w-8'}` : ''}`}><PiGraphBold className={`${showKey ? `max-h-8 items-center border border-r-0 rounded-l-md bg-white` : ''}`} size={32}/>{showKey && <img alt={'Legend for different node types'} className={`border bg-white px-1.5 max-w-[400px] min-w-[250px] w-full overflow-y-scroll`} src={'nodes.jpg'}/>}</div>
            <ForceGraph layoutMode={displayMode} clickAction={selectElement} clickCanvas={resetSelectedElement} clusterBy={clusterBy} doubleClickNodeAction={onNodeDoubleClicked} className={`grow w-full h-full absolute top-0 left-0 z-10`}
                        edges={displayedEdges} nodes={displayedNodes}/>
                <div className={`border-2 p-1 flex flex-col md:flex-row overflow-x-scroll w-fit max-w-full h-fit relative z-20 bg-white ${showLineup ? 'block' : 'hidden'}`}>
                    <div className={`flex-2`}>
                        <h1>Please Search for a Program to Begin.</h1>
                        <hr/>
                        <LineupSelector onSearchEvent={searchProgram} onMajorEvent={forceAddSpecialisation} onMinorEvent={forceAddSpecialisation} onStartExploring={startExploring} className={`p-1`}/>

                    </div>
                    {selectedProgram && <div className={`flex-3 flex`}>
                        <div className={`border-r-2 mx-2 hidden md:block`}></div>
                        <div className={`flex-3 flex`}>
                            <div className={'flex flex-col'}>
                                <h2 className={`font-bold`}>Graph Analysis</h2>
                                <hr className={`max-w-[95%] md:max-w-full`}/>
                                <div>
                                    {displayMode === 'forceDirected2d' && <div>
                                        <label>Cluster Nodes By: </label>
                                        <select onChange={(s) => setClusterBy(s.currentTarget.value)}>
                                            {clusterOptions.map(c => {
                                                return <option key={c} value={c}>{c}</option>
                                            })}
                                        </select>
                                    </div>}
                                </div>
                                <h2 className={`font-bold`}>Program Filters</h2>
                                <hr className={`max-w-[95%] md:max-w-full`}/>
                                <div>
                                    <label>Show Potentially Relevant Electives: </label>
                                    <input type={'checkbox'} onChange={(e)=>{
                                        setShowPotentialElectives(e.target.checked);
                                    }}/>
                                </div>
                                {showSequences &&
                                    <div>
                                        <label>Selected Study Sequence: </label>
                                        <select className={`max-w-[95%]`} onChange={(s)=> {
                                            const sequence = s.currentTarget.value;
                                            setSelectedProgramSequence(sequence);
                                            let newStartPeriod: StudyPeriod = 'autumn';
                                            if (sequence.includes('mid-')) {
                                                newStartPeriod = 'spring';
                                            }
                                            setStartPeriod(newStartPeriod);
                                            if (!completedPeriods || completedPeriods.length < 1) {
                                                const newStudyPeriod: StudyPeriodItem = currentPeriod;
                                                newStudyPeriod.period = newStartPeriod;
                                                setCurrentPeriod(newStudyPeriod);
                                            }
                                        }}>{(selectedProgram).data['programSequences'].map(s=>{
                                            return <option key={s} value={s}>{s}</option>
                                        })}</select>
                                    </div>
                                }
                            </div>
                            <div className={`grow`}></div>
                        </div>
                    </div>}
                </div>
            <div className={`flex flex-col items-center border rounded-b-md w-8  hover:cursor-pointer z-20 transform ${(!showLineup && firstShowLineup && !firstShowHelp) ? 'animate-bounce -translate-y-0.5 h-9 !bg-green-300' : 'animate-none h-6'} bg-white`} onClick={()=> {
                setShowLineup(!showLineup);
            }}>{showLineup && <BsArrowUpShort size={32}/>}{!showLineup &&<BiSearch className={`${(firstShowLineup && !firstShowHelp) ? 'pt-2.5' : ''}`} size={32}/>}</div>
            <CourseTimeline className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit z-20 max-h-1/2 max-w-1/5 border-2 absolute left-1 bottom-0 my-auto`}
                            completedPeriods={completedPeriods} currentPeriod={currentPeriod} onSkipPeriod={moveToNewPeriod}/>
            <InfoPanel className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit z-20 max-h-1/2 max-w-1/5 border-2 absolute right-1 bottom-0 my-auto`} item={selectedElement}/>
            {/*<a href={'https://github.com/Inertia-Squared/degree-planner'} target={'_blank'} className={`fixed top-0 right-0 w-8 h-8 z-40 m-3`}><BsGithub size={32}/></a>*/}
        </main>
    );
}