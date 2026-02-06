import React, { Dispatch, SetStateAction } from "react";

const TimeLineWindow = ({
    showTimeLine,
    setShowTimeLine,
}: {
    showTimeLine: boolean;
    setShowTimeLine: Dispatch<SetStateAction<boolean>>;
}) => {
    return (
        <div
            onClick={() => {
                setShowTimeLine(!showTimeLine);
            }}
            className="cursor-pointer text-lg font-bold"
        >
            <span className={`${showTimeLine && "text-[#7CB342]"}`}>Timeline</span>
        </div>
    );
};

export default TimeLineWindow;
