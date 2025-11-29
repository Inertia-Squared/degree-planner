import React, { Dispatch, SetStateAction } from 'react'
import { BiSearch } from 'react-icons/bi';
import { BsArrowUpShort } from 'react-icons/bs';

const LineupWindow = ({
    showLineup,
    firstShowLineup,
    firstShowHelp,
    setShowLineup
}: {
    showLineup: boolean
    firstShowLineup: boolean
    firstShowHelp: boolean
    setShowLineup: (value: SetStateAction<boolean>) => void
}) => {
  return (
    <div
        className={`flex flex-col items-center border rounded-b-md w-8  hover:cursor-pointer z-20 transform ${
          !showLineup && firstShowLineup && !firstShowHelp
            ? " -translate-y-0.5 h-9 !bg-green-300"
            : " h-6"
        } bg-white`}
        onClick={() => {
          setShowLineup(!showLineup);
        }}
      >
        {showLineup && <BsArrowUpShort size={32} />}
        {!showLineup && (
          <BiSearch
            className={`${firstShowLineup && !firstShowHelp ? "pt-2.5" : ""}`}
            size={32}
          />
        )}
      </div>
  )
}

export default LineupWindow