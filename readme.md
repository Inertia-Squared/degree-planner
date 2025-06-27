# Extra Stuff
## Local LLM for Processing Aide
Some fields (such as the subject prerequisites) are done manually and are thus near impossible to process programmatically without an absurd amount of edge-case handling. To remedy this, the application uses local LLMs to process the data.

For my hardware, I use https://model.lmstudio.ai/download/lmstudio-community/gemma-3-12B-it-qat-GGUF for a mix of speed and reliability

But a smaller model should be fine, though the smaller context and brain may lead to more outliers and failure-cases.

The subject-scraper.ts file uses LM Studio to process the data locally. You can input any model you have downloaded, it's pretty plug-and-play, just go to https://lmstudio.ai/, grab the latest version, install the JS package using 
```npm install @lmstudio/sdk --save```
get a model downloaded, and set the model name in the config to match!

