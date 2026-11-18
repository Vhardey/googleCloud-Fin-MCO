# Campus Voting System dApp

## Description
A decentralized voting application (dApp) that uses blockchain technology to manage campus elections. It allows the admin to manage candidates and authorize voters, while voters can cast their votes securely through their connected wallets.

## Features
- Voter registration and login
- Electoral admin login
- Add candidates and their positions
- Authorize voters
- Start and end the election
- One vote per authorized wallet
- View candidates and election results

## Technologies Used
- HTML
- CSS
- JavaScript
- Solidity
- Ethers.js
- OpenZeppelin
- MetaMask
- Blockchain

## How to Run
1. Open the project folder in Visual Studio Code.
2. Install the required Solidity dependencies, including OpenZeppelin, if they are not already installed.
3. Compile and deploy `CampusVoting.sol` using your chosen development environment.
4. Update the contract address in `app.js` with the deployed contract address.
5. Update `docs/abi.json` with the ABI of the deployed contract.
6. Run `index.html` using Live Server.
7. Connect MetaMask to the same blockchain network where the contract was deployed.

## How It Works
The admin adds candidates and authorizes voter wallet addresses before starting the election. Authorized voters can then cast one vote each. When the admin ends the election, voters can view the final results.

## Notes
- The admin must use the wallet that owns the deployed smart contract.
- Voter registration details are stored in the browser's local storage.
- Candidate records and vote counts are stored on the blockchain.
- Each wallet address can vote only once per contract deployment.