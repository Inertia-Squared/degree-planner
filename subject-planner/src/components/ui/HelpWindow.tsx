import React, { Dispatch, SetStateAction } from "react";
import { BsQuestion } from "react-icons/bs";

const HelpWindow = ({
  showHelp,
  firstShowHelp,
  onSetShowHelp,
  onSetFirstShowHelp,
}: {
  showHelp: boolean;
  firstShowHelp: boolean;
  onSetShowHelp: Dispatch<SetStateAction<boolean>>;
  onSetFirstShowHelp: Dispatch<SetStateAction<boolean>>;
}) => {
  return (
    <div
      onClick={() => {
        onSetShowHelp(!showHelp);
        onSetFirstShowHelp(false);
      }}
      className={`absolute right-0 top-24 z-31 flex flex-row ${
        !showHelp
          ? `max-h-8 items-center border border-r-0 rounded-l-md bg-white ${
              firstShowHelp
                ? "animate-bounceright w-12 translate-x-0 !bg-green-300"
                : "w-8"
            }`
          : ""
      }`}
    >
      <BsQuestion
        className={`${
          showHelp
            ? `max-h-8 items-center border border-r-0 rounded-l-md bg-white`
            : ""
        }`}
        size={32}
      />
      {showHelp && (
        <div
          className={`border rounded-bl-lg px-1.5 max-w-[400px] w-full min-w-[250px] overflow-y-scroll bg-white`}
        >
          Welcome to <strong>MyDegree.help!</strong> To get started, you can
          type part or all of a program name into the search bar, the dropdown
          will fill automatically with any matching courses.
          <br />
          <br /> Selecting a Major or Minor is optional (if you don't want one,
          just don't select it), once you are happy with your choices, click
          'Start Exploring' to plan your degree!
          <br />
          <br />
          <strong>IMPORTANT:</strong>
          <br />
          <ul>
            <li>- To view information about a node, click it once.</li>
            <li>
              - To add a subject to your Degree Timeline, double-click it. You
              can only add subjects you are eligible for (i.e. are not greyed
              out)
            </li>
            <li>
              - As you complete more subjects, you will be eligible for the
              subjects that were previously greyed out.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default HelpWindow;
