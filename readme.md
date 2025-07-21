# Script Run Order
1. link-collector.ts
2. subject-scraper.ts
3. subject-refiner.ts

# Extra Stuff
## Local LLM for Processing Aide
Some fields (such as the subject prerequisites) are done manually and are thus near impossible to process programmatically without an absurd amount of edge-case handling. To remedy this, the application uses local LLMs to process the data.

For my hardware, I use https://model.lmstudio.ai/download/lmstudio-community/gemma-3-12B-it-qat-GGUF for a mix of speed and reliability

But a smaller model should be fine, though the smaller context and brain may lead to more outliers and failure-cases.

The subject-scraper.ts file uses LM Studio to process the data locally. You can input any model you have downloaded, it's pretty plug-and-play, just go to https://lmstudio.ai/, grab the latest version, install the JS package using 
```npm install @lmstudio/sdk --save```
get a model downloaded, and set the model name in the config to match!

example hard-case:
Querying based on subject: TEAC 5019 Mathematics Curriculum 1
Prerequisites:
TEAC 7004 OR TEAC 7161 AND
TEAC 7032 AND
TEAC 7027 OR TEAC 7160
Query Result:  
[
{
"course": "any",
"prerequisites": [
[
"TEAC 7004",
"TEAC 7161"
],
[
"TEAC 7032"
],
[
"TEAC 7027",
"TEAC 7160"
]
]
}
]

