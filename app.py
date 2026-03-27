from flask import Flask, render_template, request, redirect, url_for
from extensions import db

app = Flask(__name__)

# Database configuration
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///news.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Connect db to app
db.init_app(app)

# Import models after db is created
from models import News

@app.route("/")
def index():
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

    return render_template(
        "index.html",
        page_title="Live View Map",
        news_data=news_data,
        marker_types=sorted(marker_types)
    )

@app.route("/admin/news")
def admin_news():
    all_news = News.query.order_by(News.id.desc()).all()
    return render_template("admin_news.html", news_items=all_news)

@app.route("/admin/news/add", methods=["GET", "POST"])
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
        return redirect(url_for("admin_news"))

    return render_template("news_form.html", form_title="Add News", news_item=None)


@app.route("/admin/news/edit/<int:news_id>", methods=["GET", "POST"])
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
        return redirect(url_for("admin_news"))

    return render_template("news_form.html", form_title="Edit News", news_item=news_item)


@app.route("/admin/news/delete/<int:news_id>", methods=["POST"])
def delete_news(news_id):
    news_item = News.query.get_or_404(news_id)
    db.session.delete(news_item)
    db.session.commit()
    return redirect(url_for("admin_news"))


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, host="0.0.0.0", port=8000)