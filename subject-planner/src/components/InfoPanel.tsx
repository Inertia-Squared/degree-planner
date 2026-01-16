import { GraphEdge } from "reagraph";
import { BsArrowRightShort } from "react-icons/bs";
import { SetStateAction, useEffect, useState } from "react";
import { BiBook } from "react-icons/bi";
import { ExtendedNode } from "@/utils/types";
import { RxCross2 } from "react-icons/rx";

interface InfoPanelProps {
    item: ExtendedNode<any> | GraphEdge | undefined;
    className?: string;
    setShowKey: (value: SetStateAction<boolean>) => void;
    showKey: boolean;
}

const hiddenTerms = [/*'subjectSequences', */ "code"];

const InfoPanel = ({ item, className, showKey, setShowKey }: InfoPanelProps) => {
    const entries = Object.entries(item?.data ?? item ?? []).sort((a, b) => {
        if (a[0].includes("Name")) return -10;
        if (b[0].includes("Name")) return 10;
        if (a[0].includes("type")) return -5;
        if (a[0].includes("school")) return -2;
        if (a[0].includes("disclipline")) return -1;
        return 10;
    });

    const handleCloseInfoPanel = () => {
        setShowKey(!showKey);
    };

    useEffect(() => {
        if(entries.length == 0) setShowKey(true);
    }, [entries, setShowKey])

    return (
        <>
        
            {!showKey && (
                <div className={`flex flex-col ${className}`}>
                    {/* <div className={`flex flex-row font-bold text-center text-xl items-center py-2`}>
                        <div className={`hover:cursor-pointer flex-1`} onClick={handleCloseInfoPanel}>
                            <RxCross2 size={24} />
                        </div>
                        Info Panel
                        <div className={`flex-1`}></div>
                    </div>
                    <div className={`text-sm py-2 border-b-[0.8px]`}>
                        This panel provides info on the selected node.
                    </div> */}
                    <div className={`flex flex-col overflow-y-scroll pb-4`}>
                        <div className={`hover:cursor-pointer flex pt-2 pb-4`} onClick={handleCloseInfoPanel}>
                            <RxCross2 size={24} />
                        </div>
                        {entries.map((e, i) => {
                            let shouldTerminate = false;
                            hiddenTerms.forEach((t) => {
                                if (t == e[0]) shouldTerminate = true;
                            });
                            if (shouldTerminate) return;

                            if (e[0].includes("Link")) {
                                return (
                                    <li key={e[0]} className={`overflow-x-clip`}>
                                        <a
                                            target={"_blank"}
                                            className={`underline text-blue-500`}
                                            key={e[0]}
                                            href={e[1] as string}
                                        >
                                            WSU Handbook
                                        </a>
                                    </li>
                                );
                            } else {
                                return (
                                    <div key={i}>
                                        {i == 0 ? (
                                            <h1 className="text-xl font-bold pb-4 border-b-[0.5px] mb-4">{(e[1] as string).toString()}</h1>
                                        ) : (
                                            <li className={`overflow-x-clip pb-4`}>
                                                <strong>{e[0].charAt(0).toUpperCase() + e[0].slice(1)}</strong>:{" "}
                                                <p className="px-4 py-1">{(e[1] as string).toString() == "[]" ? "No Prerequisites" : (e[1] as string).toString()}</p>
                                            </li>
                                        )}
                                    </div>
                                );
                            }
                        })}
                    </div>
                </div>
            )}
        </>
    );
};

export default InfoPanel;
