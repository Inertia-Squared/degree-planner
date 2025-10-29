import {StudyPeriodItem} from "@/app/page";

interface TimelineProps {
    className?: string,
    completedPeriods: StudyPeriodItem[],
    currentPeriod: StudyPeriodItem,
}

export const CourseTimeline = ({className, completedPeriods, currentPeriod}: TimelineProps) => {
    return (<div className={`flex flex-col ${className}`}>
        {completedPeriods.map((period, index) => {
            return (<div className={`flex flex-col`} key={index}>
                <div>{period.period}</div>
                {period.subjectsTaken.map(s=>{
                    return (<div className={`flex flex-col`} key={s.id}>{s.data.code}</div>)
                })}
            </div>)
        })}
        <div className={`flex flex-col`}>
            <div>{currentPeriod.period}</div>
            {currentPeriod.subjectsTaken.map(s=>{
                return (<div className={`flex flex-col`} key={s.id}>{s.data.code}</div>)
            })}
        </div>
    </div>)
}

