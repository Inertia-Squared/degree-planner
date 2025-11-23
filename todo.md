# Improvements
## Degree Planning
### Recommendation Engine / Solver
Implement recommendation engine that can suggest or autocomplete a degree lineup given any combination of program, major, or minor.

Should also be able to score potential paths based on a set of sane defaults that the user can customise (e.g. preferred 
campus, assessment type etc.)should first explore paths as if preferences are a requirement, then if none can be found 
(e.g. required subject runs on a non-preferred campus only), it will then prioritise paths that meet as many criteria as 
possible, and inform the user of what preferences couldn't be met.

### More Filter Details
Add ability to view and filter/cluster subject by:
- Campus offered (partially implemented for program sequences)
- Subject Assessment Information
- 'Extra Info' - anything we scrape that we can't categorise should still be shown to the user, we'll need to find a way to make this organised and well-formatted. Maybe more LLM postprocessing with a style guide?

### Import/Export Plan
Implement ability to export plan as a Spreadsheet or Link (spreadsheet for reference, Link for saving/sharing).
The Link system should be deterministic and consistent between different versions of the database (as long as the relevant 
data is still present).

### Prerequisites Subgraph in InfoPanel
Implement subgraph in a mini-viewport that renders in the InfoPanel which shows all prerequisite nodes that are required first.

### Reorder Subject Selection
Implement ability to reorder subjects in the degree timeline panel and automatically check if the new order is valid.
If not valid, the app should suggest the minimal amount of changes required to make it a valid lineup.

## UX
### Improved Onboarding / Guided Tutorial
Implement a guided tutorial which walks the user step-by step through the process of planning a degree with a short 
hand-crafted example case.
### Tool-Based Interactions
Eliminate UI elements by constraining interactions to context-based tools use.

An example of how this could look:
- Selection Tool
  - Left Click: Add Subject to Lineup
  - Right Click: Remove Subject from Lineup (when reordering is added)
  - Hover: Show node info in Info Panel
    - Static Hover (hover mouse over node then keep it still): Show node info in floating panel where mouse cursor is located, dismissed by mouse going too far from the panel.
- Analysis Tool
  - Left Click: Dropdown next to mouse to select which property to cluster by
    - Left Click on canvas (nothing): stop clustering
  - Right Click: Dropdown next to mouse to select which property/value to include or exclude (filter should be applied after normal Orphan node pruning to show orphans)
    - Right Click on canvas (nothing): stop filtering
  - Middle Click on canvas (nothing): Stop clustering and filtering
  - Hover: Show node info in Info Panel
    - Static Hover (hover mouse over node then keep it still): Show ndoe info in floating panel where mouse cursor is located, dismissed by mouse going too far from the panel. Provides contextual information based on current clustering/filters.
- Info Tool
  - Left Click: Show popup with detailed information about node and related nodes, organised by tabs
  - Right Click: User can add personal notes to that node, stored in PersistentStorage for future visits
- Validation Tool
  - Left Click: Auto-complete node selection up until required node (i.e. automatically select prerequisite nodes until selected node is valid, then select that node) - could possibly be the default behaviour in future?
  - Right Click: List potential valid paths for user to select instead of picking the 'best' one.
  - Middle Click: Advanced Popup to configure solver to prioritise or penalise certain node characteristics when scoring potential paths.
  - Hover: Show node info in Info Panel
    - Static Hover (hover mouse over node then keep it still): Show node info in floating panel where mouse cursor is located, dismissed by mouse going too far from the panel. Provides contextual information based on prerequisites / possible paths?

### Remember Onboarded Users
Keep if a user has completed onboarding in PersistentStorage, and don't onboard them again if they *completed* onboarding previously

User should be given the option to do onboarding again at any time.

### Undo/Redo system
This will essentially be a more limited implementation of the reordering logic, so this should be designed as a subset to 
build the reordering from, or implemented after reordering is completed.

## Backend
### Separate WSU-Specific Datastructures from data model
Keep data model open and modular, we will likely need one or two other example universities in order to do this properly 
without shooting ourselves in the foot.

### Auto-generate Neo4J Schema
Currently, the schema is defined in TS and in plaintext JSON for Neo4J. Because the Autocomplete is useful, the DataType 
should be moved into its own file, and then a script should be written to parse the TS file into a JSON usable by Neo4J

### Refactor Data Names
Originally, all data/field names had to be unique to prevent overlapping.

However, this gets quite messy, as instead of just the field 'name', we have 'programName', 'subjectName', etc.

Now that helper functions have been implemented to ensure queries with identical fields between two objects are automatically 
made unique, all data fields should be refactored so that the same type of data/field has the same name, as it makes certain features for autocomplete, analysis, and clustering more trivial.

---
# Fixes
## General
- Fix bug where occasionally when selecting the last subject for a semester, it is added but does not show as selected in the graph view.
## Refactoring/Cleanup
### Modularise page.tsx
Currently, page.tsx is far too bloated, UI components need to be modularised and have props passed down.
### Move Nodes Logic in page.tsx to Separate File
Node render, filter, and API logic is currently in the page.tsx file, this should be moved to its own GraphManager.tsx file.
## Known Fail-Cases
### Bachelor of Arts | Major: 0026, Minor: 0024
- Not all required prerequisite subjects are shown.

- Appears to be caused by unusual chain of prerequisite node pointing to a choice node.

- Haven't checked if it is missing on the client side or the server side. 

- Will likely need to update filters while accounting for relationship label to prevent graph bloat.
