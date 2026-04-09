import {ExtendedNode, Generic, OfferStatus, Program, StudyPeriod, StudyPeriodItem, Subject} from "@/utils/types";
import {asStudyPeriod} from "@/lib/graph/graphUtil";
import {useGraphDataStore} from "@/app/store/graphStore";
import {getProgramsInterface} from "@/app/api/graph/getPrograms/route";
import {useDegreeStore} from "@/app/store/degreeStore";
import {updateGraphVisualisation} from "@/app/store/graphActions";

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

export function getCompletedSubjects(): ExtendedNode<Subject>[] {
    return useDegreeStore.getState().completedPeriods.map((p) => p.subjectsTaken).flat() as ExtendedNode<Subject>[];
}

export function hasTaken(node: ExtendedNode<Generic>) {
    return useDegreeStore.getState().subjectsTaken.some((n) => n.id === node.id);
}