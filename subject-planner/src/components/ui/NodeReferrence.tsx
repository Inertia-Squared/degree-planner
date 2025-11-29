import { ExtendedNode, Generic } from "@/utils/types";
import Image from "next/image";
import React, { SetStateAction } from "react";
import { PiGraphBold } from "react-icons/pi";

const NodeReferrence = ({
  setShowKey,
  showKey,
  firstShowLineup,
  setFirstShowKey,
  firstShowKey,
  nodes,
}: {
  setShowKey: (value: SetStateAction<boolean>) => void;
  showKey: boolean;
  firstShowLineup: boolean;
  setFirstShowKey: (value: SetStateAction<boolean>) => void;
  firstShowKey: boolean;
  nodes: ExtendedNode<Generic>[];
}) => {
  return (
    <div
      onClick={() => {
        setShowKey(!showKey);
        if (!firstShowLineup) setFirstShowKey(false);
      }}
      className={`absolute right-0 top-36 z-30 flex flex-row ${
        !showKey
          ? `max-h-8 items-center border border-r-0 rounded-l-md bg-white ${
              firstShowKey && nodes.length > 3 ? "w-12 translate-x-0 !bg-green-300" : "w-8"
            }`
          : ""
      }`}
    >
      <PiGraphBold
        className={`${
          showKey ? `max-h-8 items-center border border-r-0 rounded-l-md bg-white` : ""
        }`}
        size={32}
      />
      {showKey && (
        <Image
          alt={"Legend for different node types"}
          className={`border bg-white px-1.5 max-w-[400px] min-w-[250px] w-full overflow-y-scroll`}
          src={"/nodes.jpg"}
          width={500}
          height={500}
        />
      )}
    </div>
  );
};

export default NodeReferrence;
