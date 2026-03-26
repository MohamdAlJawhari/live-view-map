from flask import Flask, render_template
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
    return render_template("index.html", page_title="Live View Map")


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, host="0.0.0.0", port=8000)