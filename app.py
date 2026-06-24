import time
import random
import copy
from typing import List, Tuple
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# =====================================================================
# 1. DATABASE CONFIGURATION & SCHEMAS (Formerly database.py & models.py)
# =====================================================================

SQLALCHEMY_DATABASE_URL = "sqlite:///./matchmaker.db"

# Setting up the SQLite engine and session factory
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# SQLAlchemy Database Model
class DBPlayer(Base):
    __tablename__ = "players"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    separation = Column(String, default="None")  # Tiering (O, A, B, etc.)
    role = Column(String, default="Batsman")
    gender = Column(String, default="M")

# Dependency to safely inject DB sessions into API routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================================================
# 2. DATA VALIDATION MODELS (Formerly schemas.py)
# =====================================================================

class PlayerBase(BaseModel):
    name: str
    separation: str
    role: str
    gender: str

class PlayerCreate(PlayerBase):
    pass

class PlayerResponse(PlayerBase):
    id: str

    class Config:
        from_attributes = True

class TeamSplitRequest(BaseModel):
    player_ids: List[str]

class TeamSplitResponse(BaseModel):
    team_A: List[PlayerResponse]
    team_B: List[PlayerResponse]
    captain_A: str
    captain_B: str


# =====================================================================
# 3. OOP MATCHMAKING SERVICES & ALGORITHM (Formerly services.py)
# =====================================================================

class MatchMakerService:
    @staticmethod
    def get_all_players(db: Session) -> List[DBPlayer]:
        # Keeps "DIWA OG" sorted at the absolute top if they exist in the roster
        players = db.query(DBPlayer).all()
        creator = [p for p in players if p.name == "DIWA OG"]
        others = [p for p in players if p.name != "DIWA OG"]
        return creator + others

    @staticmethod
    def add_player(db: Session, player_data: PlayerCreate, custom_id: str) -> DBPlayer:
        db_player = DBPlayer(
            id=custom_id,
            name=player_data.name.strip().upper(),
            separation=player_data.separation,
            role=player_data.role,
            gender=player_data.gender
        )
        db.add(db_player)
        db.commit()
        db.refresh(db_player)
        return db_player

    @staticmethod
    def split_teams(db: Session, player_ids: List[str]) -> Tuple[List[DBPlayer], List[DBPlayer], str, str]:
        # Gather matching active database records
        active_pool = db.query(DBPlayer).filter(DBPlayer.id.in_(player_ids)).all()
        if len(active_pool) < 2:
            raise ValueError("Must select at least 2 players to split teams!")

        # Create localized deep copies in memory to completely isolate DB records from mutation
        working_pool = copy.deepcopy(active_pool)
        
        team_a: List[DBPlayer] = []
        team_b: List[DBPlayer] = []
        leftovers: List[DBPlayer] = []
        groups = {}

        # Classify players strictly into groups based on tier separation values
        for player in working_pool:
            tier = player.separation or "None"
            if tier not in groups:
                groups[tier] = []
            groups[tier].append(player)

        # Distribute pairs from each matching tier evenly across both teams
        for tier, members in groups.items():
            random.shuffle(members)
            if tier != "None" and len(members) >= 2:
                if random.random() > 0.5:
                    team_a.append(members[0])
                    team_b.append(members[1])
                else:
                    team_a.append(members[1])
                    team_b.append(members[0])
                leftovers.extend(members[2:])
            else:
                leftovers.extend(members)

        # Handle remaining odd-numbered or un-tiered players safely
        random.shuffle(leftovers)
        for player in leftovers:
            if len(team_a) > len(team_b):
                team_b.append(player)
            elif len(team_b) > len(team_a):
                team_a.append(player)
            else:
                if random.random() > 0.5:
                    team_a.append(player)
                else:
                    team_b.append(player)

        # Appoint completely random captain IDs from the final lineups
        cap_a = random.choice(team_a).id if team_a else ""
        cap_b = random.choice(team_b).id if team_b else ""

        # Enforce display alignment preferences for "DIWA OG" in the response output
        def align_creator(team_list):
            creator = [p for p in team_list if p.name == "DIWA OG"]
            others = [p for p in team_list if p.name != "DIWA OG"]
            return creator + others

        return align_creator(team_a), align_creator(team_b), cap_a, cap_b


# =====================================================================
# 4. FASTAPI CONTROLLER & APP SETUP (Formerly main.py)
# =====================================================================

# Initialize the SQLite tables dynamically on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Diwa MatchMaker Monolithic Core API")

# Configure CORS so your frontend index.html file can safely fetch from it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/players", response_model=List[PlayerResponse])
def get_players(db: Session = Depends(get_db)):
    return MatchMakerService.get_all_players(db)

@app.post("/api/players", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
def create_player(player: PlayerCreate, db: Session = Depends(get_db)):
    custom_id = f"c-{int(time.time() * 1000)}"
    return MatchMakerService.add_player(db, player, custom_id)

@app.post("/api/teams/split", response_model=TeamSplitResponse)
def split_teams(request: TeamSplitRequest, db: Session = Depends(get_db)):
    try:
        team_a, team_b, cap_a, cap_b = MatchMakerService.split_teams(db, request.player_ids)
        return {
            "team_A": team_a,
            "team_B": team_b,
            "captain_A": cap_a,
            "captain_B": cap_b
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))