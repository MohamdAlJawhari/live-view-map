import os
from flask import Flask, render_template, request, redirect, url_for
from extensions import db, login_manager
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import check_password_hash
import json

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-key")

# Database configuration
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///news.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Connect db to app
db.init_app(app)
login_manager.init_app(app)

login_manager.login_view = "login"  # redirect if not logged in

# Import models after db is created
from models import News, Polygon

@app.route("/")
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

# Admin routes for news management
@app.route("/admin/news")
@login_required
def admin_news():
    all_news = News.query.order_by(News.id.desc()).all()
    return render_template("admin_news.html", news_items=all_news)

@app.route("/admin/news/add", methods=["GET", "POST"])
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
        return redirect(url_for("admin_news"))

    return render_template("news_form.html", form_title="Add News", news_item=None)


@app.route("/admin/news/edit/<int:news_id>", methods=["GET", "POST"])
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
        return redirect(url_for("admin_news"))

    return render_template("news_form.html", form_title="Edit News", news_item=news_item)


@app.route("/admin/news/delete/<int:news_id>", methods=["POST"])
@login_required
def delete_news(news_id):
    news_item = News.query.get_or_404(news_id)
    db.session.delete(news_item)
    db.session.commit()
    return redirect(url_for("admin_news"))


# Map-based marker management route
@app.route("/admin/markers/map", methods=["GET", "POST"])
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
        return redirect(url_for("admin_news"))

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


# Polygon management routes
@app.route("/admin/polygons")
@login_required
def admin_polygons():
    polygons = Polygon.query.order_by(Polygon.id.desc()).all()
    return render_template("admin_polygons.html", polygons=polygons)


@app.route("/admin/polygons/add", methods=["GET", "POST"])
@login_required
def add_polygon():
    if request.method == "POST":
        name = request.form["name"]
        color = request.form["color"]
        coordinates_text = request.form["coordinates"].strip()

        try:
            coordinates_list = json.loads(coordinates_text)

            new_polygon = Polygon(
                name=name,
                color=color,
                coordinates=json.dumps(coordinates_list)
            )

            db.session.add(new_polygon)
            db.session.commit()
            return redirect(url_for("admin_polygons"))

        except json.JSONDecodeError:
            return "Invalid JSON format for coordinates."

    return render_template("polygon_form.html", form_title="Add Polygon", polygon=None)


@app.route("/admin/polygons/edit/<int:polygon_id>", methods=["GET", "POST"])
@login_required
def edit_polygon(polygon_id):
    polygon = Polygon.query.get_or_404(polygon_id)

    if request.method == "POST":
        polygon.name = request.form["name"]
        polygon.color = request.form["color"]
        coordinates_text = request.form["coordinates"].strip()

        try:
            coordinates_list = json.loads(coordinates_text)
            polygon.coordinates = json.dumps(coordinates_list)

            db.session.commit()
            return redirect(url_for("admin_polygons"))

        except json.JSONDecodeError:
            return "Invalid JSON format for coordinates."

    return render_template("polygon_form.html", form_title="Edit Polygon", polygon=polygon)


@app.route("/admin/polygons/delete/<int:polygon_id>", methods=["POST"])
@login_required
def delete_polygon(polygon_id):
    polygon = Polygon.query.get_or_404(polygon_id)
    db.session.delete(polygon)
    db.session.commit()
    return redirect(url_for("admin_polygons"))


@app.route("/admin/polygons/draw", methods=["GET", "POST"])
@login_required
def draw_polygon():
    if request.method == "POST":
        name = request.form["name"]
        color = request.form["color"]
        coordinates_text = request.form["coordinates"].strip()

        try:
            coordinates_list = json.loads(coordinates_text)

            new_polygon = Polygon(
                name=name,
                color=color,
                coordinates=json.dumps(coordinates_list)
            )

            db.session.add(new_polygon)
            db.session.commit()
            return redirect(url_for("admin_polygons"))

        except json.JSONDecodeError:
            return "Invalid polygon coordinates."

    return render_template("draw_polygon.html")


@app.route("/admin/polygons/map", methods=["GET", "POST"])
@login_required
def polygons_map():
    if request.method == "POST":
        import json

        data = json.loads(request.form["data"])

        # Handle created
        for p in data.get("created", []):
            new_polygon = Polygon(
                name=p["name"],
                color=p["color"],
                coordinates=json.dumps(p["coordinates"])
            )
            db.session.add(new_polygon)

        # Handle updated
        for p in data.get("updated", []):
            polygon = Polygon.query.get(p["id"])
            if polygon:
                polygon.name = p["name"]
                polygon.color = p["color"]
                polygon.coordinates = json.dumps(p["coordinates"])

        # Handle deleted
        for p_id in data.get("deleted", []):
            polygon = Polygon.query.get(p_id)
            if polygon:
                db.session.delete(polygon)

        db.session.commit()
        return redirect(url_for("admin_polygons"))

    polygons = Polygon.query.all()

    polygon_data = [
        {
            "id": p.id,
            "name": p.name,
            "color": p.color,
            "coordinates": p.get_coordinates()
        }
        for p in polygons
    ]

    return render_template("polygons_map.html", polygons=polygon_data)


@app.route("/admin/polygons/edit-map/<int:polygon_id>", methods=["GET", "POST"])
@login_required
def edit_polygon_map(polygon_id):
    polygon = Polygon.query.get_or_404(polygon_id)

    if request.method == "POST":
        polygon.name = request.form["name"]
        polygon.color = request.form["color"]

        coordinates_text = request.form["coordinates"].strip()

        try:
            coordinates_list = json.loads(coordinates_text)
            polygon.coordinates = json.dumps(coordinates_list)

            db.session.commit()
            return redirect(url_for("admin_polygons"))
        except json.JSONDecodeError:
            return "Invalid polygon coordinates."

    polygon_data = {
        "id": polygon.id,
        "name": polygon.name,
        "color": polygon.color,
        "coordinates": polygon.get_coordinates()
    }

    return render_template("edit_polygon_map.html", polygon=polygon_data)


from models import User

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user = User.query.filter_by(username=request.form["username"]).first()

        if user and check_password_hash(user.password, request.form["password"]):
            login_user(user)
            return redirect(url_for("admin_news"))

        return "Invalid credentials"

    return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, host="0.0.0.0", port=8000)