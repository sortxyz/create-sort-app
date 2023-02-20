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
      // console.log(jsonABI);

      /************** Clone boilerplate code to current directory **************/
      shell.exec('git clone https://github.com/sortxyz/create-sort-app-template ' + DIR_NAME);
      console.log("Cloning the boilerplate code");

      /************** create component folder if not exists **************/
      if (!fs.existsSync("./"+DIR_NAME+"/src/components")) {
        fs.mkdirSync("./"+DIR_NAME+"/src/components");
      }

      if (!fs.existsSync("./"+DIR_NAME+"/src/components/contracts")) {
        fs.mkdirSync("./"+DIR_NAME+"/src/components/contracts");
      }

      var contractDataFileContent = `
      //contract constants
      export const CONTRACTADDRESS = "${contractAddress}";
      export const CONTRACTABI = ${JSON.stringify(jsonABI)};
              `;
              fs.writeFileSync("./"+DIR_NAME+"/src/components/contracts/contractData.js", contractDataFileContent);
      
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
          if (element.stateMutability == "view" || element.stateMutability == "pure") {
            // for view or pure methods that return value and will not generate transaction  
            fileData = `//Creating custom component 
import React, { useContext, useEffect, useState } from 'react';
import { CONTRACTADDRESS, CONTRACTABI } from './contracts/contractData';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
              
const ${componentName} = (props) => {
        
  const [${element.name}Value, set${componentName}Value] = useState(null);//component Value
        
  /********** Contract Call with parameter for readable function **********/
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    try {
      let myContract = new props.web3.eth.Contract(CONTRACTABI, CONTRACTADDRESS);
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

            fileData = fileData + eventInputs + `
                  
      let result = await myContract.methods.${element.name}(${functionCallParameter}).call({from: props.walletAddress});
      // console.log("contract call result is "+result);
      set${componentName}Value(result);
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
              
export default ${componentName};`;
readComponentList.push(componentName);
          } else {
            //for payable or non-payable functions with parameter value that generates transaction
            fileData = `//Creating custom component 
import React, { useContext, useEffect, useState } from 'react';
import { CONTRACTADDRESS, CONTRACTABI } from './contracts/contractData';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';   
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';        
            
const ${componentName} = (props) => {
      
  const [${element.name}Value, set${componentName}Value] = useState(null);//component Value
      
  /********** Contract Call with parameter for readable function **********/
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    try {
      let myContract = new props.web3.eth.Contract(CONTRACTABI, CONTRACTADDRESS);
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

            fileData = fileData + eventInputs + `
                
      let transaction = await myContract.methods.${element.name}(${functionCallParameter}).send({from:props.walletAddress});
      // console.log("contract call transaction is "+transaction);
      set${componentName}Value(transaction.transactionHash);
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
            
export default ${componentName};`;
writeComponentList.push(componentName);
          }

          /************** Create each function as react Component file **************/
          fs.writeFileSync("./"+DIR_NAME+"/src/components/" + componentName + ".js", fileData);

          allComponentList.push(componentName);
        }
      })
      console.log("Created all react components for each function call");

      /************** Update app.js file **************/
      var importComponents = "", addComponentsInHTML = "";
      allComponentList.map((ele, ind) => {
        importComponents += `
import ${ele} from './components/${ele}';`;
        addComponentsInHTML += `
      <${ele} web3={walletData.web3} walletAddress={walletData.walletAddress}/>`;
      })

      var addReadComponentsInHTML = "";
      readComponentList.map((ele, ind) => {
        addReadComponentsInHTML += `
      <${ele} web3={walletData.web3} walletAddress={walletData.walletAddress}/>`;
      })

      var addWriteComponentsInHTML = "";
      writeComponentList.map((ele, ind) => {
        addWriteComponentsInHTML += `
      <${ele} web3={walletData.web3} walletAddress={walletData.walletAddress}/>`;
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
        
        fs.writeFileSync("./"+DIR_NAME+"/src/App.js", AppJsFile);
      } catch (err) {
        console.error(err);
      }

      // console.log("App.js file updated with adding all newly created components");
      console.log("Project created sucessfully");

    } else {
      console.log("Error while loading contract abi. Please check contract address.");
    }

  });

}).on("error", (err) => {
  console.log("More Details error: " + err.message);
});