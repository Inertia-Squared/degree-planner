# Purpose
The purpose of the structure guide is to provide a consistent format for anything relating to integration of a specific
handbook with the degree planner web application.

# Structure
The top-level entry must be placed in the `${PROJECT}/data-scraping/handbooks/` directory.
## Example
```
WSU (top-level)
|-- 2025 (handbook entry)
|   |-- data
|   |   |-- .gitkeep
|   |   |-- ...
|   |-- schema
|   |   |-- ...
|   |-- procedures
        |-- db
        |-- extract
|       |-- ...
|-- 2026
    |-- data
    |   |-- .gitkeep
    |   |-- ...
    |-- schema
    |   |-- ...
    |-- procedures
        |-- ...
```

## Top-Level
The top-level entry should be a university or some other organisation with a similar curriculum structure.

## Handbook Entry
The handbook entry is placed under a top-level entry, and is a specific version of a handbook provided by the top-level 
org. While the example above is organised by year, this can be any distinct version, and does not need to be limited to 
a specific time span.

For example, the 2025 Handbook provides entries from ~2022-2025, and the 2026 handbook provides entries from ~2024-2026.

## Handbook Entry Categories
Each handbook entry must have three categories: `/data/`, `/schema/`, and `/procedures/`.
Items within these categories can have any organisational structure which the specific handbook calls for, 
but try to keep it neat and tidy.

### Data
The `/data/` category is where any generated files are stored.

The folder is tracked in version control, but its subcontents should always be excluded.
This ensures the `/data/` folder is always present, allowing scripts to assume it exists 
and does not need to be created. 

*You MUST add an empty .gitkeep file into your `/data/` directory to ensure it is included in version control.

As a special case, the `.../data/snapshots/` folder and its contents are tracked in version control.
This is intended to be used for demo data to allow other developers to quickly test a specific handbook edition
without needing to hit handbook servers with unnecessary traffic.

Please limit the file size of these snapshots, as this repository is not intended to be used for file storage.

### Schema
The `/schema/` category should contain type interfaces and implementation contracts for the scraped data.

### Procedures
The `/procedures/` category should contain the majority of your logic. Some exceptions are allowed for small
and specific functions in the `/schema/` category, but please only place functions in `/schema/` if it makes sense to do so.

There are a couple of standard subdirectories that most implementations are expected to have:
- `/extract/`: Scripts related to scraping or API queries.
- `/db/`: Scripts responsible for interfacing with the DBUploader API
- `/test/`: Scripts for testing and validation harnesses