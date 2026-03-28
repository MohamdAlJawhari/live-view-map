from datetime import datetime
from extensions import db
from flask_login import UserMixin
import json

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

class News(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    marker_type = db.Column(db.String(50), nullable=False)
    region_name = db.Column(db.String(100), nullable=True)
    source_url = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    published_at = db.Column(db.DateTime, nullable=True)
    is_visible = db.Column(db.Boolean, default=True)

    def __repr__(self):
        return f"<News {self.title}>"

class Polygon(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    color = db.Column(db.String(20), default="red")
    coordinates = db.Column(db.Text, nullable=False)  # store JSON string

    def get_coordinates(self):
        return json.loads(self.coordinates)