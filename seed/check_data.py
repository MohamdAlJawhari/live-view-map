from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app import create_app
from models import News

app = create_app()


def main():
    with app.app_context():
        all_news = News.query.all()

        for item in all_news:
            print(item.id, item.title, item.marker_type, item.region_name)


if __name__ == "__main__":
    main()
