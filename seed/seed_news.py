from datetime import datetime
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app import create_app
from extensions import db
from models import News

app = create_app()

sample_news = [
    News(
        title="Airstrike reported near Tyre",
        description="An airstrike was reported near the outskirts of Tyre.",
        latitude=33.2704,
        longitude=35.2038,
        marker_type="airstrike",
        region_name="Tyre",
        source_url="https://example.com/news1",
        published_at=datetime(2026, 3, 25, 13, 20)
    ),
    News(
        title="Large fire detected in Nabatieh",
        description="A large fire broke out in a southern area near Nabatieh.",
        latitude=33.3789,
        longitude=35.4831,
        marker_type="fire",
        region_name="Nabatieh",
        source_url="https://example.com/news2",
        published_at=datetime(2026, 3, 25, 12, 45)
    ),
    News(
        title="Protest gathering in Sidon",
        description="A public gathering and protest were reported in Sidon.",
        latitude=33.5631,
        longitude=35.3689,
        marker_type="protest",
        region_name="Sidon",
        source_url="https://example.com/news3",
        published_at=datetime(2026, 3, 25, 11, 30)
    )
]

def main():
    with app.app_context():
        db.create_all()

        if News.query.count() == 0:
            db.session.add_all(sample_news)
            db.session.commit()
            print("Sample news inserted successfully.")
        else:
            print("Database already contains data.")


if __name__ == "__main__":
    main()
