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
const SALES_MAN = process.env.SALES_MAN

const openai = new OpenAI({
    apiKey: apiKey, // Replace with your OpenAI API key
});

// Existing predefined image URLs
const imageUrls = [
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344722/PHOTO-2021-10-19-10-47-56_drwkuk.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344722/PHOTO-2021-10-19-10-47-56_2_soq39w.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344722/PHOTO-2021-10-19-10-47-56_1_dvdnc4.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344722/PHOTO-2021-10-19-10-47-56_3_g2miyt.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_4_mvznw7.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_5_nixozh.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_8_bbzozr.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_6_iijfw5.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_7_yca55k.jpg',
    'https://res.cloudinary.com/di5lcdswr/image/upload/v1705344721/PHOTO-2021-10-19-10-47-56_9_cxiuul.jpg'
];

const mapUrl = 'https://maps.app.goo.gl/4k8YVGdaEBsiKntL8?g_st=ic';

// A set to cache message IDs to prevent duplicates
const messageCache = new Set();

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

const sendMultipleImages = async (phone_no_id, token, recipientNumber) => {
    for (const imageUrl of imageUrls) {
        try {
            await axios({
                method: "POST",
                url: `https://graph.facebook.com/v13.0/${phone_no_id}/messages?access_token=${token}`,
                data: {
                    messaging_product: "whatsapp",
                    to: recipientNumber,
                    type: "image",
                    image: {
                        link: imageUrl
                    }
                },
                headers: {
                    "Content-Type": "application/json"
                }
            });
            console.log(`Message sent successfully: Image URL - ${imageUrl}`);
        } catch (error) {
            console.error(`Error sending image ${imageUrl}:`, error);
        }
    }
    return('the images have been sent successfully, inform the client that you have sent the property images to take a look')
}

const sendMapUrl = async (phone_no_id, token, recipientNumber, mapUrl) => {
    try {
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v13.0/${phone_no_id}/messages?access_token=${token}`,
            data: {
                messaging_product: "whatsapp",
                to: recipientNumber,
                type: "text",
                text: {
                    preview_url: true,
                    body: mapUrl 
                }
            },
            headers: {
                "Content-Type": "application/json"
            }
        });
        console.log('Map URL sent successfully');
        return "Map URL sent successfully - tell the user about that";
    } catch (error) {
        console.error('Error sending map URL:', error);
    }
};

const sendSalesMan = async (phone_no_id, token, recipientNumber, firstName, lastName, email) => {
    try {
        const msg = await axios({
            method: "POST",
            url: `https://graph.facebook.com/v13.0/${phone_no_id}/messages?access_token=${token}`,
            data: {
                messaging_product: "whatsapp",
                to: SALES_MAN,
                type: "text",
                text: {
                    body:  `A new customer added to the CRM. This is their information: Full Name: ${firstName} ${lastName}, Phone Number: ${recipientNumber}, Email: ${email}`
                }
            },
            headers: {
                "Content-Type": "application/json"
            }
        });
        console.log(SALES_MAN);
        console.log(msg);
        
        console.log('Map URL sent successfully');
        return "Map URL sent successfully - tell the user about that";
    } catch (error) {
        console.error('Error sending map URL:', error);
    }
};

async function addContact(phone_no_id, token, recipientNumber, firstName, lastName, email) {
    console.log(phone_no_id, token, recipientNumber, firstName, lastName, email);
    const baseUrl = 'https://b24-gvi2xb.bitrix24.com/rest/1/4e86q5si6pbop24j/crm.contact.add.json';
    const url = `${baseUrl}?FIELDS[NAME]=${encodeURIComponent(firstName)}&FIELDS[LAST_NAME]=${encodeURIComponent(lastName)}&FIELDS[EMAIL][0][VALUE]=${encodeURIComponent(email)}&FIELDS[PHONE][0][VALUE]=${encodeURIComponent(recipientNumber)}`;
    console.log("url", url);
    try {
        const response = await axios.get(url);

        // Call sendSalesMan after successfully adding the contact
        const salesManResponse = await sendSalesMan(phone_no_id, token, recipientNumber, firstName, lastName, email);

        return "The customer contact has been saved - don't tell the customer about that it's just for our backend"; 
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

async function getOrCreateThreadId(phoneNumber) {
    let usersThreads;
    try {
      const data = fs.readFileSync('users_threads.json');
      usersThreads = JSON.parse(data);
    } catch (err) {
      console.error('Error reading file:', err);
      return null;
    }
  
    const existingThread = usersThreads.find(user => user['customer phone number'] === phoneNumber);
    if (existingThread) {
      return existingThread['thread id'];
    }
  
    const newThreadId = await openai.beta.threads.create();
  
    usersThreads.push({ 'customer phone number': phoneNumber, 'thread id': newThreadId });
  
    try {
      fs.writeFileSync('users_threads.json', JSON.stringify(usersThreads, null, 2));
    } catch (err) {
      console.error('Error writing file:', err);
      return null;
    }
  
    return newThreadId;
}

// Additional functions from second script:

// Fetch image from WhatsApp and convert to base64
async function fetchImageUrl(imageId) {
    try {
        const response = await axios({
            method: 'GET',
            url: `https://graph.facebook.com/v14.0/${imageId}`,
            headers: {
                Authorization: `Bearer ${token}`,
            }
        });

        const imageUrl = response.data.url; 
        console.log('Fetched image URL:', imageUrl);

        // Download the image content
        const imageResponse = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'arraybuffer',
            headers: {
                Authorization: `Bearer ${token}`,
            }
        });

        // Convert the binary image data to base64
        const imageBase64 = Buffer.from(imageResponse.data, 'binary').toString('base64');
        return `data:image/jpeg;base64,${imageBase64}`;
    } catch (error) {
        console.error('Error fetching image from WhatsApp:', error);
        return null;
    }
}

// Process image through OpenAI gpt-4o model for description
async function processImage(imageUrl) {
    try {
        // Using chat completion with gpt-4o model to describe the image
        // Note: This assumes you have access to the gpt-4o model in your OpenAI instance.
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    "role": "user",
                    "content": [
                        { "type": "text", "text": "Describe this image in details" },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                                details: "high"
                            }
                        }
                    ],
                },
            ],
            max_tokens: 300,
        });

        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error processing image:', error);
        return 'Error processing image.';
    }
}

// Main function to get assistant response
const getAssistantResponse = async function(prompt, phone_no_id, token, recipientNumber) {
    const thread = await getOrCreateThreadId(recipientNumber);
    
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
                break; 
            } else if (runStatus.status === 'requires_action') {
                console.log("Requires action");
            
                const requiredActions = runStatus.required_action.submit_tool_outputs.tool_calls;
                console.log(requiredActions);

                // Dispatch table from first script features
                const dispatchTable = {
                    "sendMultipleImages": sendMultipleImages,
                    "sendMapUrl": sendMapUrl,
                    "addContact": addContact
                };
            
                let toolsOutput = [];
            
                for (const action of requiredActions) {
                    const funcName = action.function.name;
                    const functionArguments = JSON.parse(action.function.arguments);

                    if (dispatchTable[funcName]) {
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
  
    return await checkStatusAndPrintMessages(thread.id, run.id);
};

// Function to process the incoming message asynchronously
async function processMessage(body_param) {
    if(body_param.object){
        if(body_param.entry &&
           body_param.entry[0].changes &&
           body_param.entry[0].changes[0].value.messages &&
           body_param.entry[0].changes[0].value.messages[0]
        ){
            let message = body_param.entry[0].changes[0].value.messages[0];
            let messageId = message.id;
            let phone_no_id = body_param.entry[0].changes[0].value.metadata.phone_number_id;
            let from = message.from;
            let msg_body;

            // Prevent duplicate processing
            if (messageCache.has(messageId)) {
                console.log('Duplicate message received and ignored:', messageId);
                return;
            } else {
                console.log('Processing new message:', messageId);
                messageCache.add(messageId);
                setTimeout(() => {
                    messageCache.delete(messageId);
                }, 300000); // 5 minutes
            }

            // Check if user wants to reset conversation
            if (message.text && message.text.body === '1') {
                let usersThreads = [];
                try {
                    const data = fs.readFileSync('users_threads.json');
                    usersThreads = JSON.parse(data);
                } catch (err) {
                    console.error('Error reading file:', err);
                }

                const filteredThreads = usersThreads.filter(user => user['customer phone number'] !== from);

                try {
                    fs.writeFileSync('users_threads.json', JSON.stringify(filteredThreads, null, 2));
                    console.log(`Thread for user ${from} has been reset`);
                } catch (err) {
                    console.error('Error writing file:', err);
                }

                msg_body = 'Hey'; // After reset, start fresh
            } else if (message.text) {
                msg_body = message.text.body;
            } else if (message.image) {
                const imageId = message.image.id;
                console.log('Fetching image with ID:', imageId);

                const base64Image = await fetchImageUrl(imageId);
                if (base64Image) {
                    const imageDescription = await processImage(base64Image);
                    msg_body = `System: The user has sent the product image\nImage Description: ${imageDescription}`;
                    console.log(msg_body);
                } else {
                    msg_body = 'System: Error fetching image from WhatsApp.';
                }
            } else if (message.video) {
                msg_body = 'System: The user has sent the product video';
                console.log(msg_body);
            } else {
                msg_body = 'System: The user has sent a media message';
                console.log(msg_body);
            }

            let assistantResponse = await getAssistantResponse(msg_body, phone_no_id, token, from);

            console.log("Assistant response:", assistantResponse);

            axios({
                method: "POST",
                url: `https://graph.facebook.com/v13.0/${phone_no_id}/messages?access_token=${token}`,
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
            }).catch(err => {
                console.error('Error sending message:', err);
            });
        }
    }
}

// Immediate ACK and then async process the message
app.post("/webhook", async (req, res) => {
    res.status(200).send('ACK');  // Immediate acknowledgment
    console.log("Received a webhook request");
    let body_param = req.body;
    console.log("Webhook request body:", JSON.stringify(body_param, null, 2));
    processMessage(body_param); // Process message asynchronously
});

app.get("/", (req, res) =>{
    res.status(200).send("hello bro");
});
