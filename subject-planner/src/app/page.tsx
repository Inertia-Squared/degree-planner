"use client";
import dynamic from "next/dynamic";
import {RefObject, useCallback, useEffect, useState} from "react";
import {GraphCanvasRef, GraphEdge} from "reagraph";
import InfoWindow from "@/components/ui/layout/Windows/InfoWindow";
import {TimelineWindow} from "@/components/ui/layout/Windows/TimelineWindow";
import {
    ExtendedNode,
    Generic,
    GraphColourProps,
    GraphCommonProps,
    GraphFilterProps,
    GraphPruningProps,
    Program,
    StudyPeriod,
    StudyPeriodItem,
    Subject,
} from "@/utils/types";
import {displayMode} from "@/utils/consts";
import ViewWindow from "@/components/ui/layout/Windows/ViewWindow";
import {applyClassificationFilters, applyGraphFilters} from "@/lib/graph/graphFilters";
import {useGraphConnection} from "@/hooks/useGraphConnection";
import {useProgram} from "@/hooks/useProgram";
import {useSubjectCriteria} from "@/hooks/useSubjectCriteria";
import {applyGraphColours} from "@/lib/graph/graphColours";
import HeaderBar, {HeaderItem} from "@/components/ui/layout/Containers/HeaderBar";
import {applyGraphLabels} from "@/lib/graph/graphLabels";
import ShowIneligible from "@/components/ShowIneligible";
import SearchWindow from "@/components/ui/layout/Windows/SearchWindow";
import HelpWindow from "@/components/ui/layout/Windows/HelpWindow";

// todo fix failure-case for Ba. of Arts, Ma. 0026 & Mi. 0024

const ForceGraph = dynamic(() => import("../components/ForceGraph"), {
    ssr: false,
});

// Interfaces above
export default function Home() {

    const [displayedNodes, setDisplayedNodes] = useState<ExtendedNode<Generic>[]>([]);
    const [displayedEdges, setDisplayedEdges] = useState<GraphEdge[]>([]);
    const [clusterOptions, setClusterOptions] = useState(["select a node to see cluster options"]);
    const [clusterBy, setClusterBy] = useState<string | undefined>(undefined);
    const [selectedElement, setSelectedElement] = useState<ExtendedNode<Generic> | GraphEdge | undefined>(undefined);
    const [showPotentialElectives, setShowPotentialElectives] = useState<boolean>(false);

    const [showInfo, setShowInfo] = useState<boolean>(false);
    const [updateToggle, setUpdateToggle] = useState<boolean>(false);
    const [showSequences, setShowSequences] = useState<boolean>(true);

    const [selectedHeaderItem, setSelectedHeaderItem] = useState<HeaderItem>(HeaderItem.NONE); //todo if we want to allow multiple windows open simultanously, turn this into an array and check for contains, but for now we keep it simple

    const [showAllIneligible, setShowAllIneligible] = useState(false);

    const {
        forceAddSpecialisation,
        startExploring,
        selectElement,
        onNodeDoubleClicked,
        moveToNewPeriod,
        getCompletedSubjects,
        isOfferedInCurrentPeriod,
        hasTaken,
    } = useSubjectCriteria({
        setSelectedHeaderItem,
        setSelectedElement,
        setClusterOptions,
        setUpdateToggle,
        updateToggle,
        setShowSequences,
        setShowInfo: setShowInfo,
    });

    function onCanvasClicked() {
        if (selectedHeaderItem !== HeaderItem.NONE) setSelectedHeaderItem(HeaderItem.NONE)
        else resetSelectedElement();
    }

    function resetSelectedElement(){
        setSelectedElement(undefined);
        setClusterOptions(["Select a node to see cluster options"]);
        setClusterBy(undefined);
        setShowInfo(false);
    }

    function onToggleShowIneligible(shouldShow: boolean) {
        setShowAllIneligible(shouldShow);
    }

    useEffect(() => {
        const commonProps: GraphCommonProps = {
            adjacencyList: adjacencyList,
            edges: edges,
            nodeMap: nodeMap,
            nodes: nodes,
        };

        const filterProps: GraphFilterProps = {
            selectedProgram: selectedProgram,
            selectedProgramSequence: selectedProgramSequence,
            showPotentialElectives: showPotentialElectives,
            ...commonProps,
        };
        const colourProps: GraphColourProps = {
            getCompletedSubjects: getCompletedSubjects,
            hasTaken: hasTaken,
            isOfferedInCurrentPeriod: isOfferedInCurrentPeriod,
            ...commonProps,
        };

        let { newNodes, newEdges } = applyGraphFilters(filterProps);
        applyGraphColours(colourProps);
        const pruningProps: GraphPruningProps = {
            newNodes: newNodes,
            newEdges: newEdges,
            adjacencyList: adjacencyList,
            showAllIneligible: showAllIneligible,
        };
        const newValues = applyClassificationFilters(pruningProps);
        newNodes = newValues.newNodes;
        newEdges = newValues.newEdges;

        applyGraphLabels(newNodes);

        setDisplayedNodes(newNodes);
        setDisplayedEdges(newEdges);
        if (addedNodes.length > 0) expandConnected(addedNodes);
    }, [
        addedNodes,
        adjacencyList,
        edges,
        expandConnected,
        getCompletedSubjects,
        hasTaken,
        isOfferedInCurrentPeriod,
        nodeMap,
        nodes,
        selectedProgram,
        selectedProgramSequence,
        showPotentialElectives,
        showAllIneligible,
    ]);

    useEffect(()=>{
        setTimeout(()=>setNodesHot(false), 1000);
    }, [nodesHot])

    useEffect(()=>{
        setNodesHot(true);
    }, [nodes])

    return (
        <>
            <HeaderBar exploringStarted={exploringStarted} selectedHeaderItem={selectedHeaderItem} setSelectedHeaderItem={setSelectedHeaderItem} />

            <main className={`h-[100vh] py-16 flex flex-col overflow-hidden ${selectedHeaderItem === HeaderItem.SEARCH ? "p-2" : "pb-2 px-2"}`}>
                <ForceGraph
                    layoutMode={displayMode}
                    clickAction={selectElement}
                    clickCanvas={onCanvasClicked}
                    clusterBy={clusterBy}
                    doubleClickNodeAction={onNodeDoubleClicked}
                    className={`grow w-full h-full absolute top-0 left-0 z-10`}
                    edges={displayedEdges}
                    nodes={displayedNodes}
                    setGraphRef={setGraphRef}
                />
                <ViewWindow
                    className={`header-window-top-right z-20`}
                    setClusterBy={setClusterBy}
                    clusterOptions={clusterOptions}
                    setShowPotentialElectives={setShowPotentialElectives}
                    selectedHeaderItem={selectedHeaderItem}
                    setSelectedHeaderItem={setSelectedHeaderItem}
                />

                <SearchWindow
                    className={`header-window-top-right z-20`}
                    onSearchEvent={searchProgram}
                    onMajorEvent={forceAddSpecialisation}
                    onMinorEvent={forceAddSpecialisation}
                    onStartExploring={startExploring}
                    showSequences={showSequences}
                    setSelectedProgramSequence={setSelectedProgramSequence}
                    setStartPeriod={setStartPeriod}
                    setCurrentPeriod={setCurrentPeriod}
                    completedPeriods={completedPeriods}
                    currentPeriod={currentPeriod}
                    selectedProgram={selectedProgram}
                    selectedHeaderItem={selectedHeaderItem}
                    setSelectedHeaderItem={setSelectedHeaderItem}
                    nodesHot={nodesHot}
                />

                <TimelineWindow
                    className={`header-window-top-right z-20`}
                    completedPeriods={completedPeriods}
                    currentPeriod={currentPeriod}
                    onSkipPeriod={moveToNewPeriod}
                    selectedHeaderItem={selectedHeaderItem}
                    setSelectedHeaderItem={setSelectedHeaderItem}
                />
                <InfoWindow
                    className={`header-window header-window-top-right z-15 overflow-auto`}
                    item={selectedElement}
                    showInfo={showInfo}
                    setShowInfo={setShowInfo}
                />
                
                <HelpWindow className={`header-window-top-right z-20`} selectedHeaderItem={selectedHeaderItem} setSelectedHeaderItem={setSelectedHeaderItem}/>
                
                <ShowIneligible
                    className={`bg-gray-50 min-w-[250px] min-h-[400px] w-fit h-fit z-20 max-h-1/2 max-w-1/5 border-2 absolute right-1 bottom-0 my-auto`}
                    onToggle={onToggleShowIneligible}
                />
                {/*<a href={'https://github.com/Inertia-Squared/degree-planner'} target={'_blank'} className={`fixed top-0 right-0 w-8 h-8 z-40 m-3`}><BsGithub size={32}/></a>*/}
            </main>
        </>
    );
}
