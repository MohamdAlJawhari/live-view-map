import json

from flask import render_template, request, redirect, url_for
from flask_login import login_required

from extensions import db
from models import Polygon

from . import bp


@bp.route("/admin/polygons")
@login_required
def admin_polygons():
    polygons = Polygon.query.order_by(Polygon.id.desc()).all()
    return render_template("admin_polygons.html", polygons=polygons)


@bp.route("/admin/polygons/add", methods=["GET", "POST"])
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
            return redirect(url_for("polygons.admin_polygons"))

        except json.JSONDecodeError:
            return "Invalid JSON format for coordinates."

    return render_template("polygon_form.html", form_title="Add Polygon", polygon=None)


@bp.route("/admin/polygons/edit/<int:polygon_id>", methods=["GET", "POST"])
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
            return redirect(url_for("polygons.admin_polygons"))

        except json.JSONDecodeError:
            return "Invalid JSON format for coordinates."

    return render_template("polygon_form.html", form_title="Edit Polygon", polygon=polygon)


@bp.route("/admin/polygons/delete/<int:polygon_id>", methods=["POST"])
@login_required
def delete_polygon(polygon_id):
    polygon = Polygon.query.get_or_404(polygon_id)
    db.session.delete(polygon)
    db.session.commit()
    return redirect(url_for("polygons.admin_polygons"))


@bp.route("/admin/polygons/draw", methods=["GET", "POST"])
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
            return redirect(url_for("polygons.admin_polygons"))

        except json.JSONDecodeError:
            return "Invalid polygon coordinates."

    return render_template("draw_polygon.html")


@bp.route("/admin/polygons/map", methods=["GET", "POST"])
@login_required
def polygons_map():
    if request.method == "POST":
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
        return redirect(url_for("polygons.admin_polygons"))

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


@bp.route("/admin/polygons/edit-map/<int:polygon_id>", methods=["GET", "POST"])
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
            return redirect(url_for("polygons.admin_polygons"))
        except json.JSONDecodeError:
            return "Invalid polygon coordinates."

    polygon_data = {
        "id": polygon.id,
        "name": polygon.name,
        "color": polygon.color,
        "coordinates": polygon.get_coordinates()
    }

    return render_template("edit_polygon_map.html", polygon=polygon_data)
