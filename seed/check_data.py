from app import app
from models import News

with app.app_context():
    all_news = News.query.all()

    for item in all_news:
        print(item.id, item.title, item.marker_type, item.region_name)