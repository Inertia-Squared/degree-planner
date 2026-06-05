import {ExtendedNode, Program, StudyPeriod, Subject} from "@/utils/types";
import {create, StateCreator} from "zustand";

export interface StudyPeriodData {
    period: StudyPeriod;
    subjectsTaken: ExtendedNode<Subject>[];
}

export interface DegreeState {
    selectedProgram: ExtendedNode<Program> | undefined
    selectedProgramSequence: string | undefined

    startPeriod: StudyPeriod
    completedPeriods: StudyPeriodData[]
    currentPeriod: StudyPeriodData
    subjectsTaken: ExtendedNode<Subject>[]
    subjectsTakenSet: Set<string>
    subjectsCompleted: ExtendedNode<Subject>[]
    subjectsCompletedSet: Set<string>
}

// typing on const-style declaration is MUCH easier to work with than traditional function declaration
const degreeInterceptor = (config: StateCreator<DegreeState>): StateCreator<DegreeState> => (set, get, api) => {
    const interceptedSet: typeof set = (partial, replace) => {
        const nextState = typeof partial === 'function' ? partial(get()) : partial;
        if (nextState){
            const hasSubTaken = Object.hasOwn(nextState, 'subjectsTaken');
            const hasCompletedPeriods = Object.hasOwn(nextState, 'completedPeriods');
            if (hasCompletedPeriods || hasSubTaken){
                const completedPeriods = ((hasCompletedPeriods ? nextState.completedPeriods : get().completedPeriods) ?? [{subjectsTaken: []}]) as StudyPeriodData[];

                const subjectsCompleted = completedPeriods.map(p => p.subjectsTaken.map(s=>s)).flat();
                const subjectsTaken = hasSubTaken ? nextState.subjectsTaken : get().subjectsTaken;
                let subjectsTakenIds: string[] = (subjectsTaken ?? []).map(subject=>subject.id);

                nextState.subjectsTakenSet = new Set<string>(subjectsTakenIds);
                nextState.subjectsCompleted = subjectsCompleted;
                nextState.subjectsCompletedSet = new Set<string>(subjectsCompleted.map(s=>s.id));
            }
        }
        return set(nextState, replace);
    };
    api.setState = interceptedSet;
    return config(interceptedSet, get, api);
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
export const useDegreeStore = create<DegreeState>()((
    degreeInterceptor(() => ({
        selectedProgram: undefined,
        selectedProgramSequence: undefined,
        startPeriod: "autumn",

        completedPeriods: [],
        currentPeriod: { period: "autumn", subjectsTaken: [] },
        subjectsTaken: [],
        subjectsTakenSet: new Set<string>(),
        subjectsCompleted: [],
        subjectsCompletedSet: new Set<string>(),
    }))
));