// --- 1. CONFIGURATION ---
// This points to your Python FastAPI server running locally
const API_BASE_URL = "http://127.0.0.1:8000/api";

// State variables
let masterPool = [];
let activePlayers = [];
let currentStep = 1;

// DOM Elements
const checklistContainer = document.getElementById("checklistContainer");
const bulkSquadForm = document.getElementById("bulkSquadForm");
const totalPlayers = document.getElementById("totalPlayers");
const teamA = document.getElementById("teamA");
const teamB = document.getElementById("teamB");
const generateBtn = document.getElementById("generateBtn");
const bottomReshuffleBtn = document.getElementById("bottomReshuffleBtn");

// Form Elements
const addNewPlayerBtn = document.getElementById("addNewPlayerBtn");
const newPlayerName = document.getElementById("newPlayerName");
const newSeparation = document.getElementById("newSeparation");
const newRole = document.getElementById("newRole");
const newGender = document.getElementById("newGender");

// --- 2. API NETWORK CALLS ---

// Fetch the master roster from the SQLite database
async function loadMasterPoolFromAPI() {
  try {
    const response = await fetch(`${API_BASE_URL}/players`);
    if (!response.ok) throw new Error("Network error loading players");
    
    masterPool = await response.json();
    
    // Auto-select everyone by default on first load
    activePlayers = [...masterPool]; 
    renderChecklistPool();
    renderProfilesDirectory();
  } catch (error) {
    console.error("Failed to fetch players:", error);
    alert("Could not connect to the backend server. Is Python running?");
  }
}

// Send a new player to the database
async function addPlayerToAPI(playerData) {
  try {
    const response = await fetch(`${API_BASE_URL}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(playerData)
    });
    
    if (!response.ok) throw new Error("Failed to save player");
    const newPlayer = await response.json();
    
    // Add to local state and re-render
    masterPool.push(newPlayer);
    activePlayers.push(newPlayer);
    renderChecklistPool();
    renderProfilesDirectory();
  } catch (error) {
    console.error("Error saving player:", error);
    alert("Failed to save player to the database.");
  }
}

// Ask the server to run the balancing algorithm
async function splitTeamsViaAPI() {
  if (activePlayers.length < 2) { 
    alert("Please pick at least 2 players!"); 
    return; 
  }

  // Extract just the IDs of the checked players
  const playerIds = activePlayers.map(p => p.id);

  // Update UI to show loading state
  const originalText = generateBtn.textContent;
  generateBtn.textContent = "Splitting... ⏳";
  generateBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/teams/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_ids: playerIds })
    });
    
    if (!response.ok) throw new Error("Failed to split teams");
    const result = await response.json();

    // Render the balanced teams returned by Python
    renderTeam(teamA, result.team_A, result.captain_A);
    renderTeam(teamB, result.team_B, result.captain_B);
    
    goToStep(3);
  } catch (error) {
    console.error("Error splitting teams:", error);
    alert("Algorithm failed on the server.");
  } finally {
    // Restore button state
    generateBtn.textContent = originalText;
    generateBtn.disabled = false;
  }
}

// --- 3. EVENT LISTENERS ---

// Add New Player Button
addNewPlayerBtn.addEventListener("click", () => {
  const name = newPlayerName.value.trim().toUpperCase(); 
  if (!name) return;
  
  const freshPlayer = { 
    name: name, 
    separation: newSeparation.value,
    role: newRole.value,
    gender: newGender.value
  };
  
  // Call the API function
  addPlayerToAPI(freshPlayer);
  
  // Reset form
  newPlayerName.value = ""; 
  newSeparation.value = "None"; 
  newRole.value = "Batsman"; 
  newGender.value = "M";
  document.getElementById("accordionToggle").classList.remove("active"); 
  document.getElementById("accordionContent").classList.remove("open");
});

// Update active players when form is submitted (Next Step)
bulkSquadForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const newActiveList = [];
  checklistContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    if (cb.checked) { 
      const p = masterPool.find(x => x.id === cb.value); 
      if (p) newActiveList.push(p); 
    }
  });
  activePlayers = newActiveList; 
  totalPlayers.textContent = activePlayers.length;
  goToStep(2);
});

// Trigger Server-Side Splitting
generateBtn.addEventListener("click", splitTeamsViaAPI);
bottomReshuffleBtn.addEventListener("click", splitTeamsViaAPI);

// --- 4. INITIALIZATION ---
// Fire up the network request when the page loads
window.addEventListener("DOMContentLoaded", loadMasterPoolFromAPI);

/* Note: Keep your existing UI functions below this 
   (goToStep, escapeHtml, renderChecklistPool, renderTeam, openSingleProfile, 
   renderProfilesDirectory, and the coin toss logic) 
   as they handle the visual rendering perfectly! */