import { ExtendedNode, Generic } from "@/utils/types";
import Image from "next/image";
import React, { SetStateAction } from "react";
import { PiGraphBold } from "react-icons/pi";

const NodeReferrence = ({
    showKey,
}: {
    // setShowKey: (value: SetStateAction<boolean>) => void;
    showKey: boolean;
}) => {
    return (
        <>
            {showKey && (
                <div
                    // onClick={() => {
                    // setShowKey(!showKey);
                    // if (!firstShowLineup) setFirstShowKey(false);
                    // }}
                    className={`absolute top-20 right-0 z-20 flex flex-row`}
                >
                    <Image
                        alt={"Legend for different node types"}
                        className={`border bg-white px-1.5 max-w-[380px] min-w-[250px] w-full overflow-y-scroll`}
                        src={"/nodes.jpg"}
                        width={500}
                        height={500}
                    />
                </div>
            )}
        </>
    );
};

export default NodeReferrence;
