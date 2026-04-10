import re

from sqlalchemy import inspect, text

from extensions import db
from models import MarkerType, News

DEFAULT_ICON_PATH = "icons/default.svg"
DEFAULT_BG_COLOR = "#8a4b00"
DEFAULT_BORDER_COLOR = "#f4c20d"
DEFAULT_ICON_COLOR = "#ffffff"

DEFAULT_MARKER_TYPES = (
    {
        "name": "Warning",
        "slug": "warning",
        "icon_path": DEFAULT_ICON_PATH,
        "bg_color": "#8a4b00",
        "border_color": "#f4c20d",
        "icon_color": "#ffffff",
    },
    {
        "name": "Rocket",
        "slug": "rocket",
        "icon_path": "icons/rocket.svg",
        "bg_color": "#8a4b00",
        "border_color": "#f4c20d",
        "icon_color": "#ffffff",
    },
    {
        "name": "Fire",
        "slug": "fire",
        "icon_path": DEFAULT_ICON_PATH,
        "bg_color": "#9b2c2c",
        "border_color": "#f5a623",
        "icon_color": "#ffffff",
    },
    {
        "name": "Protest",
        "slug": "protest",
        "icon_path": DEFAULT_ICON_PATH,
        "bg_color": "#5a3b0a",
        "border_color": "#d6a547",
        "icon_color": "#ffffff",
    },
    {
        "name": "Drone",
        "slug": "drone",
        "icon_path": "icons/drone.svg",
        "bg_color": "#1f3a5f",
        "border_color": "#8fb3ff",
        "icon_color": "#ffffff",
    },
    {
        "name": "Bomb",
        "slug": "bomb",
        "icon_path": "icons/bomb.svg",
        "bg_color": "#242424",
        "border_color": "#c5c5c5",
        "icon_color": "#ffffff",
    },
    {
        "name": "Airstrike",
        "slug": "airstrike",
        "icon_path": "icons/rocket.svg",
        "bg_color": "#3d2b55",
        "border_color": "#b79cff",
        "icon_color": "#ffffff",
    },
)


def normalize_marker_type_slug(value):
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower())
    return slug.strip("-")


def humanize_marker_type_slug(slug):
    cleaned = normalize_marker_type_slug(slug)
    if not cleaned:
        return "Type"
    return cleaned.replace("-", " ").title()


def normalize_marker_color(value, default):
    raw = str(value or "").strip()
    if re.match(r"^#[0-9a-fA-F]{6}$", raw):
        return raw.lower()

    short_match = re.match(r"^#[0-9a-fA-F]{3}$", raw)
    if short_match:
        return f"#{raw[1]*2}{raw[2]*2}{raw[3]*2}".lower()

    return default


def ensure_marker_type_schema():
    MarkerType.__table__.create(bind=db.engine, checkfirst=True)

    inspector = inspect(db.engine)
    columns = {column["name"] for column in inspector.get_columns("marker_type")}
    additions = (
        ("bg_color", "VARCHAR(20) NOT NULL DEFAULT '#8a4b00'"),
        ("border_color", "VARCHAR(20) NOT NULL DEFAULT '#f4c20d'"),
        ("icon_color", "VARCHAR(20) NOT NULL DEFAULT '#ffffff'"),
    )

    added_any = False
    for column_name, ddl in additions:
        if column_name in columns:
            continue

        db.session.execute(text(f"ALTER TABLE marker_type ADD COLUMN {column_name} {ddl}"))
        added_any = True

    if added_any:
        db.session.commit()


def ensure_marker_types_seeded():
    ensure_marker_type_schema()

    changed = False

    existing_by_slug = {item.slug: item for item in MarkerType.query.all()}
    if not existing_by_slug:
        for item in DEFAULT_MARKER_TYPES:
            db.session.add(
                MarkerType(
                    name=item["name"],
                    slug=item["slug"],
                    icon_path=item["icon_path"],
                    bg_color=item["bg_color"],
                    border_color=item["border_color"],
                    icon_color=item["icon_color"],
                    is_active=True,
                )
            )
        db.session.commit()
        existing_by_slug = {item.slug: item for item in MarkerType.query.all()}

    distinct_news_types = db.session.query(News.marker_type).distinct().all()
    for (raw_type,) in distinct_news_types:
        slug = normalize_marker_type_slug(raw_type)
        if not slug or slug in existing_by_slug:
            continue

        marker_type = MarkerType(
            name=humanize_marker_type_slug(slug),
            slug=slug,
            icon_path=DEFAULT_ICON_PATH,
            bg_color=DEFAULT_BG_COLOR,
            border_color=DEFAULT_BORDER_COLOR,
            icon_color=DEFAULT_ICON_COLOR,
            is_active=True,
        )
        db.session.add(marker_type)
        existing_by_slug[slug] = marker_type
        changed = True

    if changed:
        db.session.commit()


def get_marker_type_fallback_slug():
    ensure_marker_types_seeded()

    active = MarkerType.query.filter_by(is_active=True).order_by(MarkerType.id.asc()).first()
    if active:
        return active.slug

    warning = MarkerType.query.filter_by(slug="warning").first()
    if warning:
        warning.is_active = True
        db.session.commit()
        return warning.slug

    warning = MarkerType(
        name="Warning",
        slug="warning",
        icon_path=DEFAULT_ICON_PATH,
        bg_color=DEFAULT_BG_COLOR,
        border_color=DEFAULT_BORDER_COLOR,
        icon_color=DEFAULT_ICON_COLOR,
        is_active=True,
    )
    db.session.add(warning)
    db.session.commit()
    return warning.slug


def sanitize_marker_type_for_save(raw_slug, allow_inactive=False):
    slug = normalize_marker_type_slug(raw_slug)
    if not slug:
        return get_marker_type_fallback_slug()

    marker_type = MarkerType.query.filter_by(slug=slug).first()
    if marker_type:
        if allow_inactive or marker_type.is_active:
            return marker_type.slug
        return get_marker_type_fallback_slug()

    return get_marker_type_fallback_slug()


def get_marker_type_icon_paths(include_inactive=True):
    ensure_marker_types_seeded()

    query = MarkerType.query
    if not include_inactive:
        query = query.filter_by(is_active=True)

    icon_map = {}
    for marker_type in query.order_by(MarkerType.name.asc()).all():
        icon_map[marker_type.slug] = marker_type.icon_path or DEFAULT_ICON_PATH

    return icon_map


def get_marker_type_style_map(include_inactive=True):
    ensure_marker_types_seeded()

    query = MarkerType.query
    if not include_inactive:
        query = query.filter_by(is_active=True)

    style_map = {}
    for marker_type in query.order_by(MarkerType.name.asc()).all():
        style_map[marker_type.slug] = {
            "icon_path": marker_type.icon_path or DEFAULT_ICON_PATH,
            "bg_color": normalize_marker_color(marker_type.bg_color, DEFAULT_BG_COLOR),
            "border_color": normalize_marker_color(marker_type.border_color, DEFAULT_BORDER_COLOR),
            "icon_color": normalize_marker_color(marker_type.icon_color, DEFAULT_ICON_COLOR),
        }

    return style_map


def get_marker_type_choices(include_inactive_slug=None):
    ensure_marker_types_seeded()

    active_types = MarkerType.query.filter_by(is_active=True).order_by(MarkerType.name.asc()).all()
    choices = list(active_types)

    if include_inactive_slug:
        include_slug = normalize_marker_type_slug(include_inactive_slug)
        if include_slug and not any(item.slug == include_slug for item in choices):
            extra_type = MarkerType.query.filter_by(slug=include_slug).first()
            if extra_type:
                choices.append(extra_type)

    return choices
