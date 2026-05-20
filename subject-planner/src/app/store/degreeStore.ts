import {ExtendedNode, Program, StudyPeriod, Subject} from "@/utils/types";
import {create} from "zustand";

export interface DegreeState {
    selectedProgram: ExtendedNode<Program> | undefined
    selectedProgramSequence: string | undefined

    startPeriod: StudyPeriod
    completedPeriods: { period: StudyPeriod, subjectsTaken: ExtendedNode<Subject>[] }[]
    currentPeriod: { period: StudyPeriod, subjectsTaken: ExtendedNode<Subject>[] }
    subjectsTaken: ExtendedNode<Subject>[]
}

/**
 * @fields
 * **Degree Initial State**:
 * selectedProgram,
 * selectedProgramState,
 * startPeriod
 *
 * **Degree Completion State**:
 * completedPeriods,
 * currentPeriod,
 * subjectsTaken
 */
export const useDegreeStore = create<DegreeState>()((set) => ({
    selectedProgram: undefined,
    selectedProgramSequence: undefined,
    startPeriod: "autumn",

    completedPeriods: [],
    currentPeriod: { period: "autumn", subjectsTaken: [] },
    subjectsTaken: [],
}));

