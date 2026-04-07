from flask import Blueprint

bp = Blueprint("polygons", __name__)

from app.polygons import routes
