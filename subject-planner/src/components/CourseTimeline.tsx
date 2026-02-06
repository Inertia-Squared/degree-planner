import { TimelineProps } from "@/utils/types";
import { RxCross2 } from "react-icons/rx";

export const CourseTimeline = ({
    className,
    completedPeriods,
    currentPeriod,
    onSkipPeriod,
    showTimeLine,
    setShowTimeLine,
}: TimelineProps) => {
    return (
        <>
            {showTimeLine && (
                <div className={`w-full flex flex-col ${className}`}>
                    <div className={`w-full flex font-bold text-xl justify-between items-center`}>
                        <div>Degree Timeline</div>
                        <div className='cursor-pointer' onClick={() => setShowTimeLine(!showTimeLine)}>
                            <RxCross2 size={24} />
                        </div>
                    </div>
                    <div>This panel shows all your chosen subjects. Changing selections is in the next update.</div>
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
                            <div>Double-tap on a node to add subject</div>
                            {currentPeriod.subjectsTaken.map((s) => {
                                return (
                                    <div className={`flex flex-col px-2`} key={s.id}>
                                        {s.data.code}
                                    </div>
                                );
                            })}
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
                </div>
            )}
        </>
    );
};
