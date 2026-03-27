from app import app
from extensions import db
from models import User
from werkzeug.security import generate_password_hash

with app.app_context():
    db.create_all()

    if not User.query.filter_by(username="admin").first():
        admin = User(
            username="admin",
            password=generate_password_hash("1234")
        )
        db.session.add(admin)
        db.session.commit()
        print("Admin created: username=admin, password=1234")
    else:
        print("Admin already exists")