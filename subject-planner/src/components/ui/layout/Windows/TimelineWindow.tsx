import { StudyPeriodItem } from "@/utils/types";
import { HeaderItem, shouldShowItem } from "@/components/ui/layout/Containers/HeaderBar";
import { Dispatch, SetStateAction } from "react";
import { WindowContainer } from "@/components/ui/layout/Containers/WindowContainer";

export interface TimelineProps {
    className?: string;
    completedPeriods: StudyPeriodItem[];
    currentPeriod: StudyPeriodItem;
    onSkipPeriod: (oldPeriod: StudyPeriodItem) => void;
    selectedHeaderItem: HeaderItem;
    setSelectedHeaderItem: Dispatch<SetStateAction<HeaderItem>>;
}

export const TimelineWindow = ({
    className,
    completedPeriods,
    currentPeriod,
    onSkipPeriod,
    selectedHeaderItem,
    setSelectedHeaderItem,
}: TimelineProps) => {
    const itemIdentifier = HeaderItem.TIMELINE;
    return (
        <>
            {shouldShowItem(selectedHeaderItem, itemIdentifier) && (
                <WindowContainer
                    title={"Degree Timeline"}
                    description={"This panel shows all your chosen subjects, grouped by semster."}
                    className={className}
                    onClose={() => setSelectedHeaderItem(HeaderItem.NONE)}
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
                                <div className={`font-bold`}>{currentPeriod.period.toUpperCase()}</div>
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
                                    onClick={() => onSkipPeriod(currentPeriod)}
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
