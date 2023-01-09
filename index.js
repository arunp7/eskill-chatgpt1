
'use strict'
const cote = require('cote')
const u = require('@elife/utils')
const axios = require('axios')
const https = require('https')
require('dotenv').config()


var sModel = "text-davinci-003";
var iMaxTokens = 2048;
var sUserId = "1";
var dTemperature = 0.5;  
var OPENAI_API_KEY = process.env.CHATGPT_APIKEY;
     
const headers = {
    'Content-Type': 'application/json',
    "Accept": "application/json",
    "Authorization": "Bearer " + OPENAI_API_KEY,

}

function main() {
    startMicroservice()
    registerWithCommMgr()
}


let msKey = 'everlife-chat-gpt'


/*      outcome/
 * Register ourselves as a message handler with the communication
 * manager so we can handle requests for secret messages.
 */
function registerWithCommMgr() {
    commMgrClient.send({
        type: 'register-msg-handler',
        mskey: msKey,
        mstype: 'msg',
        mshelp: [ { cmd: '/chatgpt', txt: "Get replies from OpenAIs's chatgpt server" } ],
    }, (err) => {
        if(err) u.showErr(err)
    })
}


const commMgrClient = new cote.Requester({
    name: 'ChatGPT Skill -> CommMgr',
    key: 'everlife-communication-svc',
})

function sendReply(msg, req) {
    req.type = 'reply'
    req.msg = String(msg)
    commMgrClient.send(req, (err) => {
        if(err) u.showErr(err)
    })
}

function startMicroservice() {

    /*      understand/
     * The microservice (partitioned by key to prevent
     * conflicting with other services).
     */
    const svc = new cote.Responder({
        name: 'Everlife ChatGPT Skill',
        key: msKey,
    })

    /*      outcome/
     * Respond to user messages asking us to code/decode things
     */
    svc.on('msg', (req, cb) => {
        if(req.msg && !req.msg.startsWith('/')) {
            cb(null, true) /* Yes I am handling this message */
            reqChatGPTServer(req.msg.substring(''.length),cgptAnswer=>{
                if(cgptAnswer) sendReply(cgptAnswer,req)
            })
       
        } else {
            cb() /* REMEMBER TO CALL THIS OTHERWISE THE AVATAR WILL WAIT FOR A RESPONSE FOREVER */
        }
    })

    async function reqChatGPTServer(msg,cb) {
        if(!OPENAI_API_KEY) cb("Please add ChatGPT API key on config file.")
        
        const instance = axios.create({
            httpsAgent: new https.Agent({  
              rejectUnauthorized: false
            })
          });
        
        var body = {
            model: sModel,
            prompt: msg,
            max_tokens: iMaxTokens,
            user: sUserId,
            temperature:  dTemperature,
            frequency_penalty: 0.0, //Number between -2.0 and 2.0  Positive value decrease the model's likelihood to repeat the same line verbatim.
            presence_penalty: 0.0,  //Number between -2.0 and 2.0. Positive values increase the model's likelihood to talk about new topics.
            stop: ["#", ";"] //Up to 4 sequences where the API will stop generating further tokens. The returned text will not contain the stop sequence.
        }
        instance.post('https://api.openai.com/v1/completions', body, {
            headers : headers
        })
        .then(function(response){
            if(response) {
                const result = response.data.choices;
                const idToSearchFor = 0;
                const chatGPTAnswer = result.find(
                obj => obj.index === idToSearchFor
                )
                cb(chatGPTAnswer.text.trim())
            }
        })
        .catch(function (error) {
            u.showErr(error)
        })
    }
}

main()