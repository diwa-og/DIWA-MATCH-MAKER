// --- 1. CONFIGURATION ---
const API_BASE_URL = "http://127.0.0.1:8000/api";

let masterPool = [];
let activePlayers = [];
let currentStep = 1;

const checklistContainer = document.getElementById("checklistContainer");
const bulkSquadForm = document.getElementById("bulkSquadForm");
const totalPlayers = document.getElementById("totalPlayers");
const teamA = document.getElementById("teamA");
const teamB = document.getElementById("teamB");
const generateBtn = document.getElementById("generateBtn");
const bottomReshuffleBtn = document.getElementById("bottomReshuffleBtn");

const addNewPlayerBtn = document.getElementById("addNewPlayerBtn");
const newPlayerName = document.getElementById("newPlayerName");
const newSeparation = document.getElementById("newSeparation");
const newRole = document.getElementById("newRole");
const newGender = document.getElementById("newGender");

// --- 2. API NETWORK CALLS ---
async function loadMasterPoolFromAPI() {
  try {
    const response = await fetch(`${API_BASE_URL}/players`);
    if (!response.ok) throw new Error("Network error loading players");
    
    masterPool = await response.json();
    activePlayers = [...masterPool]; 
    renderChecklistPool();
    renderProfilesDirectory();
  } catch (error) {
    console.error("Failed to fetch players:", error);
    alert("Could not connect to the backend server. Is Python running?");
  }
}

async function addPlayerToAPI(playerData) {
  try {
    const response = await fetch(`${API_BASE_URL}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(playerData)
    });
    
    if (!response.ok) throw new Error("Failed to save player");
    const newPlayer = await response.json();
    
    masterPool.push(newPlayer);
    activePlayers.push(newPlayer);
    renderChecklistPool();
    renderProfilesDirectory();
  } catch (error) {
    console.error("Error saving player:", error);
    alert("Failed to save player to the database.");
  }
}

async function splitTeamsViaAPI() {
  if (activePlayers.length < 2) { 
    customAlert("Warning", "Please pick at least 2 players!"); 
    return; 
  }

  // Show the Spinning Coin Loader Animation (Smooth CSS Transition)
  const loader = document.getElementById('coinLoaderModal');
  if (loader) {
    loader.classList.add('active');
    loader.querySelector('.coin').style.animation = "spin-coin-fast 0.6s linear infinite";
  }

  const playerIds = activePlayers.map(p => p.id);

  const originalText = generateBtn.textContent;
  generateBtn.textContent = "Splitting...";
  generateBtn.disabled = true;

  try {
    const [response] = await Promise.all([
      fetch(`${API_BASE_URL}/teams/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_ids: playerIds })
      }),
      new Promise(resolve => setTimeout(resolve, 1500)) // Force minimum 1.5s loader screen
    ]);
    
    if (!response.ok) throw new Error("Failed to split teams");
    const result = await response.json();

    renderTeam(teamA, result.team_A, result.captain_A);
    renderTeam(teamB, result.team_B, result.captain_B);
    
    if (loader) {
      loader.classList.remove('active');
      loader.querySelector('.coin').style.animation = "none";
    }
    goToStep(3);
  } catch (error) {
    if (loader) {
      loader.classList.remove('active');
      loader.querySelector('.coin').style.animation = "none";
    }
    console.error("Error splitting teams:", error);
    alert("Algorithm failed on the server.");
  } finally {
    generateBtn.textContent = originalText;
    generateBtn.disabled = false;
  }
}

// Add New Player Button
addNewPlayerBtn.addEventListener("click", () => {
  const name = newPlayerName.value.trim().toUpperCase(); 
  if (!name) return;
  
  const freshPlayer = { name: name, separation: newSeparation.value, role: newRole.value, gender: newGender.value };
  addPlayerToAPI(freshPlayer);
  
  newPlayerName.value = ""; newSeparation.value = "None"; newRole.value = "Batsman"; newGender.value = "M";
  document.getElementById("accordionToggle").classList.remove("active"); 
  document.getElementById("accordionContent").classList.remove("open");
});

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

generateBtn.addEventListener("click", splitTeamsViaAPI);
bottomReshuffleBtn.addEventListener("click", splitTeamsViaAPI);

window.addEventListener("DOMContentLoaded", loadMasterPoolFromAPI);


// --- 5. RENDER OVERLAP & RENAME LOGIC UPDATES ---
// Ensure this specific updated block is included in your file. 

// The renderTeam string prevents overlapping by using flexbox strict rules (min-width: 0 and text-overflow: ellipsis)
function renderTeam(container, teamPlayers, captainId) {
  container.innerHTML = "";
  teamPlayers.forEach((player, index) => {
    const isCaptain = player.id === captainId; 
    const isCreator = player.name === "DIWA OG";
    const initial = player.name ? player.name.charAt(0) : "?"; 
    const imgName = "photos/" + escapeHtml(player.name.toLowerCase().trim()) + ".jpg";
    
    const roleStr = player.role || "Batsman";
    const roleClass = getRoleClass(roleStr);
    
    const row = document.createElement("div");
    row.className = `team-player ${isCreator ? 'creator-glow-row' : ''} ${isCaptain ? 'captain-row' : ''}`;
    const captainLabel = isCaptain ? `<div class="captain-badge">👑 Captain</div>` : '';
    
    row.innerHTML = `
      <div class="team-player-left" style="flex: 1; min-width: 0;">
        <div class="player-order-number">${index + 1}</div>
        <div class="player-avatar" style="width:56px; height:56px; font-size:20px; margin:0; flex-shrink:0;">
          <span class="avatar-initial">${initial}</span>
          <img src="${imgName}" onerror="this.style.display='none'" class="avatar-image" alt="${initial}">
        </div>
        <div style="display:flex; flex-direction:column; justify-content:center; min-width: 0;">
          <span class="${isCreator ? 'creator-text-gradient' : ''}" style="font-weight:600; font-size:15px; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${escapeHtml(player.name)}</span>
          ${captainLabel}
        </div>
      </div>
      <div class="team-player-right" style="flex-shrink: 0; margin-left: 10px;">
        <span class="badge ${roleClass}">${roleStr}</span>
      </div>
    `;
    container.appendChild(row);
  });
}

// Replaced tricky long-press actions with smooth action buttons containing "Rename"
function renderSavedMatches() {
  const savedList = JSON.parse(localStorage.getItem(storageKeySavedMatchesList) || "[]");
  const savedMatchesList = document.getElementById("savedMatchesList");
  const savedMatchesModal = document.getElementById("savedMatchesModal");
  savedMatchesList.innerHTML = "";
  
  savedList.forEach((savedItem) => {
    const dateStr = new Date(savedItem.id).toLocaleString();
    const modeText = savedItem.data.mode === 'singles' ? "Singles" : "Teams";
    
    const card = document.createElement("div"); 
    card.className = "saved-match-item";
    
    // Explicit Load, Rename, and Delete Buttons inserted natively into the card
    card.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <div class="saved-match-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(savedItem.title)}</div>
        <div class="saved-match-meta"><span>${dateStr}</span><span class="match-type-badge">${modeText}</span></div>
      </div>
      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button class="btn-load-match" style="flex: 2; padding: 10px; font-size: 13px; border-radius: 8px; background: var(--grad-primary); color: white; border: none; font-weight: bold;">Load</button>
        <button class="btn-rename-match" style="flex: 1; padding: 10px; font-size: 13px; border-radius: 8px; background: #F1F5F9; color: #1E293B; border: none; font-weight: bold;">Rename</button>
        <button class="btn-delete-match" style="flex: 1; padding: 10px; font-size: 13px; border-radius: 8px; background: #FEF2F2; color: #DC2626; border: none; font-weight: bold;">Delete</button>
      </div>
    `;
    
    const loadBtn = card.querySelector('.btn-load-match');
    const renameBtn = card.querySelector('.btn-rename-match');
    const deleteBtn = card.querySelector('.btn-delete-match');

    loadBtn.addEventListener('click', () => {
      savedMatchesModal.classList.remove("active");
      const match = savedItem.data; 
      currentGeneratedMatch = match; 
      appMatchMode = match.mode || 'teams';
      setupStep3View(appMatchMode); 
      renderTeam(teamA, match.teamA, match.capA);
      if (appMatchMode === 'teams') renderTeam(teamB, match.teamB, match.capB);
      goToStep(3);
    });

    renameBtn.addEventListener('click', () => {
      customPrompt("Rename Match", savedItem.title, (newName) => {
        if (newName && newName.trim() !== "") {
          const updatedList = savedList.map(item => item.id === savedItem.id ? { ...item, title: newName.trim() } : item);
          localStorage.setItem(storageKeySavedMatchesList, JSON.stringify(updatedList));
          renderSavedMatches();
        }
      });
    });

    deleteBtn.addEventListener('click', () => {
      customConfirm("Delete Match?", `Are you sure you want to permanently delete "${savedItem.title}"?`, (confirmed) => {
        if (confirmed) {
          const updatedList = savedList.filter(item => item.id !== savedItem.id);
          localStorage.setItem(storageKeySavedMatchesList, JSON.stringify(updatedList));
          checkSavedMatches(); 
          renderSavedMatches(); 
          if (updatedList.length === 0) savedMatchesModal.classList.remove("active");
        }
      });
    });
    
    savedMatchesList.appendChild(card);
  });
}