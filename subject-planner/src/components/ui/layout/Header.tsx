import React, { Dispatch, SetStateAction } from "react";
import HelpWindow from "../HelpWindow";
import Link from "next/link";
import LineupWindow from "../LineupWindow";
import TimeLineWindow from '../TimeLineWindow';

const Header = ({
    showHelp,
    onSetShowHelp,
    showLineup,
    setShowLineup,
    showTimeLine,
    setShowTimeLine,
}: {
    showHelp: boolean;
    onSetShowHelp: Dispatch<SetStateAction<boolean>>;
    showLineup: boolean;
    setShowLineup: (value: SetStateAction<boolean>) => void;
    showTimeLine: boolean;
    setShowTimeLine: Dispatch<SetStateAction<boolean>>;
}) => {
    return (
        <div className="h-16 w-screen absolute top-0 z-30 shadow-md backdrop-blur-md">
            <div className="container mx-auto h-full flex items-center justify-between px-4">
                <div className="font-extrabold text-2xl">
                    <Link href={"/"}>Degree <span className='text-[#7CB342]'>Planner</span></Link>
                </div>
                <div className="h-full flex items-center space-x-8">
                    <LineupWindow showLineup={showLineup} setShowLineup={setShowLineup} />
                    <HelpWindow showHelp={showHelp} onSetShowHelp={onSetShowHelp} />
                    <TimeLineWindow showTimeLine={showTimeLine} setShowTimeLine={setShowTimeLine} />
                </div>
            </div>
        </div>
    );
};

export default Header;
