from flask import redirect, render_template, request, session, url_for
from flask_login import current_user

from models import News, Polygon
from app.marker_types import (
    get_marker_type_choices,
    get_marker_type_fallback_slug,
    get_marker_type_icon_paths,
    normalize_marker_type_slug,
)

from . import bp


@bp.route("/")
def index():
    if current_user.is_authenticated:
        news_items = News.query.order_by(News.id.desc()).all()
    else:
        news_items = News.query.filter_by(is_visible=True).all()

    news_data = []
    marker_types = set()
    fallback_type_slug = get_marker_type_fallback_slug()

    for item in news_items:
        normalized_type = normalize_marker_type_slug(item.marker_type) or fallback_type_slug
        news_data.append({
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "latitude": item.latitude,
            "longitude": item.longitude,
            "marker_type": normalized_type,
            "region_name": item.region_name,
            "source_url": item.source_url,
            "is_visible": item.is_visible,
        })

        marker_types.add(normalized_type)

    # Add polygon data to the index route
    polygons = Polygon.query.all()

    polygon_data = []
    for p in polygons:
        polygon_data.append({
            "id": p.id,
            "name": p.name,
            "color": p.color,
            "coordinates": p.get_coordinates()
        })

    marker_type_choices = get_marker_type_choices()
    marker_type_icons = {
        slug: url_for("static", filename=icon_path)
        for slug, icon_path in get_marker_type_icon_paths(include_inactive=True).items()
    }

    return render_template(
        "index.html",
        page_title="Live View Map",
        news_data=news_data,
        marker_types=sorted(marker_types),
        marker_type_choices=marker_type_choices,
        marker_type_icons=marker_type_icons,
        polygons=polygon_data
    )


@bp.route("/admin/settings/clustering", methods=["POST"])
def set_clustering():
    session["use_clustering"] = request.form.get("enabled", "true").lower() == "true"

    next_path = request.form.get("next") or url_for("main.index")
    if not next_path.startswith("/"):
        next_path = url_for("main.index")

    return redirect(next_path)
