from flask import render_template

from models import News, Polygon

from . import bp


@bp.route("/")
def index():
    # Fetch news items from the database
    news_items = News.query.filter_by(is_visible=True).all()

    news_data = []
    marker_types = set()

    for item in news_items:
        news_data.append({
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "latitude": item.latitude,
            "longitude": item.longitude,
            "marker_type": item.marker_type,
            "region_name": item.region_name,
            "source_url": item.source_url,
        })

        marker_types.add(item.marker_type)

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

    return render_template(
        "index.html",
        page_title="Live View Map",
        news_data=news_data,
        marker_types=sorted(marker_types),
        polygons=polygon_data
    )
