from sqlalchemy import Column, Integer, String, DateTime, Float, Text
from sqlalchemy.sql import func
from .db import Base

class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # privacy-safe: do not store raw prompt
    prompt_hash = Column(String(64), nullable=False, index=True)
    prompt_len = Column(Integer, nullable=False)

    model_a = Column(String(64), nullable=False)
    model_b = Column(String(64), nullable=False)

    response_a = Column(Text, nullable=False)
    response_b = Column(Text, nullable=False)

    disagreement_score = Column(Float, nullable=False)
    risk_json = Column(Text, nullable=False)  # JSON string

