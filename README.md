# Live View Map

Live View Map is a Flask website for tracking location-based incidents on an interactive map.

## What This Website Does

- Shows incident/news markers and polygon zones on a Leaflet map.
- Provides a public view for visitors (only items marked as visible are shown).
- Provides an admin view where logged-in users can manage map data and marker styles.

## 🎥 Demo Video

[![Watch the video](https://img.youtube.com/vi/mU7GzGnUu1g/0.jpg)](https://youtu.be/mU7GzGnUu1g)


## Important Features

- Interactive map with OpenStreetMap tiles.
- Sidebar incident feed linked to map markers (click a card to focus a marker).
- Marker type filtering (`all`, `warning`, `fire`, etc.).
- Marker clustering toggle (can be enabled/disabled from the nav).
- Admin marker management:
  - Create, edit, drag, and delete markers directly on the map.
  - Update title, description, type, region, source URL, and visibility.
- Admin polygon management:
  - Create/edit polygons by JSON form.
  - Draw/edit polygons directly on the map.
- Marker type management:
  - Create custom marker types.
  - Choose/upload icons and set marker colors.
  - Activate/deactivate types safely.
- Authentication for admin routes with Flask-Login.
- SQLite persistence via Flask-SQLAlchemy.

## Tech Stack

- Python
- Flask
- Flask-SQLAlchemy
- Flask-Login
- SQLite
- Leaflet + Leaflet Draw + Leaflet MarkerCluster
- HTML, CSS, JavaScript

## Run Locally

### 1. Create and activate a virtual environment

Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. (Optional) Configure environment variables

- `SECRET_KEY` (default: `dev-key`)
- `DATABASE_URL` (default: `sqlite:///news.db`)
- `USE_CLUSTERING` (default: `true`)

PowerShell example:

```powershell
$env:SECRET_KEY = "replace-with-a-strong-secret"
$env:DATABASE_URL = "sqlite:///news.db"
$env:USE_CLUSTERING = "true"
```

### 4. (Optional but recommended) Seed initial data

```powershell
python seed\create_admin.py
python seed\seed_news.py
python seed\seed_polygons.py
```

Default seeded admin credentials:

- Username: `admin`
- Password: `1234`

### 5. Start the app

```powershell
python run.py
```

Open:

```text
http://127.0.0.1:8000
```

## Main Routes

- `/` public map and incident feed
- `/login` admin login
- `/admin/news` manage news items
- `/admin/marker-types` manage marker types
- `/admin/markers/map` map-based marker editing
- `/admin/polygons` form-based polygon management
- `/admin/polygons/map` map-based polygon editing

## Notes

- The app uses the Flask application factory pattern with Blueprints.
- `run.py` runs `db.create_all()` on startup, so tables are created automatically if missing.
- For production, set a strong `SECRET_KEY`, use a production-ready database/WSGI setup, and remove default credentials.
