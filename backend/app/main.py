import os
import json
import hashlib
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .db import Base, engine, SessionLocal
from .models import Run
from .llm import run_model
from .risk import assess, to_json

load_dotenv()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Risk Explorer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

class CompareRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)

class CompareResponse(BaseModel):
    run_id: int
    response_a: str
    response_b: str
    disagreement_score: float
    flags: list[dict]

@app.post("/compare", response_model=CompareResponse)
async def compare(req: CompareRequest, db: Session = Depends(get_db)):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not set")

    prompt = req.prompt.strip()
    model_a = os.getenv("MODEL_A", "gpt-4o-mini")
    model_b = os.getenv("MODEL_B", "gpt-4o-mini")

    prompt_hash = sha256_hex(prompt)
    prompt_len = len(prompt)

    resp_a = await run_model(model_a, prompt)
    resp_b = await run_model(model_b, prompt)

    disagreement_score, flags = assess(prompt, resp_a, resp_b)

    run = Run(
        prompt_hash=prompt_hash,
        prompt_len=prompt_len,
        model_a=model_a,
        model_b=model_b,
        response_a=resp_a,
        response_b=resp_b,
        disagreement_score=disagreement_score,
        risk_json=to_json(disagreement_score, flags),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    return CompareResponse(
        run_id=run.id,
        response_a=resp_a,
        response_b=resp_b,
        disagreement_score=disagreement_score,
        flags=flags,
    )

@app.get("/stats")
def stats(db: Session = Depends(get_db)):
    runs = db.query(Run).all()
    total = len(runs)
    if total == 0:
        return {"total_runs": 0, "avg_disagreement": 0.0, "flag_counts": {}}

    avg_disagreement = round(sum(r.disagreement_score for r in runs) / total, 3)

    flag_counts: dict[str, int] = {}
    for r in runs:
        try:
            payload = json.loads(r.risk_json)
            for f in payload.get("flags", []):
                t = f.get("type", "unknown")
                flag_counts[t] = flag_counts.get(t, 0) + 1
        except Exception:
            flag_counts["parse_error"] = flag_counts.get("parse_error", 0) + 1

    return {
        "total_runs": total,
        "avg_disagreement": avg_disagreement,
        "flag_counts": flag_counts,
    }


