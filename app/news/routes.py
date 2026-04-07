import json

from flask import render_template, request, redirect, url_for
from flask_login import login_required

from extensions import db
from models import News

from . import bp


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
            marker_type=request.form["marker_type"],
            region_name=request.form["region_name"],
            source_url=request.form["source_url"],
            is_visible="is_visible" in request.form
        )
        db.session.add(new_item)
        db.session.commit()
        return redirect(url_for("news.admin_news"))

    return render_template("news_form.html", form_title="Add News", news_item=None)


@bp.route("/admin/news/edit/<int:news_id>", methods=["GET", "POST"])
@login_required
def edit_news(news_id):
    news_item = News.query.get_or_404(news_id)

    if request.method == "POST":
        news_item.title = request.form["title"]
        news_item.description = request.form["description"]
        news_item.latitude = float(request.form["latitude"])
        news_item.longitude = float(request.form["longitude"])
        news_item.marker_type = request.form["marker_type"]
        news_item.region_name = request.form["region_name"]
        news_item.source_url = request.form["source_url"]
        news_item.is_visible = "is_visible" in request.form

        db.session.commit()
        return redirect(url_for("news.admin_news"))

    return render_template("news_form.html", form_title="Edit News", news_item=news_item)


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

        # Create new markers
        for item in data.get("created", []):
            news = News(
                title=item["title"],
                description=item["description"],
                latitude=item["latitude"],
                longitude=item["longitude"],
                marker_type=item["marker_type"],
                region_name=item.get("region_name", ""),
                source_url=item.get("source_url", ""),
                is_visible=item.get("is_visible", True)
            )
            db.session.add(news)

        # Update existing markers
        for item in data.get("updated", []):
            news = News.query.get(item["id"])
            if news:
                news.title = item["title"]
                news.description = item["description"]
                news.latitude = item["latitude"]
                news.longitude = item["longitude"]
                news.marker_type = item["marker_type"]
                news.region_name = item.get("region_name", "")
                news.source_url = item.get("source_url", "")
                news.is_visible = item.get("is_visible", True)

        # Delete markers
        for item_id in data.get("deleted", []):
            news = News.query.get(item_id)
            if news:
                db.session.delete(news)

        db.session.commit()
        return redirect(url_for("news.admin_news"))

    news_items = News.query.all()

    markers_data = []
    for item in news_items:
        markers_data.append({
            "id": item.id,
            "title": item.title,
            "description": item.description,
            "latitude": item.latitude,
            "longitude": item.longitude,
            "marker_type": item.marker_type,
            "region_name": item.region_name,
            "source_url": item.source_url,
            "is_visible": item.is_visible
        })

    return render_template("markers_map.html", markers_data=markers_data)
