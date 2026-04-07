from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app import create_app
from extensions import db
from models import User
from werkzeug.security import generate_password_hash

app = create_app()


def main():
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


if __name__ == "__main__":
    main()
