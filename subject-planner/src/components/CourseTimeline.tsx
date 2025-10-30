import {StudyPeriodItem} from "@/app/page";
import {useState} from "react";
import {BsArrowLeftShort, BsArrowRightShort} from "react-icons/bs";

interface TimelineProps {
    className?: string,
    completedPeriods: StudyPeriodItem[],
    currentPeriod: StudyPeriodItem,
    onSkipPeriod: (oldPeriod: StudyPeriodItem) => void,
}

export const CourseTimeline = ({className, completedPeriods, currentPeriod, onSkipPeriod}: TimelineProps) => {
    const [show, setShow] = useState(true);

    if (show) {
        return (
            <div className={`flex flex-col ${className}`}>
                <div className={`flex flex-row font-bold text-center text-xl items-center mx-2`}>
                    <div className={`grow`}></div>
                    <div className={`grow`}>Degree Timeline</div>
                    <div className={`flex hover:cursor-pointer grow`} onClick={()=>setShow(!show)}><div className={`grow`}/><BsArrowLeftShort size={24}/></div>
                </div>
                <div className={`text-xs`}>This panel shows all your chosen subjects. Changing selections is in the next update.</div>
                <hr/>
                <hr/>
                <hr/>
                <div className={'flex flex-col overflow-y-scroll'}>
                    {completedPeriods.map((period, index) => {
                        return (<div className={`flex flex-col`} key={index}>
                            <div className={`mx-auto font-bold`}>{period.period.toUpperCase()}</div>
                            <hr/>
                            {period.subjectsTaken.map(s=>{
                                return (<div className={`flex flex-col`} key={s.id}>{s.data.code}</div>)
                            })}
                        </div>)
                    })}
                    <div className={`flex flex-col`}>
                        <div className={`mx-auto font-bold`}>{currentPeriod.period.toUpperCase()}</div>
                        <hr/>
                        {currentPeriod.subjectsTaken.map(s=>{
                            return (<div className={`flex flex-col`} key={s.id}>{s.data.code}</div>)
                        })}
                        <div className={`text-xs text-center border bg-green-400 w-2/3 mx-auto mt-1 rounded-sm`} onClick={()=>onSkipPeriod(currentPeriod)}>Skip This Semester<br/>(Take {currentPeriod.subjectsTaken.length} subject{currentPeriod.subjectsTaken.length!==1 ? 's' : ''})</div>
                    </div>
                </div>
            </div>)
    } else {
        return (<div className={`hover:cursor-pointer absolute z-20 left-0 top-4/5 bottom-1/5 border-2 rounded-r-md w-8 h-8 bg-white `} onClick={()=>setShow(!show)}><BsArrowRightShort className={'z-30'} size={30}/></div>);
    }
}

