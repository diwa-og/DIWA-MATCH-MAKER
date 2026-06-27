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

const storageKeyActive = "team-marking-active-bulk-v40"; 
const storageKeyMaster = "team-marking-master-bulk-v40"; 
const storageKeySavedMatchesList = "team-marking-saved-matches-list-v40";

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
    // Silent fallback to local storage
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
  }
}

async function splitTeamsViaAPI() {
  if (activePlayers.length < 2) { 
    customAlert("Warning", "Please pick at least 2 players!"); 
    return; 
  }

  const loader = document.getElementById('coinLoaderModal');
  const coin = loader ? loader.querySelector('.coin') : null;
  
  if (loader) {
    loader.classList.add('active');
    if (coin) {
      coin.style.transition = "transform 1.5s cubic-bezier(0.4, 0, 0.2, 1)";
      coin.style.transform = "rotateY(1080deg)";
    }
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
      new Promise(resolve => setTimeout(resolve, 1500)) 
    ]);
    
    if (!response.ok) throw new Error("Failed to split teams");
    const result = await response.json();

    renderTeam(teamA, result.team_A, result.captain_A);
    renderTeam(teamB, result.team_B, result.captain_B);
    
    if (loader) {
      loader.classList.remove('active');
      if(coin) {
        coin.style.transition = "none";
        coin.style.transform = "rotateY(0deg)";
      }
    }
    goToStep(3);
  } catch (error) {
    if (loader) {
      loader.classList.remove('active');
      if(coin) {
        coin.style.transition = "none";
        coin.style.transform = "rotateY(0deg)";
      }
    }
    console.error("Error splitting teams:", error);
    // Fallback to local splitting if API fails
    splitTeams();
  } finally {
    generateBtn.textContent = originalText;
    generateBtn.disabled = false;
  }
}

// Add New Player Button
addNewPlayerBtn.addEventListener("click", () => {
  const name = newPlayerName.value.trim().toUpperCase(); 
  if (!name) return;
  
  const freshPlayer = { id: `c-${Date.now()}`, name: name, separation: newSeparation.value, role: newRole.value, gender: newGender.value };
  
  // Update UI immediately
  masterPool.push(freshPlayer); 
  activePlayers.push(freshPlayer);
  masterPool = alignCreatorFirst(masterPool); 
  activePlayers = alignCreatorFirst(activePlayers);
  saveMasterPool(); 
  saveActivePlayers(); 
  
  newPlayerName.value = ""; newSeparation.value = "None"; newRole.value = "Batsman"; newGender.value = "M";
  renderChecklistPool(); 
  renderProfilesDirectory();
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
  activePlayers = alignCreatorFirst(newActiveList); 
  saveActivePlayers(); 
  totalPlayers.textContent = activePlayers.length;
  goToStep(2);
});

generateBtn.addEventListener("click", splitTeamsViaAPI);
bottomReshuffleBtn.addEventListener("click", splitTeamsViaAPI);

window.addEventListener("DOMContentLoaded", loadMasterPoolFromAPI);

function escapeHtml(val) { 
  return String(val || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); 
}

function alignCreatorFirst(array) {
  const creator = array.filter(p => p.name === "DIWA OG");
  const rest = array.filter(p => p.name !== "DIWA OG");
  return [...creator, ...rest];
}

// STRICTLY ALIGNED RENDER TEAM - Completely removed Role block
function renderTeam(container, teamPlayers, captainId) {
  container.innerHTML = "";
  teamPlayers.forEach((player, index) => {
    const isCaptain = player.id === captainId; 
    const isCreator = player.name === "DIWA OG";
    const initial = player.name ? player.name.charAt(0) : "?"; 
    const imgName = "photos/" + escapeHtml(player.name.toLowerCase().trim()) + ".jpg";
    
    const row = document.createElement("div");
    row.className = `team-player ${isCreator ? 'creator-glow-row' : ''} ${isCaptain ? 'captain-row' : ''}`;
    const captainLabel = isCaptain ? `<div class="captain-badge">👑 Captain</div>` : '';
    
    row.innerHTML = `
      <div class="team-player-left">
        <div class="player-order-number">${index + 1}</div>
        <div class="player-avatar team-avatar">
          <span class="avatar-initial">${initial}</span>
          <img src="${imgName}" onerror="this.style.display='none'" class="avatar-image" alt="${initial}">
        </div>
        <div class="team-player-info">
          <span class="player-name-text ${isCreator ? 'creator-text-gradient' : ''}">${escapeHtml(player.name)}</span>
          ${captainLabel}
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}

// RESTORED LONG PRESS ACTIONS - REMOVED INLINE BUTTONS
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
    
    card.innerHTML = `
      <div class="saved-match-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(savedItem.title)}</div>
      <div class="saved-match-meta"><span>${dateStr}</span><span class="match-type-badge">${modeText}</span></div>
    `;
    
    let pressTimer; let isLongPress = false;
    
    const startPress = (e) => {
      isLongPress = false; 
      pressTimer = setTimeout(() => {
        isLongPress = true; 
        if (navigator.vibrate) navigator.vibrate(40);
        
        const actionModal = document.getElementById('matchActionModal');
        actionModal.classList.add('active');

        document.getElementById('actionRenameBtn').onclick = () => {
          actionModal.classList.remove('active');
          customPrompt("Rename Match", savedItem.title, (newName) => {
            if (newName && newName.trim() !== "") {
              const updatedList = savedList.map(item => item.id === savedItem.id ? { ...item, title: newName.trim() } : item);
              localStorage.setItem(storageKeySavedMatchesList, JSON.stringify(updatedList));
              renderSavedMatches();
            }
          });
        };

        document.getElementById('actionDeleteBtn').onclick = () => {
          actionModal.classList.remove('active');
          customConfirm("Delete Match?", `Are you sure you want to permanently delete "${savedItem.title}"?`, (confirmed) => {
            if (confirmed) {
              const updatedList = savedList.filter(item => item.id !== savedItem.id);
              localStorage.setItem(storageKeySavedMatchesList, JSON.stringify(updatedList));
              checkSavedMatches(); renderSavedMatches(); 
              if (updatedList.length === 0) savedMatchesModal.classList.remove("active");
            }
          });
        };

        document.getElementById('actionCancelBtn').onclick = () => {
          actionModal.classList.remove('active');
        };

      }, 500); 
    };
    
    const cancelPress = (e) => { 
      clearTimeout(pressTimer); 
      if (isLongPress && e.type === 'touchend') e.preventDefault(); 
    };

    // Long Press Event Listeners
    card.addEventListener('touchstart', startPress, {passive: true}); 
    card.addEventListener('touchend', cancelPress);
    card.addEventListener('touchmove', cancelPress); 
    card.addEventListener('mousedown', startPress);
    card.addEventListener('mouseup', cancelPress); 
    card.addEventListener('mouseleave', cancelPress);
    card.addEventListener('contextmenu', (e) => e.preventDefault());

    // Single Tap to Load
    card.addEventListener('click', (e) => {
      if (isLongPress) { e.preventDefault(); return; }
      savedMatchesModal.classList.remove("active");
      const match = savedItem.data; 
      currentGeneratedMatch = match; 
      appMatchMode = match.mode || 'teams';
      setupStep3View(appMatchMode); 
      renderTeam(teamA, match.teamA, match.capA);
      if (appMatchMode === 'teams') renderTeam(teamB, match.teamB, match.capB);
      goToStep(3);
    });
    
    savedMatchesList.appendChild(card);
  });
}

// ... All other UI fallback functions like customPrompt, splitTeams (fallback), logic are included in the HTML snippet natively.