import {ExtendedNode, Generic, Program, StudyPeriod, Subject} from "@/utils/types";
import {create} from "zustand";
import {useGraphDataStore} from "@/app/store/graphStore";
import {getProgramsInterface} from "@/app/api/graph/getPrograms/route";

export interface DegreeState {
    selectedProgram: ExtendedNode<Generic> | undefined
    selectedProgramSequence: string | undefined

    startPeriod: StudyPeriod
    completedPeriods: { period: StudyPeriod, subjectsTaken: ExtendedNode<Generic>[] }[]
    currentPeriod: { period: StudyPeriod, subjectsTaken: ExtendedNode<Generic>[] }
    subjectsTaken: ExtendedNode<Subject>[]
}

export const useDegreeStore = create<DegreeState>()((set) => ({
    selectedProgram: undefined,
    selectedProgramSequence: undefined,

    startPeriod: "autumn",
    completedPeriods: [],
    currentPeriod: { period: "autumn", subjectsTaken: [] },
    subjectsTaken: [],
}));

export async function searchProgram(searchString: string){
    const graphData = useGraphDataStore.getState();

    useGraphDataStore.setState({nodesHot: true});
    const response = await fetch(`/api/graph/getPrograms?programName=${searchString}`);
    if (!response.ok) {
        throw new Error(
            `Failed to get programs at /api/graph/getPrograms with search string ${searchString}`
        );
    }
    const data = (await response.json()) as getProgramsInterface;
    if (data.programs !== graphData.nodes) useGraphDataStore.setState({nodes: data.programs});
    useDegreeStore.setState(
        {
            selectedProgram: data.programs[0] as ExtendedNode<Program>,
            selectedProgramSequence: data.programs[0].data.programSequences[0]
        }
    );
}

export function getCompletedSubjects(){
    return useDegreeStore.getState().completedPeriods.map((p) => p.subjectsTaken).flat();
}

export function hasTaken(node: ExtendedNode<Generic>){
    return useDegreeStore.getState().subjectsTaken.some((n) => n.id === node.id);
}