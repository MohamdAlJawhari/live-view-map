import os


def _env_to_bool(value, default=False):
    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-key")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///news.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    USE_CLUSTERING = _env_to_bool(os.environ.get("USE_CLUSTERING"), default=True)
