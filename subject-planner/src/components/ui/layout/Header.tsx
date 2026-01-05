import React, { Dispatch, SetStateAction } from "react";
import HelpWindow from "../HelpWindow";
import Link from "next/link";

const Header = ({ showHelp, onSetShowHelp }: {showHelp: boolean;
    firstShowHelp: boolean;
    onSetShowHelp: Dispatch<SetStateAction<boolean>>;
    }) => {
    return (
        <div className="h-16 w-screen absolute top-0 z-30 shadow-md">
            <div className="container mx-auto h-full flex items-center justify-between px-4">
                <div className="font-extrabold text-2xl">
                    <Link href={"/"} >DegreePlanner</Link>
                </div>
                <div>
                    <HelpWindow showHelp={showHelp} onSetShowHelp={onSetShowHelp} />
                </div>
            </div>
        </div>
    );
};

export default Header;
