import { HeaderItemType } from "@/components/ui/layout/Containers/HeaderBar";
import { WindowContainer } from "@/components/ui/layout/Containers/WindowContainer";
import { useDegreeStore } from "@/app/store/degreeStore";
import { useGraphUIStore } from "@/app/store/graphStore";
import {moveToNewPeriod} from "@/app/store/degreeActions";

export interface TimelineProps {
    className?: string;
}

export const TimelineWindow = ({ className }: TimelineProps) => {
    // Zustand Hooks
    const { completedPeriods, currentPeriod } = useDegreeStore();
    const selectedHeaderItem = useGraphUIStore((state) => state.selectedHeaderItem);

    const itemIdentifier = HeaderItemType.TIMELINE;

    return (
        <>
            {selectedHeaderItem === itemIdentifier && (
                <WindowContainer
                    title={'Degree Timeline'}
                    description={'This panel shows all your chosen subjects, grouped by semster.'}
                    className={className}
                    onClose={() => useGraphUIStore.setState({ selectedHeaderItem: HeaderItemType.NONE })}
                    childElement={
                        <div className={"flex flex-col"}>
                            {completedPeriods.map((period, index) => {
                                return (
                                    <div className={`flex flex-col py-2`} key={index}>
                                        <div className={`font-bold`}>{period.period.toUpperCase()}</div>
                                        {period.subjectsTaken.map((s) => {
                                            return (
                                                <div className={"px-2"} key={s.id}>
                                                    {s.data.code}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                            <div>
                                <div className={`font-bold `}>{currentPeriod.period.toUpperCase()}</div>
                                {currentPeriod.subjectsTaken.map((s) => {
                                    return (
                                        <div className={`flex flex-col px-2`} key={s.id}>
                                            {s.data.code}
                                        </div>
                                    );
                                })}
                                <div>Double-tap on a node to add subject</div>
                                <div
                                    className={`text-center bg-[#7CB342] text-white border-none px-4 py-2 mt-8 rounded-lg font-bold cursor-pointer transition-all duration-200 hover:opacity-80`}
                                    onClick={() => moveToNewPeriod(currentPeriod)}
                                >
                                    <p>Skip This Semester</p>
                                    (Take {currentPeriod.subjectsTaken.length} subject
                                    {currentPeriod.subjectsTaken.length !== 1 ? "s" : ""})
                                </div>
                            </div>
                        </div>
                    }
                />
            )}
        </>
    );
};