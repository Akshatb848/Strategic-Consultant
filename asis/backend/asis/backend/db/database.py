from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from asis.backend.config.logging import logger
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
    if engine.dialect.name == "sqlite":
        _sqlite_add_missing_columns()


def _sqlite_add_missing_columns() -> None:
    """ALTER TABLE ADD COLUMN for any model columns missing from an existing SQLite DB.

    create_all() only creates missing tables, not missing columns in existing tables.
    This runs at startup to handle schema evolution without Alembic on SQLite.
    """
    with engine.connect() as conn:
        for table in Base.metadata.tables.values():
            try:
                result = conn.execute(text(f'PRAGMA table_info("{table.name}")'))
                existing = {row[1] for row in result}
                for col in table.columns:
                    if col.name not in existing:
                        col_type = col.type.compile(dialect=engine.dialect)
                        try:
                            conn.execute(text(
                                f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type}'
                            ))
                            logger.info("sqlite_added_column", table=table.name, column=col.name)
                        except Exception as exc:
                            logger.warning(
                                "sqlite_add_column_failed",
                                table=table.name,
                                column=col.name,
                                error=str(exc),
                            )
                conn.commit()
            except Exception as exc:
                logger.warning("sqlite_schema_check_failed", table=table.name, error=str(exc))


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
