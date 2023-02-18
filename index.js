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
      // console.log(jsonABI);

      /************** Clone boilerplate code to current directory **************/
      shell.exec('git clone https://github.com/KhemnarMayuresh/initial-code-for-npm-package')
      console.log("Cloning the boilerplate code");

      /************** create component folder if not exists **************/
      if (!fs.existsSync("./initial-code-for-npm-package/src/components")) {
        fs.mkdirSync("./initial-code-for-npm-package/src/components");
      }

      if (!fs.existsSync("./initial-code-for-npm-package/src/components/contracts")) {
        fs.mkdirSync("./initial-code-for-npm-package/src/components/contracts");
      }

      var contractDataFileContent = `
      //contract constants
      export const CONTRACTADDRESS = "${contractAddress}";
      export const CONTRACTABI = ${JSON.stringify(jsonABI)};
              `;
              fs.writeFileSync("./initial-code-for-npm-package/src/components/contracts/contractData.js", contractDataFileContent);
      
      var allComponentList = [];
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
    <>
      <h4>${element.name}</h4>  
      <form onSubmit={handleFormSubmit}>`;
            let formInputs = "";
            element.inputs.map((ele, ind) => {
              // console.log(ele);
              let id = ele.name ? ele.name : "customInput" + ind;
              if (
                (ele.type.startsWith("uint") || ele.type.startsWith("int")
                ) && !(ele.type.endsWith("[]"))) {
                formInputs += `
        <label for="${id}">${id}: ${ele.type}</label><br/>
        <input type="number" id="${id}" name="${id}" min="0" required/><br/>
                        `;
              } else { // string, addreess, tuple, tuple[]
                formInputs += `
        <label for="${id}">${id}: ${ele.type}</label><br/>
        <input type="text" id="${id}" name="${id}" required/><br/>
                        `;
              } 
            })

            fileData = fileData + formInputs + `
        <input type="submit" value="Submit"/>
      </form>
      <span>{${element.name}Value?.toLocaleString()}</span>
    </>
  );
}
              
export default ${componentName};`;
          } else {
            //for payable or non-payable functions with parameter value that generates transaction
            fileData = `//Creating custom component 
import React, { useContext, useEffect, useState } from 'react';
import { CONTRACTADDRESS, CONTRACTABI } from './contracts/contractData';
            
            
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
    <>
      <h4>${element.name}</h4>  
      <form onSubmit={handleFormSubmit}>`;
            let formInputs = "";
            element.inputs.map((ele, ind) => {
              // console.log(ele);
              let id = ele.name ? ele.name : "customInput" + ind;
              if (
                (ele.type.startsWith("uint") || ele.type.startsWith("int")
                ) && !(ele.type.endsWith("[]"))) {
                formInputs += `
        <label for="${id}">${id}: ${ele.type}</label><br/>
        <input type="number" id="${id}" name="${id}" min="0" required/><br/>
                      `;
              } else {
                formInputs += `
        <label for="${id}">${id}: ${ele.type}</label><br/>
        <input type="text" id="${id}" name="${id}" required/><br/>
                      `;
              } 
            })

            fileData = fileData + formInputs + `
        <input type="submit" value="Submit"/>
      </form>
      <span style={{wordWrap:"break-word"}}>Transaction Details : {${element.name}Value?JSON.stringify(${element.name}Value):""}</span>
  </>
  );
}
            
export default ${componentName};`;
          }

          /************** Create each function as react Component file **************/
          fs.writeFileSync("./initial-code-for-npm-package/src/components/" + componentName + ".js", fileData);

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

      var AppJSFileContent = `
import React, { useContext, useEffect, useState } from 'react';
import './App.css';
import Web3 from 'web3';
`+ importComponents + `

function App() {

  const [walletData, setWalletData] = useState({
    walletAddress: "",
    isConnected: false,
    web3: null
  });

  async function connect() {
    let web3;
    //connect to web3
    if (typeof window !== 'undefined' && typeof window.web3 !== 'undefined') {
      //we are in the browser and metamask is running
      //ETH mainnet 1
      web3 = new Web3(window.web3.currentProvider);
      let netId = parseInt(window.ethereum.chainId);
      // console.log(netId);
      // if (netId !== 1) {
      //   alert('Please select ethereum mainnet network');
      //   console.error('Please select ethereum mainnet network');
      //   return;
      // }

      //set details
      let accounts;
      try {
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        if (error.code === 4001) {
          console.error("Please allow metamask to connect");
        }
        return;
        // console.log(error)
      }
      // console.log(accounts)
      if (accounts.length < 1) {
        console.error('Please unlock metamask wallet first!');
        return;
      }
      // console.log(accounts[0]);
      setWalletData({
        walletAddress: accounts[0],
        isConnected: true,
        web3: web3
      });
    } else {
      //on the browser or user is not running metamask
      console.error("Metamask wallet not found! Please make sure wallet is installed and running!");
    }
  }

  return (
    <div className='App'>
      <button variant="success" size="lg" className="connectWallet green-btn" onClick={connect}>
        {walletData.isConnected ?
          walletData.walletAddress.substr(0, 4) + "..." + walletData.walletAddress.substr(-4)
          : "Connect Wallet"}
      </button><br/>
      `+ addComponentsInHTML + `
    </div>
  );
}

export default App;`;

      /************** Update App.js file **************/
      fs.writeFileSync("./initial-code-for-npm-package/src/App.js", AppJSFileContent);
      // console.log("App.js file updated with adding all newly created components");
      console.log("Project created sucessfully");

    } else {
      console.log("Error while loading contract abi. Please check contract address.");
    }

  });

}).on("error", (err) => {
  console.log("More Details error: " + err.message);
});