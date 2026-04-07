from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import json
from app import create_app
from extensions import db
from models import Polygon

app = create_app()

polygon_data = [
    [33.80, 35.40],
    [33.90, 35.50],
    [33.85, 35.65]
]


def main():
    with app.app_context():
        db.create_all()

        if Polygon.query.count() == 0:
            p = Polygon(
                name="Test Region",
                color="red",
                coordinates=json.dumps(polygon_data)
            )
            db.session.add(p)
            db.session.commit()
            print("Polygon added")
        else:
            print("Polygon already exists")


if __name__ == "__main__":
    main()
