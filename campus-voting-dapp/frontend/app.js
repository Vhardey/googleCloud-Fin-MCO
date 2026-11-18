const contractAddress = "0x471305820158608e91d24FFe4Ea534C469A08a33";
const ABI_FILE = "../docs/abi.json";

let provider;
let signer;
let contract;
let userAccount;
let contractABI;
let isAdmin = false;
let isLoggedIn = false;

const connectButton = document.getElementById("connectButton");
const walletStatus = document.getElementById("walletStatus");
const message = document.getElementById("message");
const electionStatus = document.getElementById("electionStatus");
const totalVotes = document.getElementById("totalVotes");
const candidateList = document.getElementById("candidateList");
const votingCandidateList = document.getElementById("votingCandidateList");
const resultsList = document.getElementById("resultsList");

connectButton.addEventListener("click", connectWallet);
document.getElementById("registrationForm").addEventListener("submit", registerVoter);
document.getElementById("loginButton").addEventListener("click", checkLogin);
document.getElementById("candidateForm").addEventListener("submit", addCandidate);
document.getElementById("authorizeForm").addEventListener("submit", authorizeVoter);
document.getElementById("startElectionButton").addEventListener("click", startElection);
document.getElementById("endElectionButton").addEventListener("click", endElection);

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});

function showMessage(text) {
  message.textContent = text;
}

function showPage(pageId) {
  document.querySelectorAll("main section").forEach((section) => {
    section.hidden = section.id !== pageId;
  });
}

async function loadContractFiles() {
  const abiResponse = await fetch(ABI_FILE);

  if (!abiResponse.ok) {
    throw new Error("Could not load docs/abi.json. Check that the file exists.");
  }

  contractABI = await abiResponse.json();

  if (!ethers.utils.isAddress(contractAddress)) {
    throw new Error("Invalid deployed contract address.");
  }
}

async function connectWallet() {
  try {
    if (!window.ethereum) {
      walletStatus.textContent = "Please install MetaMask.";
      return;
    }

    await loadContractFiles();

    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);

    signer = provider.getSigner();
    userAccount = await signer.getAddress();
    contract = new ethers.Contract(contractAddress, contractABI, signer);

    const network = await provider.getNetwork();
    const shortAddress = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;
    walletStatus.textContent = `Connected: ${shortAddress}`;

    if (network.chainId !== 11155111) {
      showMessage("Switch MetaMask to the Sepolia test network before using the voting app.");
      return;
    }

    showMessage("Wallet connected to Sepolia.");

    await checkAdmin();
    await checkLoginStatus();
    await loadElectionData();
  } catch (error) {
    showMessage(getErrorMessage(error, "Could not connect wallet."));
    console.error("Wallet connection error:", error);
  }
}

async function checkAdmin() {
  if (!contract || !userAccount) return;

  try {
    const ownerAddress = await contract.owner();
    isAdmin = ownerAddress.toLowerCase() === userAccount.toLowerCase();

    document.getElementById("adminStatus").textContent = isAdmin
      ? "Admin wallet connected. You can manage the election."
      : "This wallet is not the election admin.";
  } catch (error) {
    isAdmin = false;
    document.getElementById("adminStatus").textContent = "Could not verify admin access.";
    console.error("Admin verification error:", error);
  }
}

function getRegisteredVoters() {
  try {
    return JSON.parse(localStorage.getItem("campusVotingVoters") || "{}");
  } catch (error) {
    return {};
  }
}

function registerVoter(event) {
  event.preventDefault();

  if (!userAccount) {
    showMessage("Connect your MetaMask wallet before registering.");
    return;
  }

  const name = document.getElementById("voterName").value.trim();
  const studentId = document.getElementById("studentId").value.trim();

  if (!name || !studentId) {
    showMessage("Enter your name and student ID.");
    return;
  }

  const voters = getRegisteredVoters();
  const key = userAccount.toLowerCase();

  voters[key] = { name, studentId };
  localStorage.setItem("campusVotingVoters", JSON.stringify(voters));

  isLoggedIn = true;

  document.getElementById("loginStatus").textContent =
    `Registered and logged in as ${name}.`;

  showMessage("Registration saved in this browser. The admin must still authorize your wallet on the blockchain.");

  loadElectionData();
}

async function checkLoginStatus() {
  if (!userAccount) return;

  const voter = getRegisteredVoters()[userAccount.toLowerCase()];
  isLoggedIn = Boolean(voter);

  document.getElementById("loginStatus").textContent = voter
    ? `Logged in as ${voter.name}.`
    : "This wallet is not registered in this browser.";
}

async function checkLogin() {
  if (!userAccount) {
    showMessage("Connect your MetaMask wallet first.");
    return;
  }

  await checkLoginStatus();
  await loadElectionData();

  showMessage(isLoggedIn ? "Login successful." : "Register this wallet first.");
}

async function requireAdmin() {
  if (!contract || !userAccount) {
    showMessage("Connect the admin wallet first.");
    return false;
  }

  await checkAdmin();

  if (!isAdmin) {
    showMessage("Only the admin wallet that deployed the contract can do this.");
  }

  return isAdmin;
}

async function addCandidate(event) {
  event.preventDefault();

  if (!(await requireAdmin())) return;

  const name = document.getElementById("candidateName").value.trim();
  const position = document.getElementById("candidatePosition").value.trim();

  if (!name || !position) {
    showMessage("Enter the candidate name and position.");
    return;
  }

  try {
    const tx = await contract.addCandidate(name, position);
    showMessage("Candidate transaction submitted. Waiting for confirmation...");
    await tx.wait();

    document.getElementById("candidateForm").reset();
    showMessage("Candidate added.");

    await loadElectionData();
  } catch (error) {
    showMessage(getErrorMessage(error, "Could not add candidate. Check that voting is closed and this is the admin wallet."));
  }
}

async function authorizeVoter(event) {
  event.preventDefault();

  if (!(await requireAdmin())) return;

  const voterAddress = document.getElementById("voterAddress").value.trim();

  if (!ethers.utils.isAddress(voterAddress)) {
    showMessage("Enter a valid wallet address.");
    return;
  }

  try {
    const tx = await contract.authorizeVoter(voterAddress);
    showMessage("Authorization transaction submitted. Waiting for confirmation...");
    await tx.wait();

    document.getElementById("authorizeForm").reset();
    showMessage("Voter wallet authorized.");
  } catch (error) {
    showMessage(getErrorMessage(error, "Could not authorize voter. Check that voting is closed and this is the admin wallet."));
  }
}

async function startElection() {
  if (!(await requireAdmin())) return;

  try {
    const tx = await contract.startElection();
    showMessage("Start-voting transaction submitted...");
    await tx.wait();

    showMessage("Voting is now open.");
    await loadElectionData();
  } catch (error) {
    showMessage(getErrorMessage(error, "Could not start voting. Add at least two candidates and make sure the election is closed."));
  }
}

async function endElection() {
  if (!(await requireAdmin())) return;

  try {
    const tx = await contract.endElection();
    showMessage("Close-voting transaction submitted...");
    await tx.wait();

    showMessage("Voting is now closed. Final results are available.");
    await loadElectionData();
  } catch (error) {
    showMessage(getErrorMessage(error, "Could not close voting. Check that the election is open and this is the admin wallet."));
  }
}

async function vote(candidateId) {
  if (!contract || !userAccount) {
    showMessage("Connect your wallet first.");
    return;
  }

  if (!isLoggedIn) {
    showMessage("Register and log in with this wallet before voting.");
    showPage("registerPage");
    return;
  }

  try {
    const authorized = await contract.authorizedVoters(userAccount);
    const alreadyVoted = await contract.hasVoted(userAccount);
    const isOpen = await contract.getElectionStatus();

    if (!isOpen) {
      showMessage("Voting is closed.");
      return;
    }

    if (!authorized) {
      showMessage("Your wallet has not been authorized by the admin.");
      return;
    }

    if (alreadyVoted) {
      showMessage("This wallet has already voted.");
      return;
    }

    const tx = await contract.vote(candidateId);
    showMessage("Vote submitted. Waiting for blockchain confirmation...");
    await tx.wait();

    showMessage("Your vote has been recorded.");
    await loadElectionData();
  } catch (error) {
    showMessage(getErrorMessage(error, "Voting failed. Check authorization, election status, and whether this wallet has already voted."));
  }
}

async function readCandidates(count) {
  const candidates = [];

  for (let id = 1; id <= count; id++) {
    const result = await contract.getCandidate(id);

    const candidate = result.name !== undefined
      ? result
      : result[0];

    candidates.push({
      id: candidate.id.toString(),
      name: candidate.name,
      position: candidate.position,
      voteCount: candidate.voteCount.toString()
    });
  }

  return candidates;
}

function makeCandidateText(candidate, includeVotes) {
  const item = document.createElement("div");
  const name = document.createElement("strong");
  const position = document.createElement("p");

  name.textContent = candidate.name;
  position.textContent = `Position: ${candidate.position}`;

  item.appendChild(name);
  item.appendChild(position);

  if (includeVotes) {
    const votes = document.createElement("p");
    votes.textContent = `Votes: ${candidate.voteCount}`;
    item.appendChild(votes);
  }

  return item;
}

async function loadElectionData() {
  if (!contract) return;

  try {
    const isOpen = await contract.getElectionStatus();
    const count = (await contract.getCandidateCount()).toNumber();
    const votes = await contract.getTotalVotes();
    const candidates = await readCandidates(count);

    electionStatus.textContent = isOpen
      ? "Election is OPEN"
      : "Election is CLOSED";

    totalVotes.textContent = `Total votes: ${votes.toString()}`;

    candidateList.replaceChildren();
    votingCandidateList.replaceChildren();
    resultsList.replaceChildren();

    candidates.forEach((candidate) => {
      candidateList.appendChild(makeCandidateText(candidate, false));

      const voteItem = makeCandidateText(candidate, false);
      const voteButton = document.createElement("button");

      voteButton.type = "button";
      voteButton.textContent = `Vote for ${candidate.name}`;
      voteButton.disabled = !isOpen || !userAccount || !isLoggedIn;
      voteButton.addEventListener("click", () => vote(candidate.id));

      voteItem.appendChild(voteButton);
      votingCandidateList.appendChild(voteItem);

      if (!isOpen) {
        resultsList.appendChild(makeCandidateText(candidate, true));
      }
    });

    document.getElementById("resultsNotice").textContent = isOpen
      ? "Results are hidden until the admin closes voting."
      : "Voting is closed. These are the final tabulation results.";

    if (isOpen) {
      resultsList.textContent = "Final results will appear after voting closes.";
    }
  } catch (error) {
    console.error("Could not load election data:", error);
    showMessage(getErrorMessage(error, "Could not load election data. Check the contract address, ABI, and selected network."));
  }
}

function getErrorMessage(error, fallback) {
  if (error && error.reason) return error.reason;
  if (error && error.data && error.data.message) return error.data.message;
  if (error && error.error && error.error.message) return error.error.message;
  return fallback;
}

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
