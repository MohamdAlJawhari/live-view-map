import json
import time
from pathlib import Path

from flask import flash, redirect, render_template, request, url_for
from flask_login import login_required
from sqlalchemy import func
from werkzeug.utils import secure_filename

from app.marker_types import (
    DEFAULT_BG_COLOR,
    DEFAULT_BORDER_COLOR,
    DEFAULT_ICON_PATH,
    DEFAULT_ICON_COLOR,
    get_marker_type_choices,
    get_marker_type_fallback_slug,
    normalize_marker_type_slug,
    normalize_marker_color,
    sanitize_marker_type_for_save,
)
from extensions import db
from models import MarkerType, News

from . import bp

ALLOWED_ICON_EXTENSIONS = {"svg", "png", "jpg", "jpeg", "webp", "gif"}
PROJECT_ROOT = Path(__file__).resolve().parents[2]
STATIC_DIR = PROJECT_ROOT / "static"
ICONS_DIR = STATIC_DIR / "icons"
TYPE_ICONS_DIR = ICONS_DIR / "types"


def _marker_type_usage_counts():
    rows = db.session.query(News.marker_type, func.count(News.id)).group_by(News.marker_type).all()
    counts = {}
    for raw_type, count in rows:
        slug = normalize_marker_type_slug(raw_type)
        if not slug:
            continue
        counts[slug] = counts.get(slug, 0) + int(count)
    return counts


def _count_marker_type_usage(slug):
    return _marker_type_usage_counts().get(slug, 0)


def _list_available_icons():
    icons = []
    if ICONS_DIR.exists():
        for path in sorted(ICONS_DIR.rglob("*")):
            if not path.is_file():
                continue
            extension = path.suffix.lower().lstrip(".")
            if extension not in ALLOWED_ICON_EXTENSIONS:
                continue

            relative_path = path.relative_to(STATIC_DIR).as_posix()
            label = relative_path.replace("icons/", "", 1)
            icons.append({"path": relative_path, "label": label})

    if not any(item["path"] == DEFAULT_ICON_PATH for item in icons):
        icons.insert(0, {"path": DEFAULT_ICON_PATH, "label": "default.svg"})

    return icons


def _normalize_icon_path(raw_path):
    requested = str(raw_path or "").strip().replace("\\", "/").lstrip("/")
    if not requested.startswith("icons/"):
        return DEFAULT_ICON_PATH

    full_path = (STATIC_DIR / requested).resolve()
    try:
        full_path.relative_to(STATIC_DIR.resolve())
    except ValueError:
        return DEFAULT_ICON_PATH

    if not full_path.exists() or not full_path.is_file():
        return DEFAULT_ICON_PATH

    extension = full_path.suffix.lower().lstrip(".")
    if extension not in ALLOWED_ICON_EXTENSIONS:
        return DEFAULT_ICON_PATH

    return requested


def _save_uploaded_icon(file_storage, slug):
    if not file_storage or not file_storage.filename:
        return None

    safe_name = secure_filename(file_storage.filename)
    extension = Path(safe_name).suffix.lower().lstrip(".")
    if extension not in ALLOWED_ICON_EXTENSIONS:
        raise ValueError("Unsupported icon file type.")

    TYPE_ICONS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{slug}-{int(time.time() * 1000)}.{extension}"
    target_path = TYPE_ICONS_DIR / filename
    file_storage.save(target_path)
    return f"icons/types/{filename}"


def _is_managed_icon_path(icon_path):
    return str(icon_path or "").replace("\\", "/").startswith("icons/types/")


def _remove_managed_icon_file(icon_path):
    if not _is_managed_icon_path(icon_path):
        return

    full_path = (STATIC_DIR / icon_path).resolve()
    managed_root = TYPE_ICONS_DIR.resolve()
    try:
        full_path.relative_to(managed_root)
    except ValueError:
        return

    if full_path.exists() and full_path.is_file():
        full_path.unlink()


def _render_marker_type_form(form_title, marker_type):
    get_marker_type_fallback_slug()
    return render_template(
        "marker_type_form.html",
        form_title=form_title,
        marker_type=marker_type,
        available_icons=_list_available_icons(),
    )


@bp.route("/admin/news")
@login_required
def admin_news():
    all_news = News.query.order_by(News.id.desc()).all()
    return render_template("admin_news.html", news_items=all_news)


@bp.route("/admin/news/add", methods=["GET", "POST"])
@login_required
def add_news():
    if request.method == "POST":
        new_item = News(
            title=request.form["title"],
            description=request.form["description"],
            latitude=float(request.form["latitude"]),
            longitude=float(request.form["longitude"]),
            marker_type=sanitize_marker_type_for_save(request.form.get("marker_type")),
            region_name=request.form["region_name"],
            source_url=request.form["source_url"],
            is_visible="is_visible" in request.form,
        )
        db.session.add(new_item)
        db.session.commit()
        return redirect(url_for("news.admin_news"))

    return render_template(
        "news_form.html",
        form_title="Add News",
        news_item=None,
        marker_type_choices=get_marker_type_choices(),
        default_marker_type=get_marker_type_fallback_slug(),
    )


@bp.route("/admin/news/edit/<int:news_id>", methods=["GET", "POST"])
@login_required
def edit_news(news_id):
    news_item = News.query.get_or_404(news_id)

    if request.method == "POST":
        news_item.title = request.form["title"]
        news_item.description = request.form["description"]
        news_item.latitude = float(request.form["latitude"])
        news_item.longitude = float(request.form["longitude"])
        news_item.marker_type = sanitize_marker_type_for_save(
            request.form.get("marker_type"),
            allow_inactive=True,
        )
        news_item.region_name = request.form["region_name"]
        news_item.source_url = request.form["source_url"]
        news_item.is_visible = "is_visible" in request.form

        db.session.commit()
        return redirect(url_for("news.admin_news"))

    return render_template(
        "news_form.html",
        form_title="Edit News",
        news_item=news_item,
        marker_type_choices=get_marker_type_choices(include_inactive_slug=news_item.marker_type),
        default_marker_type=normalize_marker_type_slug(news_item.marker_type) or get_marker_type_fallback_slug(),
    )


@bp.route("/admin/news/delete/<int:news_id>", methods=["POST"])
@login_required
def delete_news(news_id):
    news_item = News.query.get_or_404(news_id)
    db.session.delete(news_item)
    db.session.commit()
    return redirect(url_for("news.admin_news"))


@bp.route("/admin/markers/map", methods=["GET", "POST"])
@login_required
def markers_map():
    if request.method == "POST":
        data = json.loads(request.form["data"])

        for item in data.get("created", []):
            news = News(
                title=item["title"],
                description=item["description"],
                latitude=item["latitude"],
                longitude=item["longitude"],
                marker_type=sanitize_marker_type_for_save(item.get("marker_type")),
                region_name=item.get("region_name", ""),
                source_url=item.get("source_url", ""),
                is_visible=item.get("is_visible", True),
            )
            db.session.add(news)

        for item in data.get("updated", []):
            news = News.query.get(item["id"])
            if news:
                news.title = item["title"]
                news.description = item["description"]
                news.latitude = item["latitude"]
                news.longitude = item["longitude"]
                news.marker_type = sanitize_marker_type_for_save(
                    item.get("marker_type"),
                    allow_inactive=True,
                )
                news.region_name = item.get("region_name", "")
                news.source_url = item.get("source_url", "")
                news.is_visible = item.get("is_visible", True)

        for item_id in data.get("deleted", []):
            news = News.query.get(item_id)
            if news:
                db.session.delete(news)

        db.session.commit()
        next_path = request.form.get("next") or url_for("news.admin_news")
        if not next_path.startswith("/"):
            next_path = url_for("news.admin_news")

        return redirect(next_path)

    news_items = News.query.all()
    fallback_type_slug = get_marker_type_fallback_slug()

    markers_data = []
    for item in news_items:
        markers_data.append(
            {
                "id": item.id,
                "title": item.title,
                "description": item.description,
                "latitude": item.latitude,
                "longitude": item.longitude,
                "marker_type": normalize_marker_type_slug(item.marker_type) or fallback_type_slug,
                "region_name": item.region_name,
                "source_url": item.source_url,
                "is_visible": item.is_visible,
            }
        )

    return render_template("markers_map.html", markers_data=markers_data)


@bp.route("/admin/marker-types")
@login_required
def admin_marker_types():
    get_marker_type_fallback_slug()
    marker_types = MarkerType.query.order_by(MarkerType.name.asc()).all()
    return render_template(
        "admin_marker_types.html",
        marker_types=marker_types,
        usage_counts=_marker_type_usage_counts(),
    )


@bp.route("/admin/marker-types/add", methods=["GET", "POST"])
@login_required
def add_marker_type():
    get_marker_type_fallback_slug()

    if request.method == "POST":
        name = str(request.form.get("name", "")).strip()
        slug = normalize_marker_type_slug(request.form.get("slug") or name)
        icon_path = _normalize_icon_path(request.form.get("icon_path") or DEFAULT_ICON_PATH)
        bg_color = normalize_marker_color(request.form.get("bg_color"), DEFAULT_BG_COLOR)
        border_color = normalize_marker_color(request.form.get("border_color"), DEFAULT_BORDER_COLOR)
        icon_color = normalize_marker_color(request.form.get("icon_color"), DEFAULT_ICON_COLOR)

        if not name:
            flash("Name is required.", "error")
            return _render_marker_type_form("Add Marker Type", None)

        if not slug:
            flash("Slug is required.", "error")
            return _render_marker_type_form("Add Marker Type", None)

        existing = MarkerType.query.filter_by(slug=slug).first()
        if existing:
            flash("Marker type slug already exists.", "error")
            return _render_marker_type_form("Add Marker Type", None)

        try:
            uploaded_icon_path = _save_uploaded_icon(request.files.get("icon_file"), slug)
        except ValueError as error:
            flash(str(error), "error")
            return _render_marker_type_form("Add Marker Type", None)

        if uploaded_icon_path:
            icon_path = uploaded_icon_path

        marker_type = MarkerType(
            name=name,
            slug=slug,
            icon_path=icon_path,
            bg_color=bg_color,
            border_color=border_color,
            icon_color=icon_color,
            is_active=True,
        )
        db.session.add(marker_type)
        db.session.commit()
        flash("Marker type created.", "success")
        return redirect(url_for("news.admin_marker_types"))

    return _render_marker_type_form("Add Marker Type", None)


@bp.route("/admin/marker-types/edit/<int:type_id>", methods=["GET", "POST"])
@login_required
def edit_marker_type(type_id):
    get_marker_type_fallback_slug()
    marker_type = MarkerType.query.get_or_404(type_id)

    if request.method == "POST":
        old_slug = marker_type.slug
        old_icon_path = marker_type.icon_path

        name = str(request.form.get("name", "")).strip()
        slug = normalize_marker_type_slug(request.form.get("slug") or name)
        icon_path = _normalize_icon_path(request.form.get("icon_path") or marker_type.icon_path)
        bg_color = normalize_marker_color(request.form.get("bg_color"), DEFAULT_BG_COLOR)
        border_color = normalize_marker_color(request.form.get("border_color"), DEFAULT_BORDER_COLOR)
        icon_color = normalize_marker_color(request.form.get("icon_color"), DEFAULT_ICON_COLOR)

        if not name:
            flash("Name is required.", "error")
            return _render_marker_type_form("Edit Marker Type", marker_type)

        if not slug:
            flash("Slug is required.", "error")
            return _render_marker_type_form("Edit Marker Type", marker_type)

        existing = MarkerType.query.filter_by(slug=slug).first()
        if existing and existing.id != marker_type.id:
            flash("Marker type slug already exists.", "error")
            return _render_marker_type_form("Edit Marker Type", marker_type)

        try:
            uploaded_icon_path = _save_uploaded_icon(request.files.get("icon_file"), slug)
        except ValueError as error:
            flash(str(error), "error")
            return _render_marker_type_form("Edit Marker Type", marker_type)

        if uploaded_icon_path:
            icon_path = uploaded_icon_path

        marker_type.name = name
        marker_type.slug = slug
        marker_type.icon_path = icon_path
        marker_type.bg_color = bg_color
        marker_type.border_color = border_color
        marker_type.icon_color = icon_color

        if old_slug != slug:
            for news_item in News.query.all():
                if normalize_marker_type_slug(news_item.marker_type) == old_slug:
                    news_item.marker_type = slug

        db.session.commit()

        if old_icon_path != icon_path and _is_managed_icon_path(old_icon_path):
            still_referenced = MarkerType.query.filter(
                MarkerType.id != marker_type.id,
                MarkerType.icon_path == old_icon_path,
            ).first()
            if not still_referenced:
                _remove_managed_icon_file(old_icon_path)

        flash("Marker type updated.", "success")
        return redirect(url_for("news.admin_marker_types"))

    return _render_marker_type_form("Edit Marker Type", marker_type)


@bp.route("/admin/marker-types/toggle/<int:type_id>", methods=["POST"])
@login_required
def toggle_marker_type(type_id):
    get_marker_type_fallback_slug()
    marker_type = MarkerType.query.get_or_404(type_id)

    if marker_type.is_active:
        active_count = MarkerType.query.filter_by(is_active=True).count()
        if active_count <= 1:
            flash("At least one marker type must stay active.", "error")
            return redirect(url_for("news.admin_marker_types"))

        marker_type.is_active = False
        flash("Marker type deactivated.", "success")
    else:
        marker_type.is_active = True
        flash("Marker type activated.", "success")

    db.session.commit()
    return redirect(url_for("news.admin_marker_types"))


@bp.route("/admin/marker-types/delete/<int:type_id>", methods=["POST"])
@login_required
def delete_marker_type(type_id):
    get_marker_type_fallback_slug()
    marker_type = MarkerType.query.get_or_404(type_id)

    if MarkerType.query.count() <= 1:
        flash("Cannot delete the last marker type.", "error")
        return redirect(url_for("news.admin_marker_types"))

    usage_count = _count_marker_type_usage(marker_type.slug)
    if usage_count > 0:
        flash(f"Cannot delete marker type in use by {usage_count} marker(s).", "error")
        return redirect(url_for("news.admin_marker_types"))

    icon_path = marker_type.icon_path
    db.session.delete(marker_type)
    db.session.commit()

    if _is_managed_icon_path(icon_path):
        still_referenced = MarkerType.query.filter(MarkerType.icon_path == icon_path).first()
        if not still_referenced:
            _remove_managed_icon_file(icon_path)

    flash("Marker type deleted.", "success")
    return redirect(url_for("news.admin_marker_types"))
