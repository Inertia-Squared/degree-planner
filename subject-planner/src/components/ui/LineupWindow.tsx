import React, { Dispatch, SetStateAction } from 'react'
import { BiSearch } from 'react-icons/bi';
import { BsArrowUpShort } from 'react-icons/bs';

const LineupWindow = ({
    showLineup,
    setShowLineup
}: {
    showLineup: boolean
    setShowLineup: (value: SetStateAction<boolean>) => void
}) => {
  return (
    <div
        onClick={() => {
          setShowLineup(!showLineup);
        }}
        className='cursor-pointer text-lg font-bold'
      >
        <span className={`${showLineup && "text-blue-800"}`}>Search</span>
      </div>
  )
}

export default LineupWindow