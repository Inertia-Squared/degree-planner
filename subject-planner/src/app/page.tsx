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
    filterDisconnectedEdges, filterImpossiblePrerequisites, filterLeafPrerequisites,
    filterPrerequisitesNotInCourse,
    filterSubjectsNotInSequence
} from "@/lib/graph/graphFilters";
import {
    isEligibleForSubject,
    isRequiredByProgramOrSpecialisation,
    prerequisiteIsFulfilled
} from "@/lib/graph/graphColours";
import {getParentsByType} from "@/lib/graph/graphUtil";
import {CourseTimeline} from "@/components/CourseTimeline";
import {SpecialisationType} from "../../../majors-minors/major-minor-scraper";

// todo add type extensions for cringe node data fields

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
export function isExtendedNode(obj: any){
    return 'data' in obj;
}

export interface GenericNode {
    type: NodeTypes
}
export function isGenericNode(obj: any){
    return isExtendedNode(obj) && containsAll(obj.data, ['type']);
}

export interface SubjectExtension extends GenericNode{
    type: 'Subject'
    code: string,
    prerequisites: string
    subjectSequences: string[]
    teachingPeriods: string[]
}
export function isSubjectNode(obj: any){
    return isGenericNode(obj) && containsAll(obj.data, ['code','prerequisites','subjectSequences', 'teachingPeriods']);
}

export interface ProgramExtension extends GenericNode{
    type: 'Program'
    programName: string,
    programSequences: string[]
}
export function isProgramNode(obj: any){
    return isGenericNode(obj) && containsAll(obj.data,['programName','programSequences']);
}

export interface PrerequisiteExtension extends GenericNode {
    type: 'Prerequisites'
    course: string
    subjects: string
    forSubject: string
}
export function isPrerequisiteNode(obj: any){
    return isGenericNode(obj) && containsAll(obj.data, ['course', 'subjects', 'forSubject']);
}

export interface MajorExtension extends GenericNode {
    type: 'Major'
    majorName: string
    majorType: SpecialisationType | string
    majorLocations: string[]
    majorLink: string
    programConnectionId?: string
}
export function isMajorNode(obj: any){
    return isGenericNode(obj) && containsAll(obj.data, ['majorName', 'majorType', 'majorLocations', 'majorLink']);
}

export interface MinorExtension extends GenericNode {
    type: 'Minor'
    minorName: string
    minorType: SpecialisationType | string
    minorLocations: string[]
    minorLink: string
    programConnectionId?: string
}
export function isMinorNode(obj: any){
    return isGenericNode(obj) && containsAll(obj.data, ['minorName', 'minorType', 'minorLocations', 'minorLink']);
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

const displayOptions = {
    ['Disabled']: 'forceatlas2',
    ['Enabled']: 'forceDirected2d',
} as const;

export interface StudyPeriodItem {
    period: StudyPeriod
    subjectsTaken: ExtendedNode<SubjectExtension>[]
}


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
    const [nodes, setNodes] = useState<ExtendedNode<GenericNode>[]>([]);
    const [displayedNodes, setDisplayedNodes] = useState<ExtendedNode<GenericNode>[]>([]);
    const [nodeMap, setNodeMap] = useState<Map<string, ExtendedNode<GenericNode>>>(new Map());
    const [adjacencyList, setAdjacencyList] = useState<Map<string, string[]>>(new Map())
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [displayedEdges, setDisplayedEdges] = useState<GraphEdge[]>([]);
    const [addedNodes, setAddedNodes] = useState<ExtendedNode<GenericNode>[]>([]);

    const [clusterOptions, setClusterOptions] = useState(['select a node to see cluster options']);
    const [clusterBy, setClusterBy] = useState<string | undefined>(undefined);
    const [selectedElement, setSelectedElement] = useState<ExtendedNode<GenericNode> | GraphEdge | undefined>(undefined);
    const [displayMode, setDisplayMode] = useState<LayoutTypes>(Object.values(displayOptions)[1]);

    const [selectedProgram, setSelectedProgram] = useState<ExtendedNode<ProgramExtension> | undefined>(undefined);
    const [selectedProgramSequence, setSelectedProgramSequence] = useState<string | undefined>(undefined);

    const [isLoading, setIsLoading] = useState(true);

    const [showPotentialElectives, setShowPotentialElectives] = useState<boolean>(false);

    const [startPeriod, setStartPeriod] = useState<StudyPeriod>('autumn');

    const [completedPeriods, setCompletedPeriods] = useState<StudyPeriodItem[]>([])

    const [currentPeriod, setCurrentPeriod] = useState<StudyPeriodItem>({
        period: startPeriod,
        subjectsTaken: []
    });

    const [updateToggle, setUpdateToggle] = useState<boolean>(false);

    const searchProgram = async (searchString: string)=>{
        const response = await fetch(`/api/graph/getPrograms?programName=${searchString}`);
        if (!response.ok) {
            throw new Error(`Failed to get programs at /api/graph/getPrograms with search string ${searchString}`);
        }

        const data = await response.json() as getProgramsInterface;
        if(data.programs !== nodes) setNodes(data.programs);
        setSelectedProgram(data.programs[0] as ExtendedNode<ProgramExtension>);
        setSelectedProgramSequence(data.programs[0].data.programSequences[0]);
    }

    const forceAddSpecialisation = (node: ExtendedNode<MajorExtension | MinorExtension>) => {
        if(!node.data.programConnectionId || !selectedProgram) return;
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
        const newEdges = [...edges, newEdge];
        setEdges(newEdges);
    }

    function isOfferedInCurrentPeriod(node: ExtendedNode<SubjectExtension>): OfferStatus {
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
        expandConnected(newNodes);
    }

    function selectElement(id: string, isNode: boolean = true) {
        const element =
            isNode ? nodes.find(n=>n.id===id) : edges.find(e=>e.id===id);
        setSelectedElement(element);
        if(isNode) {
            if (element && element.data.type === 'Program') {
                setSelectedProgram(element as ExtendedNode<ProgramExtension>);
                const sequences = element.data['programSequences'];
                if (sequences.length > 0) setSelectedProgramSequence(sequences[0])
            }
            setClusterOptions(Object.keys(element?.data).filter(key=>!badClusterOptions.find(o=>o==key)));
        }
    }

    function hasCompleted(node: ExtendedNode<GenericNode>){
        if (!isSubjectNode(node)) {
            throw('Error: Attempted to check subject info on non-subject node');
        }
        let hasCompleted = false;
        completedPeriods.forEach(p=>{
            if (p.subjectsTaken.includes(node as ExtendedNode<SubjectExtension>)) hasCompleted = true;
        })
        return hasCompleted;
    }

    function getCompletedSubjects(){
        return completedPeriods.map(p=>p.subjectsTaken).flat();
    }

    function hasTaken(node: ExtendedNode<GenericNode>){
        if (!isSubjectNode(node)) {
            throw('Error: Attempted to check subject info on non-subject node');
        }
        return hasCompleted(node) || currentPeriod.subjectsTaken.includes(node as ExtendedNode<SubjectExtension>);
    }

    function onNodeClicked(id: string){
        console.log('Checking node...')
        const node = getNodeFromId(id);
        if (node && isSubjectNode(node)){
            if (hasTaken(node)) {
                console.log('Has already been taken, skipping.')
                return;
            }
            const parentPrerequisites = getParentsByType<PrerequisiteExtension>(node, nodes, adjacencyList, nodeMap, 'Prerequisites').filter(p=>p.data.forSubject===(node as ExtendedNode<SubjectExtension>).data.code);
            if (!isEligibleForSubject(parentPrerequisites, getCompletedSubjects()) || isOfferedInCurrentPeriod(node as ExtendedNode<SubjectExtension>) !== OfferStatus.YES) {
                console.log('Is not eligible.')
                console.log('Prerequisites Satisfied: ' + isEligibleForSubject(parentPrerequisites, getCompletedSubjects()));
                console.log('Is currently offered: ' + !(isOfferedInCurrentPeriod(node as ExtendedNode<SubjectExtension>) !== OfferStatus.YES) + '(' + isOfferedInCurrentPeriod(node as ExtendedNode<SubjectExtension>) + ')')
                console.log(parentPrerequisites);
                return;
            }
            const newCurrentPeriod = currentPeriod;
            newCurrentPeriod.subjectsTaken.push(node as ExtendedNode<SubjectExtension>);

            if ((currentPeriod.subjectsTaken.length) % 4 === 0) {
                moveToNewPeriod(newCurrentPeriod);
            } else {
                setCurrentPeriod(newCurrentPeriod);
            }
            setUpdateToggle(!updateToggle);
        }
    }

    function moveToNewPeriod(oldCurrentPeriod: StudyPeriodItem){
        if ((completedPeriods.length+1) % 2 === 0) {
            setCompletedPeriods([...(completedPeriods ?? []), oldCurrentPeriod]);
            setCurrentPeriod({
                period: startPeriod,
                subjectsTaken: []
            });
        } else {
            setCompletedPeriods([...(completedPeriods ?? []), oldCurrentPeriod]);
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
    function chooseNode(excludeId: string, filterType: NodeTypes, graph: { oldNodes: ExtendedNode<GenericNode>[], oldEdges: GraphEdge[]}){
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
    async function addConnected(params: {manualAdd: {newNodes: ExtendedNode<GenericNode>[], newEdges: GraphEdge[]}}): Promise<void>;

    async function addConnected(params: {id?: string, manualAdd?: { newNodes: ExtendedNode<GenericNode>[], newEdges: GraphEdge[] }
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

    const expandConnected = async (nodesToExpand: ExtendedNode<GenericNode>[])=> {
        const connectionsToAdd: { newNodes: ExtendedNode<GenericNode>[], newEdges: GraphEdge[] } = {newNodes: [], newEdges: []}
        const idsToAdd = nodesToExpand.map(n=>n.id)
        // for (const node of nodesToExpand){
        //     if(node.data.type === 'SubjectChoice' || isPrerequisiteNode(node) || isSubjectNode(node)){
        //         idsToAdd.push(node.id);
        //     }
        // }
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

        /**
         * Graph Filtering Pass
         */
        // filter out nodes not relevant to selected program


        if(selectedProgram && selectedProgram.data.programSequences && selectedProgramSequence) {
            if (selectedProgram) newNodes = newNodes.filter(n => {
                if (!isSubjectNode(n)) return true;
                return filterSubjectsNotInSequence(n as ExtendedNode<SubjectExtension>, selectedProgram.data.programName, selectedProgramSequence ?? '');
            });
        }

        // filter out prerequisites we know are not part of course
        if(selectedProgram) newNodes = newNodes.filter(n=> {
            if(!isPrerequisiteNode(n)) return true;
            return filterPrerequisitesNotInCourse(n as ExtendedNode<PrerequisiteExtension>, selectedProgram.data.programName);
        });


        if(!showPotentialElectives) {
            newNodes = newNodes.filter(n=>{
                if (!isSubjectNode(n) || !n.fill) return true;
                return isRequiredByProgramOrSpecialisation(n as ExtendedNode<SubjectExtension>, newNodes, adjacencyList, nodeMap, edges);
            });
        }

        newNodes = newNodes.filter(n=>{
            if (!isPrerequisiteNode(n)) return true;
            const subjectNodes = newNodes.filter(nn=>isSubjectNode(nn)) as ExtendedNode<SubjectExtension>[];
            return filterImpossiblePrerequisites(n as ExtendedNode<PrerequisiteExtension>, subjectNodes);
        });

        // filter out edges that are no longer visible
        newEdges = newEdges.filter(e=>filterDisconnectedEdges(e, newNodes));

        newEdges = newEdges.filter(e=>{
            if (e.label === 'PREREQUISITE_FOR' && !isPrerequisiteNode(fromNodesById(e.target, newNodes))){
                return false;
            }
            return true;
        });

        newNodes = newNodes.filter(n=>{
            if (!isSubjectNode(n)) return true;
            const s = n as ExtendedNode<SubjectExtension>;
            if (s.data.prerequisites.length > 3 && getParentsByType<PrerequisiteExtension>(s,newNodes,adjacencyList,nodeMap,'Prerequisites').filter(p=>p.data.forSubject===s.data.code).length < 1){
                return false;
            }
            return true;
        });


        // filter out prerequisite nodes that do not lead to a visible subject
        newNodes = newNodes.filter(n=> {
            if(!isPrerequisiteNode(n)) return true;
            return filterLeafPrerequisites(n as ExtendedNode<PrerequisiteExtension>, newEdges);
        });

        /**
         * Graph Semantic Highlighting Pass
         */
        newNodes.forEach(n=>{
            if (!isSubjectNode(n)) return;
            const parentPrerequisites = getParentsByType<PrerequisiteExtension>(n as ExtendedNode<SubjectExtension>, newNodes, adjacencyList, nodeMap, 'Prerequisites').filter(p=>p.data.forSubject===(n as ExtendedNode<SubjectExtension>).data.code);
            if (isEligibleForSubject(parentPrerequisites as ExtendedNode<PrerequisiteExtension>[], getCompletedSubjects()) && isOfferedInCurrentPeriod(n as ExtendedNode<SubjectExtension>) === OfferStatus.YES){
                n.fill = nodeFillMap['Subject'];
            } else {
                if(!hasTaken(n)) n.fill = colours.inaccessible
            }
        });

        if (showPotentialElectives){
            newNodes.forEach(n=>{
                if (!isSubjectNode(n) || !n.fill) return;
                if (!isRequiredByProgramOrSpecialisation(n as ExtendedNode<SubjectExtension>, newNodes, adjacencyList, nodeMap, edges)){
                    if(n.fill !== colours.inaccessible) n.fill = new HEXGBA('#AA33AA').toHex();
                }
            });
        }

        newNodes.forEach(n=>{
            if (!isSubjectNode(n) || !n.fill) return;
            if (!hasTaken(n)) {
                if(n.fill !== colours.inaccessible) n.fill = new HEXGBA(n.fill).multiply(0.7).toHex();
            }
        });

        newNodes.forEach(n=>{
            if (!isPrerequisiteNode(n)) return;
            if (prerequisiteIsFulfilled(n as ExtendedNode<PrerequisiteExtension>, getCompletedSubjects())) {
                n.fill = nodeFillMap['Prerequisites'];
            } else {
                n.fill = colours.inaccessible
            }
        })

        setDisplayedNodes(newNodes);
        setDisplayedEdges(newEdges);
    }, [nodes, selectedProgramSequence, selectedProgram, showPotentialElectives, completedPeriods, currentPeriod.subjectsTaken, updateToggle]);

    useEffect(() => {
        if(addedNodes.length > 0) expandConnected(addedNodes);
        // console.log(addedNodes.map(n=>n.data.sequences))
    }, [addedNodes]);

    useEffect(() => {
        // const fetchPrograms = async () => {
        //     await searchProgram(defaultProgram);
        //     setIsLoading(false);
        // };
        // fetchPrograms();
        setIsLoading(false);
    }, []); // Empty dependency array ensures this runs once on mount

    if (isLoading) return <p>Loading...</p>;

    return (
        <main className={`h-[100vh] flex flex-col p-4`}>
            <div className={`border-2 p-1 flex`}>
                <div className={`flex-2`}>
                    <h1>Please Search for a Program to Begin.</h1>
                    <hr/>
                    <LineupSelector onSearchEvent={searchProgram} onMajorEvent={forceAddSpecialisation} onMinorEvent={forceAddSpecialisation} onStartExploring={startExploring} className={`p-1`}/>

                </div>
                {selectedProgram && <div className={`flex-3 flex`}>
                    <div className={`border-r-2 mx-2`}></div>
                    <div className={`flex-3 flex`}>
                        <div className={'flex flex-col'}>
                            <h2 className={`font-bold`}>Graph Analysis</h2>
                            <hr/>
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
                            <hr/>
                            <div>
                                <label>Show Potentially Relevant Electives: </label>
                                <input type={'checkbox'} onChange={(e)=>{
                                    setShowPotentialElectives(e.target.checked);
                                }}/>
                            </div>
                            <div>
                                <label>Selected Study Sequence: </label>
                                <select onChange={(s)=> {
                                    const sequence = s.currentTarget.value;
                                    setSelectedProgramSequence(sequence);
                                    if (sequence.includes('mid-')) {
                                        setStartPeriod('spring');
                                    } else {
                                        setStartPeriod('autumn');
                                    }
                                }}>{(selectedProgram as ExtendedNode<ProgramExtension>).data['programSequences'].map(s=>{
                                    return <option key={s} value={s}>{s}</option>
                                })}</select>
                            </div>
                        </div>
                        <div className={`grow`}></div>
                    </div>
                </div>}
            </div>
            <div>
            </div>
            <ForceGraph layoutMode={displayMode} clickAction={selectElement} clickCanvas={resetSelectedElement} clusterBy={clusterBy} doubleClickNodeAction={onNodeClicked} className={`grow w-full relative`}
                        edges={displayedEdges} nodes={displayedNodes}/>
            <CourseTimeline className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit max-h-1/2 max-w-1/5 border-2 absolute left-1 bottom-0 my-auto overflow-y-scroll`}
                            completedPeriods={completedPeriods} currentPeriod={currentPeriod}/>
            <InfoPanel className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit max-h-1/2 max-w-1/5 border-2 absolute right-1 bottom-0 my-auto overflow-y-scroll`} item={selectedElement}/>
        </main>
    );
}