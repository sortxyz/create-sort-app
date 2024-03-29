#! /usr/bin/env node
var fs = require('fs');
const http = require('http');
const https = require('https');

/************** shell to execute git clone command **************/
const shell = require('shelljs');

/************** arguments provided **************/
const contractAddress = process.argv.slice(2, 3);
const etherscanAPIKey = process.argv.slice(3, 4);
const _network = process.argv.slice(4);
const network = _network.length>0?_network[0]:"";
// console.log(network);

/************** api to get contract abi data **************/
let api = '';
switch (network) {
  case 'goerli': api = "https://api-goerli.etherscan.io/api?module=contract&action=getabi&address=" + contractAddress + "&apikey=" + etherscanAPIKey;
    break;
  case 'kovan': api = "https://api-kovan.etherscan.io/api?module=contract&action=getabi&address=" + contractAddress + "&apikey=" + etherscanAPIKey;
    break;
  case 'rinkeby': api = "https://api-rinkeby.etherscan.io/api?module=contract&action=getabi&address=" + contractAddress + "&apikey=" + etherscanAPIKey;
    break;
  case 'ropsten': api = "https://api-ropsten.etherscan.io/api?module=contract&action=getabi&address=" + contractAddress + "&apikey=" + etherscanAPIKey;
    break;
  case 'sepolia': api = "https://api-sepolia.etherscan.io/api?module=contract&action=getabi&address=" + contractAddress + "&apikey=" + etherscanAPIKey;
    break;
  default: api = 'https://api.sort.xyz/v0/info/' + contractAddress + '/abi';
    break;
}

/************** fetch contract abi data **************/
https.get(api, function (response) {
  let data = '';

  /************** A chunk of data has been received **************/
  response.on('data', (chunk) => {
    data += chunk;
  });

  /************** The whole response has been received. Print out the result **************/
  response.on('end', () => {
    // console.log(data);
    var jsonData = JSON.parse(data);
    var jsonABI = '';
    if (['goerli', 'kovan', 'rinkeby', 'ropsten', 'sepolia'].includes(network)) {
      if (jsonData.status == "1")
        jsonABI = JSON.parse(jsonData.result);
      else {
        jsonABI = null;
      }
    } else {
      var jsonABI = jsonData.abi;
    }

    if (jsonABI) {
      const DIR_NAME = 'sort-app';
      console.log("\n");

      /************** Clone boilerplate code to current directory **************/
      shell.exec('git clone https://github.com/sortxyz/create-sort-app-template ' + DIR_NAME);
      console.log("\n\x1b[32m✓\x1b[0m Cloning boilerplate project from Github");

      /************** create component folder if not exists **************/
      if (!fs.existsSync("./"+DIR_NAME+"/src/components/Contract/WriteFunctions")) {
        fs.mkdirSync("./"+DIR_NAME+"/src/components/Contract/WriteFunctions");
      }

      if (!fs.existsSync("./"+DIR_NAME+"/src/components/Contract/ReadFunctions")) {
        fs.mkdirSync("./"+DIR_NAME+"/src/components/Contract/ReadFunctions");
      }

      var contractDataFileContent = `
      //contract constants
      export const CONTRACTADDRESS = "${contractAddress}";
      export const CONTRACTABI = ${JSON.stringify(jsonABI)};
              `;
              fs.writeFileSync("./"+DIR_NAME+"/src/components/Contract/Constants.js", contractDataFileContent);
      
      var allComponentList = [];
      var readComponentList = [];
      var writeComponentList = [];
      // console.log("Started creating react components for each function call");

      jsonABI.map((element, index) => {
        // console.log(element);
        if (element.type == "function") {

          /************** Set React component name properly **************/
          let text = element.name;
          let letter = text.charAt(0);
          if (letter == "_") {
            text = "underscore" + text;
          }
          var componentName = text.charAt(0).toUpperCase() + text.slice(1);
          if (allComponentList.includes(componentName)) {
            componentName += index;
          }

          var fileData = "";
          var storyFileData = "";
          if (element.stateMutability == "view" || element.stateMutability == "pure") {
            // for view or pure methods that return value and will not generate transaction  
            fileData = `//Creating custom component 
import React, { useContext, useEffect, useState } from 'react';
import { CONTRACTADDRESS, CONTRACTABI } from '../Constants';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import { readContract } from '@wagmi/core';
        
export default function ${componentName}({}) {

        
  const [${element.name}Value, set${componentName}Value] = useState(null);//component Value
        
  /********** Contract Call with parameter for readable function **********/
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    try {
      `;
            let eventInputs = "";
            let functionCallParameter = "";
            element.inputs.map((ele, ind) => {
              let id = ele.name ? ele.name : "customInput" + ind;
              if(ele.type.startsWith("tuple") || ele.type.endsWith("[]")){
                eventInputs += `
      var ${id} = JSON.parse(event.target.${id}.value);
                              `;          
              } else{
                eventInputs += `
      var ${id} = event.target.${id}.value;
                              `;          
              }
              functionCallParameter += `${id}`;
              if (ind < element.inputs.length - 1) {
                functionCallParameter += ",";
              }
            })

            if (functionCallParameter === "" ) functionCallParameter = "[]";

            fileData = fileData + eventInputs + `
                  
      const data = await readContract({
        address: CONTRACTADDRESS,
        abi: CONTRACTABI,
        functionName: '${element.name}',
        args: ${functionCallParameter}
      })
      set${componentName}Value(data);
    } catch (e) {
      alert(e);
      console.log(e);
    }
  }
      
  return (
    <Card style={{marginBottom: "20px"}} variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          ${element.name}
        </Typography>
        <form onSubmit={handleFormSubmit}>`;
              let formInputs = "";
              element.inputs.map((ele, ind) => {
                // console.log(ele);
                let id = ele.name ? ele.name : "customInput" + ind;
                if (
                  (ele.type.startsWith("uint") || ele.type.startsWith("int")
                  ) && !(ele.type.endsWith("[]"))) {
                  formInputs += `
          <label for="${id}">${id} (${ele.type})</label><br/>

          <TextField
            type="number" id="${id}" name="${id}" min="0" required
            fullWidth
            filled
            style={{margin: "12px 0px", color: "#FFF"}}
            color="secondary"
            hiddenLabel
          />
                          `;
                } else { // string, addreess, tuple, tuple[]
                  formInputs += `
          <label for="${id}">${id} (${ele.type})</label><br/>

          <TextField
            type="text" id="${id}" name="${id}" min="0" required
            fullWidth
            filled
            style={{margin: "12px 0px", color: "#FFF"}}
            color="secondary"
            hiddenLabel
          />
                          `;
                } 
              })

              fileData = fileData + formInputs + `
          <Button variant="outlined" onClick={handleFormSubmit}>Submit</Button>
        </form>

        {${element.name}Value && 
          <TextField
            disabled
            value={${element.name}Value?.toLocaleString()}
            fullWidth
            filled
            style={{marginTop: "12px", color: "#FFF"}}
            color="secondary"
            hiddenLabel
          />}

      </CardContent>
    </Card>
  );
}
`;

storyFileData = `
import React from 'react';
import ${componentName} from './${componentName}';

export default {
  component: ${componentName},
  title: "Read Functions/${componentName}"
};

const Template = args => <${componentName} {...args} />;

export const Default = Template.bind({});
Default.args = {};
`;


/************** Create each function as react Component file **************/
fs.writeFileSync("./"+DIR_NAME+"/src/components/Contract/ReadFunctions/" + componentName + ".js", fileData);
fs.writeFileSync("./"+DIR_NAME+"/src/components/Contract/ReadFunctions/" + componentName + ".stories.js", storyFileData);

readComponentList.push(componentName);
          } else {
            //for payable or non-payable functions with parameter value that generates transaction
            fileData = `//Creating custom component 
import React, { useContext, useEffect, useState } from 'react';
import { CONTRACTADDRESS, CONTRACTABI } from '../Constants';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';   
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';        
            
export default function ${componentName}({}) {
      
  const [${element.name}Value, set${componentName}Value] = useState(null);//component Value
      
  /********** Contract Call with parameter for readable function **********/
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    try {
      //let myContract = new props.web3.eth.Contract(CONTRACTABI, CONTRACTADDRESS);
      `;
            let eventInputs = "";
            let functionCallParameter = "";
            element.inputs.map((ele, ind) => {
              let id = ele.name ? ele.name : "customInput" + ind;
              if(ele.type.startsWith("tuple") || ele.type.endsWith("[]")){
                eventInputs += `
      //var ${id} = JSON.parse(event.target.${id}.value);
                              `;          
              } else{
                eventInputs += `
      //var ${id} = event.target.${id}.value;
                              `;          
              }
              functionCallParameter += `${id}`;
              if (ind < element.inputs.length - 1) {
                functionCallParameter += ",";
              }
            })

            fileData = fileData + eventInputs + `
                
      //let transaction = await myContract.methods.${element.name}(${functionCallParameter}).send({from:props.walletAddress});
      // console.log("contract call transaction is "+transaction);
      //set${componentName}Value(transaction.transactionHash);
    } catch (e) {
      alert(e);
      console.log(e);
    }
  }
      
  return (
    <Card style={{marginBottom: "20px"}} variant="outlined">
      <CardContent>
        <Typography variant="h6" gutterBottom>
          ${element.name}
        </Typography>
        <form onSubmit={handleFormSubmit}>`;
              let formInputs = "";
              element.inputs.map((ele, ind) => {
                // console.log(ele);
                let id = ele.name ? ele.name : "customInput" + ind;
                if (
                  (ele.type.startsWith("uint") || ele.type.startsWith("int")
                  ) && !(ele.type.endsWith("[]"))) {
                  formInputs += `
          <label for="${id}">${id} (${ele.type})</label><br/>

          <TextField
            type="number" id="${id}" name="${id}" min="0" required
            fullWidth
            filled
            style={{margin: "12px 0px", color: "#FFF"}}
            color="secondary"
            hiddenLabel
          />`;
                } else {
                  formInputs += `
          <label for="${id}">${id} (${ele.type})</label><br/>

          <TextField
            type="text" id="${id}" name="${id}" min="0" required
            fullWidth
            filled
            style={{margin: "12px 0px", color: "#FFF"}}
            color="secondary"
            hiddenLabel
          />`;
                } 
              })

              fileData = fileData + formInputs + `
          <Button variant="outlined" onClick={handleFormSubmit}>Submit</Button>
        </form>

        {${element.name}Value && 
          <TextField
            disabled
            value={${element.name}Value?.toLocaleString()}
            fullWidth
            filled
            style={{marginTop: "12px", color: "#FFF"}}
            color="secondary"
            hiddenLabel
          />}
      </CardContent>
  </Card>
  );
}
`;

// Create component story
storyFileData = `
import React from 'react';
import ${componentName} from './${componentName}';

export default {
  component: ${componentName},
  title: "Write Functions/${componentName}"
};

const Template = args => <${componentName} {...args} />;

export const Default = Template.bind({});
Default.args = {};
`;

writeComponentList.push(componentName);

/************** Create each function as react Component file **************/
fs.writeFileSync("./"+DIR_NAME+"/src/components/Contract/WriteFunctions/" + componentName + ".js", fileData);
fs.writeFileSync("./"+DIR_NAME+"/src/components/Contract/WriteFunctions/" + componentName + ".stories.js", storyFileData);

          }

          
          allComponentList.push(componentName);
        }
      })
      console.log("\x1b[32m✓\x1b[0m Built project based on contract ABI");

      /************** Update app.js file **************/
      var importComponents = "", addComponentsInHTML = "";

      /*
      allComponentList.map((ele, ind) => {
        importComponents += `
import ${ele} from './components/${ele}';`;
        addComponentsInHTML += `
      <${ele} web3={walletData.web3} walletAddress={walletData.walletAddress}/>`;
      })
      */

      var addReadComponentsInHTML = "";
      readComponentList.map((ele, ind) => {
        addReadComponentsInHTML += `
      <${ele} />`;

        importComponents += `
import ${ele} from './components/Contract/ReadFunctions/${ele}';`;
        addComponentsInHTML += `
      <${ele} />`;
      })

      var addWriteComponentsInHTML = "";
      writeComponentList.map((ele, ind) => {
        addWriteComponentsInHTML += `
      <${ele} />`;

        importComponents += `
import ${ele} from './components/Contract/WriteFunctions/${ele}';`;
        addComponentsInHTML += `
        <${ele} />`;
      })

      /************** Update App.js file **************/
      try {
        let AppJsFile = fs.readFileSync("./"+DIR_NAME+"/src/App.js", 'utf8');
        
        // Add contract components
        AppJsFile = AppJsFile.replace("// CONTRACT IMPORTS", importComponents);
        
        // Add contract components
        //AppJsFile = AppJsFile.replace("CONTRACT_OVERVIEW", addComponentsInHTML);

        // Add contract READ components
        AppJsFile = AppJsFile.replace("CONTRACT_READ_FUNCTIONS", addReadComponentsInHTML);

        // Add contract WRITE components
        AppJsFile = AppJsFile.replace("CONTRACT_WRITE_FUNCTIONS", addWriteComponentsInHTML);

        // Add the contract address (3 times for 3 occurances)
        AppJsFile = AppJsFile.replaceAll("CONTRACT_ADDRESS", contractAddress);
        
        fs.writeFileSync("./"+DIR_NAME+"/src/App.js", AppJsFile);
      } catch (err) {
        console.error(err);
      }

      // console.log("App.js file updated with adding all newly created components");
      
      console.log("\x1b[32m✓\x1b[0m Project created sucessfully!");

      console.log("\n😻 Feedback and issues: https://github.com/sortxyz/create-sort-app");
      console.log("🤖 Docs: https://docs.sort.xyz");

      console.log("\n🚀 To get started:");
      console.log("> cd sort-app");
      console.log("> npm i");
      console.log("> npm start\n");

    } else {
      console.log("Error while loading contract abi. Please check contract address.");
    }

  });

}).on("error", (err) => {
  console.log("More Details error: " + err.message);
});