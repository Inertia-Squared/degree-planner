import React, { Dispatch, SetStateAction } from "react";
import HelpWindow from "../HelpWindow";
import Link from "next/link";
import LineupWindow from "../LineupWindow";

const Header = ({
    showHelp,
    onSetShowHelp,
    showLineup,
    firstShowLineup,
    firstShowHelp,
    setShowLineup,
}: {
    showHelp: boolean;
    firstShowHelp: boolean;
    onSetShowHelp: Dispatch<SetStateAction<boolean>>;
    showLineup: boolean;
    firstShowLineup: boolean;
    setShowLineup: (value: SetStateAction<boolean>) => void;
}) => {
    return (
        <div className="h-16 w-screen absolute top-0 z-30 shadow-md backdrop-blur-md">
            <div className="container mx-auto h-full flex items-center justify-between px-4">
                <div className="font-extrabold text-2xl">
                    <Link href={"/"}>DegreePlanner</Link>
                </div>
                <div className="h-full flex items-center space-x-4 ">
                    <LineupWindow
                        showLineup={showLineup}
                        setShowLineup={setShowLineup}
                    />
                    <HelpWindow showHelp={showHelp} onSetShowHelp={onSetShowHelp} />
                </div>
            </div>
        </div>
    );
};

export default Header;
