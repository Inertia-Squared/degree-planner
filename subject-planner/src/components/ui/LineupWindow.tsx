import React, { Dispatch, SetStateAction } from "react";

const LineupWindow = ({
    showLineup,
    setShowLineup,
}: {
    showLineup: boolean;
    setShowLineup: (value: SetStateAction<boolean>) => void;
}) => {
    return (
        <div
            onClick={() => {
                setShowLineup(!showLineup);
            }}
            className="cursor-pointer text-lg font-bold"
        >
            <span className={`${showLineup && "text-[#7CB342]"}`}>Search</span>
        </div>
    );
};

export default LineupWindow;
