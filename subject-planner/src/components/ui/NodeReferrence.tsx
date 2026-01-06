import { ExtendedNode, Generic } from "@/utils/types";
import Image from "next/image";
import React, { SetStateAction } from "react";
import { PiGraphBold } from "react-icons/pi";

const NodeReferrence = (
    // {
    // setShowKey,
    // showKey,
    // firstShowLineup,
    // setFirstShowKey,
    // firstShowKey,
    // nodes,
// }: {
    // setShowKey: (value: SetStateAction<boolean>) => void;
    // showKey: boolean;
    // firstShowLineup?: boolean;
    // setFirstShowKey?: (value: SetStateAction<boolean>) => void;
    // firstShowKey?: boolean;
    // nodes: ExtendedNode<Generic>[];
// }
) => {
    return (
        <div
            // onClick={() => {
            // setShowKey(!showKey);
            // if (!firstShowLineup) setFirstShowKey(false);
            // }}
            className={`absolute top-24 right-0 z-20 flex flex-row`}
        >
            <Image
                alt={"Legend for different node types"}
                className={`border bg-white px-1.5 max-w-[400px] min-w-[250px] w-full overflow-y-scroll`}
                src={"/nodes.jpg"}
                width={500}
                height={500}
            />
        </div>
    );
};

export default NodeReferrence;
