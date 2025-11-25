# Setup/Installation
- Download and install [Neo4j Desktop](https://neo4j.com/download/).

- Create a new database using default values (username: neo4j + Password)

- Your password should be saved in your .env file (which should be in ```[Project Root]/data-scraping```) as NEO4J_PASSWORD

- Before running the scraper or website, ensure Neo4j is open and you have started the server instance

- If running the LLM inference online, you must add a GEMINI_API_KEY to your .env
  - If running a local model, see the instructions in 'Extra Stuff' below to install and set up [LMStudio](https://lmstudio.ai/)
- You will need to run ```npm i``` for both the data-scraping and subject-planner directories, as they are technically separate projects. They will be separated soon, but aside from some shared type definitions they are already functionally separate.

# Running the Scraper/DB (Required to run Website)
## Methods
### From Scratch (Requires LLM Inference)
- Set CONFIG.programLinksFile of ```data-scraping/Automation/buildDataFromSubset.ts``` to any JSON file path which is a list of links to WSU handbook programs.
- cd into ```[Project Root]/data-scraping```
- Ensure your .env is in this directory
- Set up your Gemini API key or start LMStudio
  - If using LMStudio, set the CONFIG.modelName to whatever model you chose, you can run ```lms ls``` to view available models.
- Run ```npx tsx Automation/buildDataFromSubset.ts```

### Using a Snapshot (Skips LLM Inference)
- Copy the contents from ```data-scraping/Snapshots/[Snapshot]``` to ```data-scraping/Automation/Data``` (you may need to create the Data folder manually)
- Ensure your working directory is in ```[Project Root]/data-scraping```
- Run ```npx tsx neo4j/upload-data-to-db.ts```

# Running the Website
- cd into subject-planner
- Ensure Neo4J is open and the database has been started
- Add a .env file to the subject-planner folder with your NEO4J_PASSWORD, currently the username is assumed to be neo4j, as the name MUST be neo4j to work when hosting on a terminal-only server (neo4j enterprise restrictions). This might be changed in future, but can cause complications if you don't know about this caveat in advance, so to reduce headaches it will remain hard-coded until there is a good reason to do otherwise.
- run ```npm run dev```
- Your site should be up on localhost:3000

# Contributing
## Style Guide
### File Naming
This project was made under some tight deadlines and was very rushed, which has resulted in some messy code and inconsistencies.
All new files should be in camelCase for non-class files, and PascalCase for class-based/instantiated files (including TypeDefs).

Over time, the other files will be refactored to move in-line with this naming convention.

# Extra Stuff
## Local LLM for Processing Aide
Some fields (such as the subject prerequisites) are done manually and are thus near impossible to process programmatically without an absurd amount of edge-case handling. To remedy this, the application uses local LLMs to process the data.

For the capabilities of my hardware, I generally use the biggest Q4 model I can fit into 16GB of VRAM, but I found the Google's Gemma and MistralAI's Mistral or Magistral models work best.
While generally speaking chain-of-thought models produce better results, the smaller ones hallucinate too much to be worthwhile, so your mileage may vary. The system prompt could also use some work, as currently it will favour moving OR prerequisites into their own nodes, which is inefficient (but technically valid), but attempting to correct this often leads to bad outputs, so some disambiguation may be necessary.

If you can't run a sufficient local model, you can also plug in a Gemini API key and ensure the subject-refiner.ts config has online set to true.

The subject-scraper.ts file uses LM Studio to process the data locally. You can input any model you have downloaded, it's pretty plug-and-play!
