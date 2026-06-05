import {ExtendedNode, NodeStatus, OfferStatus, Program, StudyPeriod, StudyPeriodItem, Subject} from "@/utils/types";
import {asStudyPeriod, isSubjectNode} from "@/lib/graph/graphUtil";
import {useGraphDataStore, useGraphRenderStore} from "@/app/store/graphStore";
import {getProgramsInterface} from "@/app/api/graph/getPrograms/route";
import {useDegreeStore} from "@/app/store/degreeStore";
import {onNodeDoubleClicked, selectElement, updateGraphVisualisation} from "@/app/store/graphActions";
import {wait} from "@/lib/timing";

export async function searchProgram(searchString: string) {
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

export function isOfferedInCurrentPeriod(node: ExtendedNode<Subject>): OfferStatus {
    const currentPeriod = useDegreeStore.getState().currentPeriod;
    if (!node.data.teachingPeriods || node.data.teachingPeriods.length < 1)
        return OfferStatus.UNKNOWN;
    let offerStatus: OfferStatus = OfferStatus.NO;
    node.data.teachingPeriods.map((p) => {
        if (offerStatus === OfferStatus.NO && asStudyPeriod(p) === "unknown")
            offerStatus = OfferStatus.UNKNOWN;
        if (asStudyPeriod(p) === currentPeriod.period) offerStatus = OfferStatus.YES;
    });
    return offerStatus;
}

export function moveToNewPeriod(oldCurrentPeriod: StudyPeriodItem) {
    const {completedPeriods, currentPeriod} = useDegreeStore.getState();

    const newCompletedPeriods = [...(completedPeriods ?? []), oldCurrentPeriod];
    const newCurrentPeriod = {
        period: currentPeriod.period === "autumn" ? "spring" : "autumn" as StudyPeriod,
        subjectsTaken: [] as ExtendedNode<Subject>[],
    };

    useDegreeStore.setState({
        completedPeriods: newCompletedPeriods,
        currentPeriod: newCurrentPeriod,
    });

    updateGraphVisualisation(); // update colour-coding for seasonal offerings
}

export function getSubjectsCompleted(): ExtendedNode<Subject>[] {
    return useDegreeStore.getState().subjectsCompleted;
}

export function getSubjectsTaken(): ExtendedNode<Subject>[] {
    return useDegreeStore.getState().subjectsTaken;
}

export function hasCompleted(node: ExtendedNode<Subject>) {
    return useDegreeStore.getState().subjectsCompletedSet.has(node.id);
}

export function hasTaken(node: ExtendedNode<Subject>) {
    return useDegreeStore.getState().subjectsTakenSet.has(node.id);
}

enum CourseEligibilityStatus {
    UNKNOWN,
    ELIGIBLE_FOUND,
    NONE_IN_SEMESTER,
    NONE_AVAILABLE,
}

let courseEligibilityStatus: CourseEligibilityStatus = CourseEligibilityStatus.UNKNOWN;

export async function solveDegree(){
    while (!isDegreeComplete()){
        const {displayedNodes} = useGraphRenderStore.getState();
        const filteredNodes: ExtendedNode<Subject>[] = displayedNodes.filter(node=>{
            return isSubjectNode(node) && !hasTaken(node) && node.data.status !== NodeStatus.INELIGIBLE;
        }) as ExtendedNode<Subject>[];
        if(filteredNodes && filteredNodes.length > 0){
            courseEligibilityStatus = CourseEligibilityStatus.ELIGIBLE_FOUND;
            const scoredNodes = filteredNodes.map(node=>{
                let score = 0;
                const subjectNumber = node.data.code.match(/\d{4}/g);
                if (subjectNumber !== null) {
                    const amt = Number(subjectNumber[0])/1000;
                    score -= Number.isFinite(amt) ? amt : 0;
                }
                switch (node.data.status) {
                    case NodeStatus.REQUIRED:
                        score += 100;
                        break;
                    case NodeStatus.PREREQUISITE:
                        score += 20;
                        break;
                }
                return {node: node, score: score}
            });
            const sortedNodes =
                scoredNodes.sort((a, b)=> b.score - a.score);
            const id = sortedNodes[0].node.id;
            selectElement(id, true)
            onNodeDoubleClicked(id);
        } else {
            switch (courseEligibilityStatus) {
                case CourseEligibilityStatus.UNKNOWN:
                    console.error('Something has gone very wrong!');
                    break;
                case CourseEligibilityStatus.ELIGIBLE_FOUND:
                    console.warn('Got stuck, skipping to next semester.');
                    courseEligibilityStatus = CourseEligibilityStatus.NONE_IN_SEMESTER;
                    break;
                case CourseEligibilityStatus.NONE_IN_SEMESTER:
                    console.error('Got stuck in both semesters, we cannot complete the degree!');
                    break;
                case CourseEligibilityStatus.NONE_AVAILABLE:
                    console.log('Passing...');
                    break;
            }
        }
        //await wait(500);
    }
}
export function isDegreeComplete(){
    const {displayedNodes} = useGraphRenderStore.getState();
    const subjectRequirementsFulfilled = !displayedNodes.some(node=>
        isSubjectNode(node) && node.data.status === NodeStatus.REQUIRED && !hasTaken(node)
    );

    // TODO: check that choice nodes have been satisfied
    const choiceRequirementsFulfilled = true;

    return subjectRequirementsFulfilled && choiceRequirementsFulfilled;
}