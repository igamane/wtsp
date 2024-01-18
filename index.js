const express = require("express");
const body_parser = require("body-parser");
const axios = require("axios");
const OpenAI = require("openai");
const fs = require('fs');

require("dotenv").config();

const app = express().use(body_parser.json());

const token = process.env.TOKEN;
const mytoken = process.env.MYTOKEN
const apiKey = process.env.OPENAI_API_KEY
const assistantId = process.env.ASSISTANT_ID

const openai = new OpenAI({
    apiKey: apiKey, // Replace with your OpenAI API key
});

app.listen(8000||process.env.PORT, () => {
    console.log("webhook is listening");
});


app.get("/webhook", (req, res) => {
    let mode = req.query["hub.mode"];
    let challenge = req.query["hub.challenge"];
    let token = req.query["hub.verify_token"];
    
    if (mode && token) {
        console.log("&");
        if (mode === "subscribe" && token === mytoken) {
            console.log("hello get");
            res.status(200).send(challenge);
        } else {
            res.status(403);
        }
    }
});

async function getOrCreateThreadId(phoneNumber) {
    let usersThreads;
    try {
      // Read the file synchronously
      const data = fs.readFileSync('users_threads.json');
      usersThreads = JSON.parse(data);
    } catch (err) {
      // Handle errors (e.g., file not found)
      console.error('Error reading file:', err);
      return null;
    }
  
    // Check if the phone number is already in the file
    const existingThread = usersThreads.find(user => user['customer phone number'] === phoneNumber);
    if (existingThread) {
      return existingThread['thread id'];
    }
  
    // Create a new thread id
    const newThreadId = await openai.beta.threads.create();
  
    // Add the new thread to the usersThreads array
    usersThreads.push({ 'customer phone number': phoneNumber, 'thread id': newThreadId });
  
    // Save the updated array back to the file
    try {
      fs.writeFileSync('users_threads.json', JSON.stringify(usersThreads, null, 2));
    } catch (err) {
      // Handle errors (e.g., unable to write to file)
      console.error('Error writing file:', err);
      return null;
    }
  
    return newThreadId;
  }

const getAssistantResponse = async function(prompt, phone_no_id, token, recipientNumber) {
    const thread = await getOrCreateThreadId(recipientNumber);

    console.log(thread.id);

    const message = await openai.beta.threads.messages.create(
        thread.id,
        {
            role: "user",
            content: prompt
        }
        );
        
        const run = await openai.beta.threads.runs.create(
            thread.id,
            { 
                assistant_id: assistantId,
            }
            );
            
    console.log(run.id);
    const checkStatusAndPrintMessages = async (threadId, runId) => {
        let runStatus;
        while (true) {
            runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
            console.log(runStatus.status);
            if (runStatus.status === "completed") {
                break; // Exit the loop if the run status is completed
            } else if (runStatus.status === 'requires_action') {
                console.log("Requires action");
            
                const requiredActions = runStatus.required_action.submit_tool_outputs.tool_calls;
                console.log(requiredActions);

                // Dispatch table
                const dispatchTable = {
                    "retrieve_from_s3_and_send_to_openai": retrieve_from_s3_and_send_to_openai
                };
            
                let toolsOutput = [];
            
                for (const action of requiredActions) {
                    const funcName = action.function.name;
                    const functionArguments = JSON.parse(action.function.arguments);

                    if (dispatchTable[funcName]) {
                        console.log("dispatchTable[funcName]", dispatchTable[funcName]);
                        try {
                            const output = await dispatchTable[funcName](phone_no_id, token, recipientNumber, ...Object.values(functionArguments));
                            console.log(output);
                            toolsOutput.push({ tool_call_id: action.id, output: JSON.stringify(output) });
                        } catch (error) {
                            console.log(`Error executing function ${funcName}: ${error}`);
                        }
                    } else {
                        console.log("Function not found");
                    }
                }
            
                // Submit the tool outputs to Assistant API
                await openai.beta.threads.runs.submitToolOutputs(
                    thread.id,
                    run.id,
                    { tool_outputs: toolsOutput }
                );
            } 
            console.log("Run is not completed yet.");
            await delay(1000); // Wait for 1 second before checking again
        } 
        let messages = await openai.beta.threads.messages.list(threadId);
        console.log("messages", messages)
        return messages.data[0].content[0].text.value
    };
  
    function delay(ms) {
      return new Promise((resolve) => {
          setTimeout(resolve, ms);
      });
    }
  
    // Call checkStatusAndPrintMessages function
    return await checkStatusAndPrintMessages(thread.id, run.id);

} 

app.post("/webhook", async (req, res) => { // I want some [text cut off]    
    console.log("hhhhh");
    let body_param = req.body;
    
    console.log(JSON.stringify(body_param, null, 2));
    
    if(body_param.object){
        if(body_param.entry &&
           body_param.entry[0].changes &&
           body_param.entry[0].changes[0].value.messages &&
           body_param.entry[0].changes[0].value.messages[0]
        ){
            let phone_no_id = body_param.entry[0].changes[0].value.metadata.phone_number_id;
            let from = body_param.entry[0].changes[0].value.messages[0].from;
            let msg_body = body_param.entry[0].changes[0].value.messages[0].text.body;

            let assistantResponse = await getAssistantResponse(msg_body, phone_no_id, token, from);

            console.log("assistantR?esponse", assistantResponse);

            
            

            axios({
                method: "POST",
                url: "https://graph.facebook.com/v13.0/" + phone_no_id + "/messages?access_token=" + token,
                data: {
                    messaging_product: "whatsapp",
                    to: from,
                    text: {
                        body: assistantResponse
                    }
                },
                headers: {
                    "Content-Type": "application/json"
                }
            });
            
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
            
    }
    // Additional code may be needed here to complete the response
});

app.get("/", (req, res) =>{
    res.status(200).send("hello bro");
})
