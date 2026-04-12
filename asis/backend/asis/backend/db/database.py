from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from asis.backend.config.settings import get_settings
from asis.backend.db.base import Base


def _normalize_database_url(database_url: str) -> str:
    if database_url.startswith("postgresql+asyncpg://"):
        return database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    if database_url.startswith("sqlite+aiosqlite:///:memory:") or database_url.startswith("sqlite:///:memory:"):
        return "sqlite:///file::memory:?cache=shared"
    if database_url.startswith("sqlite+aiosqlite://"):
        return database_url.replace("sqlite+aiosqlite://", "sqlite://", 1)
    return database_url


def _create_engine():
    settings = get_settings()
    database_url = _normalize_database_url(settings.database_url)
    connect_args = {"check_same_thread": False} if settings.is_sqlite else {}
    if database_url == "sqlite:///file::memory:?cache=shared":
        connect_args["uri"] = True
    return create_engine(database_url, future=True, connect_args=connect_args, pool_pre_ping=not settings.is_sqlite)


engine = _create_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)


def reset_engine() -> None:
    global engine, SessionLocal
    engine.dispose()
    engine = _create_engine()
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)


def init_db() -> None:
    from asis.backend.db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


@contextmanager
def session_scope():
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
